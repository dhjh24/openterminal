# OpenTerminalUI Installation (Docker, Fresh Clone)

This guide is for a new machine starting from a public git clone.
Only Docker Desktop/Engine + Docker Compose are required; local Python/Node are not needed for this path.

OpenTerminalUI runs as an **isolated Compose project** (`openterminalui`) with its own
network, volumes, and host ports so it can sit beside other stacks on the same host.

## 1) Clone

```bash
git clone <PUBLIC_REPO_URL>
cd OpenTerminalUI
```

## 2) Configure

```bash
cp .env.example .env
# Change API_PORT / REDIS_HOST_PORT / POSTGRES_HOST_PORT if those ports are taken
./scripts/check-ports.sh
```

Default host ports:

| Service         | Env var              | Host | Container |
| --------------- | -------------------- | ---: | --------: |
| App (Web + API) | `API_PORT`           | 8105 |      8000 |
| Redis (dev)     | `REDIS_HOST_PORT`    | 6382 |      6379 |
| Postgres (dev)  | `POSTGRES_HOST_PORT` | 5436 |      5432 |

## 3) Start

One-command installer:

```bash
./install.sh          # macOS / Linux / WSL
# Windows: ./install.ps1
```

Or scripts:

```bash
./scripts/start.sh
./scripts/start.sh --postgres
```

Or Compose directly:

```bash
docker compose --project-name openterminalui up -d --build
```

Legacy helper (still supported):

```bash
sh ./scripts/docker-up.sh
sh ./scripts/docker-up.sh --postgres
sh ./scripts/docker-up.sh --port 8110
```

## 4) Open

- App: `http://127.0.0.1:8105` (or your `API_PORT`)
- API docs: `http://127.0.0.1:8105/docs`
- Health: `http://127.0.0.1:8105/health`

## Day-2 operations

```bash
./scripts/status.sh
./scripts/logs.sh -f
./scripts/stop.sh                 # keeps volumes
# WARNING: deletes this project's data:
docker compose --project-name openterminalui down --volumes
```

## Common issues

- Docker not running: start Docker Desktop and wait until engine is ready.
- `docker compose` not found: install/update Docker Desktop (Compose v2 required).
- Missing provider credentials: update root `.env` with your own API keys.
- Port already in use: run `./scripts/check-ports.sh`, then change the reported
  variable in `.env` (for example `API_PORT=8110`).
- Sibling projects: never reuse another project's `COMPOSE_PROJECT_NAME`, network,
  volume names, or database credentials.
