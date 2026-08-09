# Personal Usage Streaming Analytics

A personal real-time data engineering project that tracks Instagram usage events and processes them through:

iPhone collector → Spring Boot ingestion API → Kafka → stream processor → PostgreSQL/TimescaleDB → analytics API → React dashboard

## Project status

Planning and repository baseline.

## Repository structure

- `contracts/` — Event schemas and API contracts
- `services/` — Ingestion API, analytics API, and stream processor
- `frontend/` — React dashboard
- `infrastructure/` — Docker, Kafka, and database configuration
- `docs/` — Architecture and operational documentation
- `big_brain.md` — Project design and roadmap

## First delivery goal

Collector event → Kafka → processor → database → live dashboard update
