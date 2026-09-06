# DevOps TaskBoard

A production-shaped learning application: React/TypeScript frontend, Express/TypeScript API, PostgreSQL, JWT authentication, migrations, tests, health checks, and Docker Compose.

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

Open http://localhost:5173 and sign in with `demo@example.com` / `password123`.

## Useful checks

```bash
docker compose ps
curl http://localhost:3000/health
docker compose logs -f backend
```

## Architecture

- `frontend`: React SPA served by nginx; `/api` is proxied to the API container.
- `backend`: REST API with validation, JWT auth, structured logs, and PostgreSQL.
- `db`: PostgreSQL with a persistent named volume and idempotent startup migrations.

The application deliberately includes realistic deployment surfaces without unnecessary product complexity: builds, environment variables, secrets, stateful storage, health/readiness, logs, migrations, and an HTTP boundary.

## Mac local environment

The project was restored from `~/Downloads/devops-taskboard.zip`. Node 24.20.0 is selected by `.node-version` through fnm. Host dependencies use the root npm workspace lockfile (`npm ci`). The existing Dockerfiles use Node 22, which also satisfies the project's Node >=22 requirement, and currently install dependencies independently using `npm install`.

Start Docker Desktop, then run from this directory:

```bash
docker compose up -d --build
docker compose ps
```

App: http://localhost:5173. API/database health: http://localhost:3000/health. Demo login: `demo@example.com` / `password123`.

```bash
docker compose stop       # stop services, retain containers and database
docker compose start     # restart existing containers
docker compose down      # remove containers/network, retain database volume
docker compose logs -f   # Ctrl-C exits log viewing without stopping services
```

The database stays inside Docker in `devops-taskboard_postgres_data`. Do not use `down -v` unless deliberately deleting the database. SQL in `backend/migrations` runs only when PostgreSQL initializes an empty volume; it is not an ongoing migration runner. Do not manually rerun the demo seed: its task inserts can create duplicates.

`.env` contains the local configuration and a generated JWT secret and is ignored by Git. Ports 3000 and 5173 bind only to this Mac. No PostgreSQL host port is published.

Host checks (no running database needed):

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The existing unit test checks a constant response shape; live HTTP health and authenticated API checks were also performed during setup. Compose serves a production frontend build through nginx, so rebuild after code edits. `npm run dev` requires separate host database connectivity and backend environment configuration; use Compose for the verified local workflow.

The parent workspace is an existing Git repository with no commits or remote. GitHub authentication and a remote have not been configured; provide the intended repository URL before connecting it.
