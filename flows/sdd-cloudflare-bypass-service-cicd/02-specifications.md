# Specifications: Cloudflare Bypass Service CI/CD

> Version: 1.0
> Status: DRAFTED
> Last Updated: 2026-02-12
> Requirements: ./01-requirements.md

## Overview

CI/CD система для автоматического деплоя cloudflare-bypass-service на инстансы prod/dev/stage через GitHub Actions с self-hosted runners.

**Ключевые особенности:**
- Один контейнер (cloudflare-bypass) с Node.js + Puppeteer + Chromium
- Multi-environment на одном сервере через BIND_IP и COMPOSE_PROJECT_NAME
- Multi-platform: Linux (Ubuntu) + macOS
- test.yml остаётся отдельным workflow

## Multi-Platform Support

### Platform Matrix

| Platform | Docker | Paths | Network | Use Case |
|----------|--------|-------|---------|----------|
| Linux/Ubuntu | Docker Engine | `/opt/cf-bypass/` | **macvlan** — отдельный интерфейс, IP в подсети роутера | prod, dev |
| macOS | Docker Desktop | `~/cf-bypass/` | **bridge** — своя подсеть, статический IP (macvlan не поддерживается) | stage, dev |

### Отдельный интерфейс и IP от роутера (Linux)

На **Linux** контейнер получает отдельный сетевой интерфейс через драйвер **macvlan**: интерфейс привязан к физическому интерфейсу хоста (например `eth0`), роутер видит контейнер как отдельное устройство в сети. Порт на хост не мапится — нет конфликтов с другими проектами в Docker.

**Варианты получения IP:**

1. **Статический IP в подсети роутера (рекомендуется)**  
   В `.env` задаёте `NETWORK_SUBNET`, `NETWORK_GATEWAY`, `NETWORK_PARENT` (интерфейс хоста) и `CONTAINER_IP` — свободный IP из подсети роутера. В роутере можно зарезервировать этот IP за MAC контейнера (DHCP reservation), чтобы не пересекаться с раздачей DHCP.

2. **Динамический IP от роутера (DHCP)**  
   Docker macvlan не умеет выдавать контейнеру IP по DHCP «из коробки». Возможные варианты:
   - **Резервация в роутере:** задать статический `CONTAINER_IP` в подсети и в настройках роутера привязать его к MAC-адресу контейнера (по сути «динамический» с точки зрения роутера — он выдаёт этот IP данному устройству).
   - **DHCP внутри контейнера:** после старта контейнера запускать в нём `dhclient` на macvlan-интерфейсе — тогда роутер выдаст IP по DHCP. Требует доработки образа/entrypoint и передачи имени интерфейса.

Для CI/CD и предсказуемого health check достаточно **статического IP в подсети роутера** (вариант 1).

### macOS: bridge (macvlan недоступен)

**macvlan на Docker Desktop для Mac не поддерживается.** На macOS используется пользовательская **bridge**-сеть с фиксированной подсетью и статическим IP контейнера. Порт на хост не публикуется — доступ с хоста по `CONTAINER_IP:3000`, конфликтов с другими контейнерами нет.

### Configuration per Platform

**Linux Runner:**
```bash
# ~/.bashrc or systemd environment
export DEPLOY_DIR=/opt/cf-bypass
```

**macOS Runner:**
```bash
# ~/.zshrc or launchd environment
export DEPLOY_DIR=~/cf-bypass
```

### Example .env

**Linux (macvlan, IP в подсети роутера):**
```bash
COMPOSE_PROJECT_NAME=cf-bypass-prod
ENV_TAG=prod

# macvlan: подсеть и шлюз как у роутера, родительский интерфейс хоста
NETWORK_SUBNET=192.168.1.0/24
NETWORK_GATEWAY=192.168.1.1
NETWORK_PARENT=eth0
CONTAINER_IP=192.168.1.50
```

**Linux Development (второй контейнер на том же хосте):**
```bash
COMPOSE_PROJECT_NAME=cf-bypass-dev
ENV_TAG=dev

NETWORK_SUBNET=192.168.1.0/24
NETWORK_GATEWAY=192.168.1.1
NETWORK_PARENT=eth0
CONTAINER_IP=192.168.1.51
```

