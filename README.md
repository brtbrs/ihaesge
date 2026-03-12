# IHAESGE Monorepo Bootstrap

Initial backend skeleton for **IHAESGE** (AI-powered Indonesian stock news aggregation SaaS).

## Tech Stack
- Next.js (planned frontend)
- Python FastAPI backend
- PostgreSQL
- Redis
- Docker Compose
- SQLAlchemy + Alembic (migrations)
- Prisma placeholder schema for future frontend integration

## Project Structure

```text
backend/
  app/
    api/
    core/
    models/
    schemas/
    repositories/
    services/
    pipelines/
    workers/
    utils/
  tests/
  alembic/
  main.py
scraper/
ai/
infrastructure/
scripts/
docs/
```

## Quick Start

1. Copy env files:
   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   ```
2. Start all services:
   ```bash
   docker compose up --build
   ```
3. Open backend docs:
   - http://localhost:8000/docs

## Health checks
- `GET /health`
- `GET /api/v1/health`
