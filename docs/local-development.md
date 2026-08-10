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

Keep each service running in its own PowerShell terminal.

1. In a second terminal, start the stream processor:

   ```powershell
   $env:POSTGRES_DB = ((Get-Content .env | Where-Object { $_ -match '^POSTGRES_DB=' } | Select-Object -First 1) -replace '^POSTGRES_DB=', '')
   $env:POSTGRES_USER = ((Get-Content .env | Where-Object { $_ -match '^POSTGRES_USER=' } | Select-Object -First 1) -replace '^POSTGRES_USER=', '')
   $env:POSTGRES_PASSWORD = ((Get-Content .env | Where-Object { $_ -match '^POSTGRES_PASSWORD=' } | Select-Object -First 1) -replace '^POSTGRES_PASSWORD=', '')
   $env:POSTGRES_HOST = ((Get-Content .env | Where-Object { $_ -match '^POSTGRES_HOST=' } | Select-Object -First 1) -replace '^POSTGRES_HOST=', '')
   $env:POSTGRES_PORT = ((Get-Content .env | Where-Object { $_ -match '^POSTGRES_PORT=' } | Select-Object -First 1) -replace '^POSTGRES_PORT=', '')      

   mvn -f services/stream-processor/pom.xml spring-boot:run
   ```

   Wait for `Started StreamProcessorApplication` and for the processor to receive its Kafka partition assignment.

2. In a third terminal, start the ingestion API:

   ```powershell
   $tokenLine = Get-Content .env | Where-Object { $_ -match '^INGESTION_COLLECTOR_TOKEN=' } | Select-Object -First 1
   $env:INGESTION_COLLECTOR_TOKEN = $tokenLine.Substring('INGESTION_COLLECTOR_TOKEN='.Length)

   mvn -f services/ingestion-api/pom.xml spring-boot:run
   ```

   Wait for `Started IngestionApiApplication`, then open a fourth terminal and verify the API:

   ```powershell
   Invoke-RestMethod http://localhost:8080/actuator/health
   ```

   Expected result:

   ```text
   status : UP
   ```

## End-to-end local test

With Docker, the processor, and the ingestion API running, use a fourth PowerShell terminal to submit an event and verify that the same event reaches TimescaleDB:

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