**macOS (bridge, своя подсеть):**
```bash
COMPOSE_PROJECT_NAME=cf-bypass-stage
ENV_TAG=stage

# bridge: любая приватная подсеть, не пересекающаяся с хостом
NETWORK_SUBNET=172.28.0.0/24
NETWORK_GATEWAY=172.28.0.1
CONTAINER_IP=172.28.0.2
# NETWORK_PARENT на macOS не используется (driver: bridge)
```

## Affected Systems

| System | Impact | Notes |
|--------|--------|-------|
| `.github/workflows/deploy.yml` | Create | Новый workflow для деплоя |
| `docker-compose.yml` | Modify | Параметризация портов, IP, тегов |
| `.env.example` | Create | Шаблон переменных окружения |
| `.gitignore` | Modify | Добавить .env |

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Repository                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ branch:prod │  │ branch:dev  │  │ branch:stage│              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          ▼                                       │
│              ┌───────────────────────┐                          │
│              │  .github/workflows/   │                          │
│              │     deploy.yml        │                          │
│              └───────────┬───────────┘                          │
└──────────────────────────┼──────────────────────────────────────┘
                           │ triggers
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Server: Prod   │ │  Server: Dev    │ │  Server: Stage  │
│  ┌───────────┐  │ │  ┌───────────┐  │ │  ┌───────────┐  │
│  │ GH Runner │  │ │  │ GH Runner │  │ │  │ GH Runner │  │
│  │ label:prod│  │ │  │ label:dev │  │ │  │label:stage│  │
│  └─────┬─────┘  │ │  └─────┬─────┘  │ │  └─────┬─────┘  │
│        ▼        │ │        ▼        │ │        ▼        │
│  /opt/cf-bypass/│ │  /opt/cf-bypass/│ │  /opt/cf-bypass/│
│     └── prod/   │ │     └── dev/    │ │    └── stage/   │
│        ├─ .env  │ │        ├─ .env  │ │        ├─ .env  │
│        └─ ...   │ │        └─ ...   │ │        └─ ...   │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Multi-Environment on Single Server

```
┌────────────────────────────────────────────────────────────┐
│                     Single Server                          │
│                                                            │
│  ┌─────────────────────┐    ┌─────────────────────┐       │
│  │   Dev Environment   │    │  Prod Environment   │       │
│  │   IP: 10.0.0.2      │    │   IP: 10.0.0.1      │       │
│  │   Tag: :dev         │    │   Tag: :prod        │       │
│  │                     │    │                     │       │
│  │ ┌─────────────────┐ │    │ ┌─────────────────┐ │       │
│  │ │cloudflare-bypass│ │    │ │cloudflare-bypass│ │       │
│  │ │     :3000       │ │    │ │     :3000       │ │       │
│  │ └─────────────────┘ │    │ └─────────────────┘ │       │
│  │                     │    │                     │       │
│  │/opt/cf-bypass/dev/  │    │/opt/cf-bypass/prod/ │       │
│  └─────────────────────┘    └─────────────────────┘       │
│                                                            │
│  GH Runner (labels: dev, prod)                            │
└────────────────────────────────────────────────────────────┘
```

### Deploy Flow

```
Push to branch (prod/dev/stage)
         │
         ▼
┌─────────────────────────────┐
│ GitHub Actions Triggered    │
│ - Select runner by label    │
│ - runs-on: [self-hosted, X] │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Checkout code               │
│ - Full repository           │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Copy to deploy dir          │
│ /opt/cf-bypass/{env}/       │
│ - Preserve .env             │
│ - Preserve override.yml     │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Build image locally         │
│ docker-compose build        │
│ (uses ENV_TAG from .env)    │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Restart service             │
│ docker-compose down         │
│ docker-compose up -d        │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Health check                │
│ curl http://$BIND_IP:$PORT  │
│   /health                   │
└─────────────────────────────┘
```

## Interfaces

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [prod, dev, stage]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy'
        required: true
        type: choice
        options: [prod, dev, stage]

