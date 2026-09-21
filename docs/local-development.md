# Local development

## Prerequisites

- Docker Desktop running
- A local `.env` file at the repository root. It is ignored by Git and must not be committed.

  ```text
  INGESTION_COLLECTOR_TOKEN=<collector token>
  POSTGRES_DB=usage_analytics
  POSTGRES_USER=usage_app
  POSTGRES_PASSWORD=<database password>
  ```

## Start the complete stack

From the repository root, build and start Kafka, TimescaleDB, the ingestion API, the stream processor, the analytics API, and the dashboard:

```zsh
docker compose --env-file .env -f infrastructure/compose.yaml up --build -d
docker compose --env-file .env -f infrastructure/compose.yaml ps
```

Wait for `timescaledb`, `kafka`, `ingestion-api`, `analytics-api`, and `dashboard` to report `healthy`. `kafka-init` and `kafka-topics-init` finish successfully and exit normally. The stream processor is a non-web worker, so it has no HTTP health endpoint; confirm its Kafka partition assignment from its logs:

```zsh
docker compose --env-file .env -f infrastructure/compose.yaml logs --tail=100 stream-processor
```

The Compose network exposes only these APIs to the host:

- Ingestion API: `http://localhost:8080`
- Analytics API: `http://localhost:8081`
- Dashboard: `http://localhost:8082`

Kafka and TimescaleDB are internal-only. Inspect them through `docker compose exec` rather than a host port.

## Health checks

```zsh
curl --fail --silent http://localhost:8080/actuator/health
curl --fail --silent http://localhost:8081/actuator/health
curl --fail --silent http://localhost:8082/healthz
```

The first two commands must return `{"status":"UP"}`; the dashboard health check returns `ok`.

## End-to-end session and analytics test

Set a test token without printing it:

```zsh
read -rs 'token?Collector token: '; echo
```

Submit an `OPEN` and `CLOSE` event. Replace the two UUID placeholders with distinct UUIDs and use the same device ID for both events.

```zsh
curl --fail-with-body --request POST http://localhost:8080/api/v1/events \
  --header "X-Collector-Token: $token" \
  --header 'Content-Type: application/json' \
  --data '{"eventId":"<open-event-uuid>","occurredAt":"2026-09-09T10:00:00Z","eventType":"OPEN","app":"instagram","source":"local-session-test","deviceId":"session-test-001"}'

curl --fail-with-body --request POST http://localhost:8080/api/v1/events \
  --header "X-Collector-Token: $token" \
  --header 'Content-Type: application/json' \
  --data '{"eventId":"<close-event-uuid>","occurredAt":"2026-09-09T10:05:00Z","eventType":"CLOSE","source":"local-session-test","deviceId":"session-test-001"}'
```

After a few seconds, request the completed session and usage rollups:

```zsh
curl --fail --get http://localhost:8081/api/v1/metrics \
  --data-urlencode metricName=latest-session \
  --data-urlencode deviceId=session-test-001 \
  --data-urlencode app=instagram

curl --fail --get http://localhost:8081/api/v1/metrics \
  --data-urlencode metricName=usage-rollup \
  --data-urlencode deviceId=session-test-001 \
  --data-urlencode app=instagram \
  --data-urlencode granularity=MINUTE \
  --data-urlencode from=2026-09-09T09:00:00Z \
  --data-urlencode to=2026-09-09T11:00:00Z
```

The latest session must be `COMPLETED` with a duration of approximately 300,000 milliseconds, and the rollup must contain usage buckets totaling five minutes.

## Inspect raw events

Use the database container rather than exposing a database port:

```zsh
docker compose --env-file .env -f infrastructure/compose.yaml exec timescaledb \
  psql -U usage_app -d usage_analytics \
  -c 'SELECT event_id, event_type, app, source, device_id, kafka_partition, kafka_offset FROM raw_app_events ORDER BY occurred_at DESC LIMIT 20;'
```

If your local `.env` uses different database or user names, substitute those two values. Do not paste passwords into shell history.

## iPhone Shortcut

The iPhone and Mac must share a private network. Find the Mac's current Wi-Fi address:

```zsh
ipconfig getifaddr en0
```

In the Shortcut, replace `localhost` with that address, for example:

```text
http://172.20.10.3:8080/api/v1/events
```

First open `http://<mac-lan-ip>:8080/actuator/health` in iPhone Safari. If it does not respond, confirm both devices are on the same non-guest network and allow incoming connections to the ingestion API in macOS Firewall settings.

## Stop the stack

```zsh
docker compose --env-file .env -f infrastructure/compose.yaml down
```

This preserves the named Kafka and TimescaleDB volumes. Do not add `--volumes` unless you deliberately want to delete all local event data.
