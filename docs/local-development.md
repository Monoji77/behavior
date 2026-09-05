# Local development

## First-time setup

1. Start Docker Desktop and wait for it to show that it is running.
2. Fill in the two secret values from Bitwarden into the `.env` file. It is deliberately ignored by Git.

   ```text
   INGESTION_COLLECTOR_TOKEN=<Bitwarden collector token>
   POSTGRES_DB=usage_analytics
   POSTGRES_USER=usage_app
   POSTGRES_PASSWORD=<Bitwarden database password>
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5433
   ```
3. From the repository root, start Kafka and TimescaleDB:

   ```powershell
   docker compose --env-file .env -f infrastructure/compose.yaml up -d
   docker compose --env-file .env -f infrastructure/compose.yaml ps
   ```

   Wait until both services report `healthy`. TimescaleDB is exposed to Windows on port `5433`, rather than `5432`, because this machine has a separate native PostgreSQL instance using port `5432`.

   Docker creates `app-usage-events.raw.v1` and `app-usage-events.dlq.v1` automatically and preserves Kafka and TimescaleDB data in named Docker volumes.

## Start the services

Keep each service running in its own PowerShell terminal. The stream processor and analytics API both require the PostgreSQL settings from `.env`; run the following setup block in each of those terminals before starting Maven. It loads values without printing the database password.

```powershell
Get-Content .env | ForEach-Object {
  if ($_ -match '^(POSTGRES_DB|POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_HOST|POSTGRES_PORT)=(.*)$') {
    Set-Item -Path "Env:$($Matches[1])" -Value $Matches[2]
  }
}
```

1. In a second terminal, start the stream processor:

   ```powershell
   mvn -f services/stream-processor/pom.xml spring-boot:run
   ```

   Wait for `Started StreamProcessorApplication` and for the processor to receive its Kafka partition assignment.

2. In a third terminal, start the ingestion API:

   ```powershell
   $tokenLine = Get-Content .env | Where-Object { $_ -match '^INGESTION_COLLECTOR_TOKEN=' } | Select-Object -First 1
   $env:INGESTION_COLLECTOR_TOKEN = $tokenLine.Substring('INGESTION_COLLECTOR_TOKEN='.Length)

   mvn -f services/ingestion-api/pom.xml spring-boot:run
   ```

   Wait for `Started IngestionApiApplication`.

3. In a fourth terminal, load the PostgreSQL settings with the setup block above, then start the analytics API:

   ```powershell
   mvn -f services/analytics-api/pom.xml spring-boot:run
   ```

   Wait for `Started AnalyticsApiApplication`. In a fifth terminal, verify both HTTP APIs:

   ```powershell
   Invoke-RestMethod http://localhost:8080/actuator/health
   Invoke-RestMethod http://localhost:8081/actuator/health
   ```

   Expected result from both commands:

   ```text
   status : UP
   ```

## End-to-end local session and analytics test

With Docker and all three services running, use a fifth PowerShell terminal to submit an `OPEN`/`CLOSE` pair, then read its completed session and usage rollups through the analytics API:

```powershell
$tokenLine = Get-Content .env | Where-Object { $_ -match '^INGESTION_COLLECTOR_TOKEN=' } | Select-Object -First 1
$token = $tokenLine.Substring('INGESTION_COLLECTOR_TOKEN='.Length)

$deviceId = "session-test-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
$app = 'instagram'
$openedAt = (Get-Date).ToUniversalTime().AddMinutes(-5).ToString('o')
$closedAt = (Get-Date).ToUniversalTime().ToString('o')

$openEvent = @{
  eventId = [guid]::NewGuid()
  occurredAt = $openedAt
  eventType = 'OPEN'
  app = $app
  source = 'local-session-test'
  deviceId = $deviceId
} | ConvertTo-Json

$closeEvent = @{
  eventId = [guid]::NewGuid()
  occurredAt = $closedAt
  eventType = 'CLOSE'
  app = $app
  source = 'local-session-test'
  deviceId = $deviceId
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/api/v1/events' `
  -Headers @{ 'X-Collector-Token' = $token } `
  -ContentType 'application/json' -Body $openEvent

Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/api/v1/events' `
  -Headers @{ 'X-Collector-Token' = $token } `
  -ContentType 'application/json' -Body $closeEvent

Start-Sleep -Seconds 3

Invoke-RestMethod -Uri `
  "http://localhost:8081/api/v1/metrics?metricName=latest-session&deviceId=$deviceId&app=$app"

$from = (Get-Date).ToUniversalTime().AddHours(-1).ToString('yyyy-MM-ddTHH:mm:ssZ')
$to = (Get-Date).ToUniversalTime().AddHours(1).ToString('yyyy-MM-ddTHH:mm:ssZ')
$uri = "http://localhost:8081/api/v1/metrics?metricName=usage-rollup&deviceId=$deviceId&app=$app&granularity=MINUTE&from=$from&to=$to"

Invoke-RestMethod -Uri $uri | ConvertTo-Json -Depth 6
```

Expected result:

- Both ingestion requests return their submitted `eventId` with HTTP `202 Accepted`.
- The `latest-session` response contains the generated `deviceId`, `status` `COMPLETED`, and a duration of approximately `300000` milliseconds.
- The rollup response contains a non-empty `buckets` array. Its usage slices total approximately five minutes, even if the session spans multiple minute boundaries.

This proves the complete path: ingestion API → Kafka → stream processor → TimescaleDB → analytics API.

## Raw-event database check

To inspect a raw event directly in TimescaleDB, submit an event and query it by its ID:

```powershell
$tokenLine = Get-Content .env | Where-Object { $_ -match '^INGESTION_COLLECTOR_TOKEN=' } | Select-Object -First 1
$token = $tokenLine.Substring('INGESTION_COLLECTOR_TOKEN='.Length)

$eventId = [guid]::NewGuid()

$body = @{
  eventId = $eventId
  occurredAt = (Get-Date).ToUniversalTime().ToString('o')
  eventType = 'OPEN'
  app = 'instagram'
  source = 'local-integration-test'
  deviceId = 'iphone-personal'
} | ConvertTo-Json

$response = Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/api/v1/events' `
  -Headers @{ 'X-Collector-Token' = $token } `
  -ContentType 'application/json' -Body $body

$response

Start-Sleep -Seconds 3

docker compose --env-file .env -f infrastructure/compose.yaml exec -T timescaledb `
  psql -U usage_app -d usage_analytics `
  -c "SELECT event_id, event_type, app, source, device_id, kafka_partition, kafka_offset FROM raw_app_events WHERE event_id = '$eventId';"
```

Expected result:

- The API response returns the submitted `eventId` with HTTP `202 Accepted`.
- The SQL query returns one row for that same `eventId`.
- `kafka_partition` is `0` and `kafka_offset` has a numeric value.

This proves the complete path: ingestion API → Kafka → stream processor → TimescaleDB.

## Stop local services

Press `Ctrl+C` in the processor and API terminals. To stop the Docker services while preserving their named volumes, run:

```powershell
docker compose --env-file .env -f infrastructure/compose.yaml down
```

Do not add `-v` unless you deliberately want to delete all local Kafka and TimescaleDB data.

## iPhone Shortcut request

Once the local test succeeds, use the same method, headers, and JSON shape in the Shortcut's **Get Contents of URL** action. Replace `localhost` with the Windows machine's LAN IP address, such as `http://192.168.x.x:8080/api/v1/events`. The iPhone and PC must be on the same network, and Windows Firewall must allow inbound TCP port 8080 on the private network.

Do not put the token in any screenshot, commit, or public issue.