jobs:
  deploy:
    runs-on: [self-hosted, "${{ github.event_name == 'workflow_dispatch' && inputs.environment || github.ref_name }}"]

    steps:
      - uses: actions/checkout@v4

      - name: Validate environment
        run: |
          if [ -z "${DEPLOY_DIR}" ]; then
            echo "::error::DEPLOY_DIR not set in runner environment"
            exit 1
          fi
          echo "DEPLOY_DIR=${DEPLOY_DIR}"

      - name: Deploy
        run: |
          ENV_NAME="${{ github.event_name == 'workflow_dispatch' && inputs.environment || github.ref_name }}"
          TARGET_DIR="${DEPLOY_DIR}/${ENV_NAME}"

          # Verify .env exists
          if [ ! -f "${TARGET_DIR}/.env" ]; then
            echo "::error::.env not found in ${TARGET_DIR}"
            exit 1
          fi

          # Copy repo files (preserve .env and override.yml)
          cp docker-compose.yml "${TARGET_DIR}/"
          cp Dockerfile "${TARGET_DIR}/"
          cp package*.json "${TARGET_DIR}/"
          cp -r src/ "${TARGET_DIR}/"
          [ -f .env.example ] && cp .env.example "${TARGET_DIR}/"

          # Build and restart
          cd "${TARGET_DIR}"
          docker-compose build
          docker-compose down
          docker-compose up -d

      - name: Health check
        run: |
          ENV_NAME="${{ github.event_name == 'workflow_dispatch' && inputs.environment || github.ref_name }}"
          TARGET_DIR="${DEPLOY_DIR}/${ENV_NAME}"

          sleep 15

          # Load env vars for health check
          source "${TARGET_DIR}/.env"
          HEALTH_URL="http://${CONTAINER_IP}:3000/health"

          echo "Checking health at ${HEALTH_URL}"
          HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" || echo "000")

          if [ "$HTTP_CODE" = "200" ]; then
            echo "Health check passed"
          else
            echo "::warning::Health check returned ${HTTP_CODE}"
          fi

          # Show container status
          docker-compose -f "${TARGET_DIR}/docker-compose.yml" ps
```

### Parameterized docker-compose.yml

```yaml
version: '3.8'

services:
  cloudflare-bypass:
    build: .
    image: cloudflare-bypass:${ENV_TAG:-latest}
    environment:
      - PORT=3000
      - browserLimit=${BROWSER_LIMIT:-20}
      - timeOut=${TIMEOUT:-60000}
      - WARMUP_ENABLED=${WARMUP_ENABLED:-true}
      - WARMUP_SITES=${WARMUP_SITES:-instagram.com,google.com,x.com}
      - PROXY_WARMUP_ENABLED=${PROXY_WARMUP_ENABLED:-true}
      - PROXY_WARMUP_TTL=${PROXY_WARMUP_TTL:-3600000}
      - authToken=${AUTH_TOKEN:-}
    networks:
      cf_network:
        ipv4_address: ${CONTAINER_IP}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    restart: unless-stopped

  # Development mode (profile: dev) - not deployed via CI/CD
  cloudflare-bypass-dev:
    profiles: ["dev"]
    # ... (остаётся для локальной разработки)

  # Test runner (profile: test) - not deployed via CI/CD
  test-runner:
    profiles: ["test"]
    # ... (остаётся для тестов, test.yml workflow)

networks:
  cf_network:
    driver: macvlan
    driver_opts:
      parent: ${NETWORK_PARENT:-eth0}
    ipam:
      config:
        - subnet: ${NETWORK_SUBNET}
          gateway: ${NETWORK_GATEWAY}
```

**Note:**
- CI/CD деплоит только основной сервис `cloudflare-bypass`
- Контейнер получает отдельный IP (macvlan на Linux, bridge на macOS); порт на хост не мапится
- Health check и доступ к сервису: `http://${CONTAINER_IP}:3000`
- **macOS:** macvlan не поддерживается — в каталоге деплоя нужен `docker-compose.override.yml`, подменяющий сеть на `driver: bridge` и убирающий `driver_opts.parent`
- Профили `dev` и `test` используются локально

## Data Models

### Environment Variables (.env.example)

```bash
# ===========================================
# Environment Configuration for cloudflare-bypass-service
# ===========================================
# Copy this file to .env and configure for your environment

# --- Core Settings ---
# Project name prefix (isolates containers, networks, volumes)
COMPOSE_PROJECT_NAME=cf-bypass-dev

# Environment tag for Docker images
ENV_TAG=dev

# --- Network (Linux: macvlan, macOS: bridge) ---
# Подсеть и шлюз: на Linux — как у роутера; на macOS — любая приватная (e.g. 172.28.0.0/24)
NETWORK_SUBNET=192.168.1.0/24
NETWORK_GATEWAY=192.168.1.1
# Родительский интерфейс (только Linux, macvlan). macOS: оставить пустым и использовать override с driver: bridge
NETWORK_PARENT=eth0
# IP контейнера в этой подсети (на Linux — из диапазона роутера, можно зарезервировать в DHCP)
CONTAINER_IP=192.168.1.50

# --- Ports ---
PORT=3000
DEV_PORT=3001

# --- Browser Settings ---
# Max concurrent browser contexts
BROWSER_LIMIT=20

# Request timeout in milliseconds
TIMEOUT=60000

# --- Warmup Settings ---
WARMUP_ENABLED=true
WARMUP_SITES=instagram.com,google.com,x.com
PROXY_WARMUP_ENABLED=true
PROXY_WARMUP_TTL=3600000

# --- Security ---
# Optional API authentication token (leave empty to disable)
AUTH_TOKEN=

# ===========================================
# Example configurations:
# ===========================================
#
# Linux prod (macvlan, IP от подсети роутера):
#   NETWORK_SUBNET=192.168.1.0/24
#   NETWORK_GATEWAY=192.168.1.1
#   NETWORK_PARENT=eth0
#   CONTAINER_IP=192.168.1.50
#
# Linux dev (второй контейнер на том же хосте):
#   CONTAINER_IP=192.168.1.51
#
# macOS (bridge, своя подсеть):
#   NETWORK_SUBNET=172.28.0.0/24
#   NETWORK_GATEWAY=172.28.0.1
#   CONTAINER_IP=172.28.0.2
#   NETWORK_PARENT=  (пусто; использовать override с driver: bridge)
```

### Directory Structure on Server

**Linux (`DEPLOY_DIR=/opt/cf-bypass`):**
```
/opt/cf-bypass/
├── prod/
│   ├── .env                         # Production config (CONTAINER_IP, NETWORK_*)
│   ├── docker-compose.yml           # From repo (updated on deploy)
│   ├── docker-compose.override.yml  # Local overrides (persistent)
│   ├── Dockerfile                   # From repo
│   ├── package.json                 # From repo
│   ├── package-lock.json            # From repo
│   └── src/                         # Source code (from repo)
├── dev/
│   └── ...
└── stage/
    └── ...
```

**macOS (`DEPLOY_DIR=~/cf-bypass`):**
```
~/cf-bypass/
├── stage/
│   ├── .env                         # Stage config (CONTAINER_IP, NETWORK_*)
│   ├── docker-compose.yml
│   ├── docker-compose.override.yml
│   ├── Dockerfile
│   ├── package.json
│   ├── package-lock.json
│   └── src/
└── dev/
    └── ...
```

## Behavior Specifications

### Happy Path: Push to Branch

1. Developer pushes to `dev` branch
2. GitHub Actions triggers `deploy.yml`
3. Job runs on runner with label `dev`
4. Runner checks out code to temp directory
5. Files copied to `/opt/cf-bypass/dev/` (preserving .env, override.yml)
6. `docker-compose build` builds image with tag `:dev`
7. `docker-compose down` stops current container
8. `docker-compose up -d` starts new container
9. Health check verifies `/health` endpoint returns 200
10. Workflow completes successfully

### Happy Path: Manual Deploy

1. User triggers workflow_dispatch
2. Selects environment (e.g., `prod`)
3. Same flow as push, but on selected environment

### Edge Cases

| Case | Trigger | Expected Behavior |
|------|---------|-------------------|
| Missing .env | First deploy or .env deleted | Workflow fails with clear error message |
| Build failure | Dockerfile error or npm install fails | Containers not restarted, old version keeps running |
| Port conflict | Another process using the port | docker-compose up fails, error logged |
| Disk full | No space for images | Build fails, old containers keep running |
| Runner offline | Server down or runner not running | Job queued until runner available |
| Health check fails | Service didn't start properly | Warning logged, workflow doesn't fail |

### Error Handling

| Error | Cause | Response |
|-------|-------|----------|
| `.env not found` | Missing config file | Exit with error, don't touch running containers |
| `docker-compose build` fails | Bad Dockerfile, npm error | Exit, keep old containers running |
| `docker-compose up` fails | Port conflict, resource issue | Log error, attempt `docker-compose down` to clean up |
| Health check fails | Service didn't start | Log warning (don't fail workflow) |

## Dependencies

### Requires (Pre-requisites on Server)

- Docker Engine installed
- Docker Compose v2 installed
- GitHub Actions Runner installed and registered
- Runner labeled with environment name (prod/dev/stage)
- `/opt/cf-bypass/{env}/` directory created
- `.env` file configured in deploy directory
- `DEPLOY_DIR` environment variable set in runner environment

### Runner Labels

| Environment | Runner Labels |
|-------------|---------------|
| prod | `self-hosted`, `prod` |
| dev | `self-hosted`, `dev` |
| stage | `self-hosted`, `stage` |

## Testing Strategy

### Manual Verification

1. [ ] Push to `dev` branch → verify container restarts with `:dev` tag
2. [ ] Push to `prod` branch → verify container restarts with `:prod` tag
3. [ ] Run two environments on same server → verify no port conflicts
4. [ ] Verify `.env` is preserved after deploy
5. [ ] Kill container manually → verify it auto-restarts
6. [ ] Test workflow_dispatch manual trigger
7. [ ] Test /health endpoint returns valid JSON

### Verification Commands

```bash
# Check container is running with correct tag
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}"

# Verify env is loaded
docker-compose config | grep -E "CONTAINER_IP|subnet"

# Test health endpoint (use CONTAINER_IP from .env)
source .env && curl -s "http://${CONTAINER_IP}:3000/health" | jq

# Check logs
docker-compose logs -f cloudflare-bypass
```

## Migration / Rollout

### Initial Setup: Linux (Ubuntu)

1. Install Docker Engine and Docker Compose
2. Install and register GitHub Runner with label (e.g., `prod`, `dev`)
3. Set `DEPLOY_DIR` in runner environment:
   ```bash
   # Add to ~/.bashrc or /etc/environment
   export DEPLOY_DIR=/opt/cf-bypass
   ```
4. Create directory structure:
   ```bash
   sudo mkdir -p /opt/cf-bypass/{prod,dev,stage}
   sudo chown -R $USER:$USER /opt/cf-bypass/
   ```
5. Copy `.env.example` to `.env` in each environment dir and configure
6. First deploy will copy all files and build images

### Initial Setup: macOS

1. Install Docker Desktop
2. Install and register GitHub Runner with label (e.g., `stage`)
3. Set `DEPLOY_DIR` in runner environment:
   ```bash
   export DEPLOY_DIR=~/cf-bypass
   ```
4. Create directory structure:
   ```bash
   mkdir -p ~/cf-bypass/{stage,dev}
   ```
5. Copy `.env.example` to `.env` и задать **bridge**-переменные (подсеть, не пересекающаяся с хостом):
   ```bash
   NETWORK_SUBNET=172.28.0.0/24
   NETWORK_GATEWAY=172.28.0.1
   CONTAINER_IP=172.28.0.2
   # NETWORK_PARENT оставить пустым
   ```
6. Создать `docker-compose.override.yml` в каталоге деплоя, чтобы подменить сеть на bridge (macvlan на macOS недоступен):
   ```yaml
   networks:
     cf_network:
       driver: bridge
       driver_opts: {}
       ipam:
         config:
           - subnet: ${NETWORK_SUBNET}
             gateway: ${NETWORK_GATEWAY}
   ```
7. First deploy скопирует файлы и соберёт образы

### Existing Server Migration

1. Stop current containers: `docker-compose down`
2. Move existing files to deploy directory
3. Create `.env` from `.env.example`
4. Configure `NETWORK_SUBNET`, `NETWORK_GATEWAY`, `NETWORK_PARENT` (Linux), `CONTAINER_IP`, `ENV_TAG`
5. On macOS: add `docker-compose.override.yml` for bridge network (see above)
6. Test: `docker-compose up -d`

## Open Design Questions

- [x] Нужен ли integration с test.yml? → **Нет. test.yml остаётся отдельным workflow. Деплой не зависит от тестов — сервис должен быть отказоустойчивым.**
- [x] Strategy при падении health check → **Warning only, workflow не fails**

---

## Approval

- [ ] Reviewed by: User
- [ ] Approved on: -
- [ ] Notes: -
