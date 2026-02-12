# Requirements: Cloudflare Bypass Service CI/CD

> Version: 1.0
> Status: APPROVED
> Last Updated: 2026-02-12

## Problem Statement

Необходимо автоматизировать процесс деплоя cloudflare-bypass-service на различные окружения (prod, dev, stage) при пуше в соответствующие ветки.

**Ключевые проблемы текущей конфигурации:**
- Порты захардкожены — невозможно запустить несколько окружений на одном сервере
- Нет привязки к конкретному IP — сервисы слушают на 0.0.0.0
- Образы без тегов окружения — конфликты при нескольких средах
- Отсутствует CI/CD для автоматического деплоя

## Current State

**Репозиторий:** cloudflare-bypass-service (Node.js + Puppeteer)

**Сервисы в docker-compose.yml:**
| Сервис | Порт | Build | Описание |
|--------|------|-------|----------|
| cloudflare-bypass | 3000 | Dockerfile | Main service (Node.js + Chromium) |
| cloudflare-bypass-dev | 3001 | Dockerfile | Dev mode (profile: dev) |
| test-runner | - | Dockerfile | Test runner (profile: test) |

**Структура:**
```
cloudflare-bypass-service/
├── docker-compose.yml          # Service definitions
├── Dockerfile                  # Node.js + Chromium
├── src/
│   ├── index.js               # Express server
│   ├── module/                # Core modules
│   │   ├── createBrowser.js   # Browser management
│   │   ├── warmupBrowser.js   # Browser warmup
│   │   ├── warmupProxy.js     # Proxy warmup
│   │   └── ...
│   └── endpoints/             # API endpoints
├── tests/
│   ├── unit/
│   ├── integration/
│   └── cloudflare/
├── .github/workflows/
│   └── test.yml               # Existing test workflow
└── package.json
```

**Существующий CI:**
- `test.yml` — unit/integration tests на push/PR to main
- Weekly CF monitoring (scheduled)

## User Stories

### Primary

**As a** разработчик
**I want** автоматический деплой при пуше в ветку (prod/dev/stage)
**So that** я могу быстро доставлять изменения без ручных операций

**As a** DevOps инженер
**I want** запуск dev и prod на одном сервере без конфликтов
**So that** мы могли эффективнее использовать ресурсы

**As a** оператор
**I want** простую настройку нового инстанса
**So that** я мог быстро развернуть сервис на новом сервере

## Acceptance Criteria

### Must Have

1. **Given** пуш в ветку `prod`/`dev`/`stage`
   **When** GitHub Actions workflow запускается
   **Then** self-hosted runner на соответствующем инстансе:
   - Собирает образ локально
   - Обновляет и перезапускает контейнер
   - Основной сервис cloudflare-bypass деплоится

2. **Given** dev и prod на одном сервере
   **When** оба окружения запущены
   **Then** они используют:
   - Разные IP-адреса/интерфейсы
   - Разные теги образов (`:dev`, `:prod`, `:stage`)
   - Не конфликтуют по портам

3. **Given** Docker контейнер упал
   **When** Docker daemon обнаружил это
   **Then** контейнер автоматически перезапускается (restart: unless-stopped)

4. **Given** деплой на инстанс
   **When** обновляется docker-compose.yml из репо
   **Then** локальные `.env` файлы сохраняются

5. **Given** новый инстанс настраивается
   **When** оператор смотрит репозиторий
   **Then** есть `.env.example` с документацией всех переменных

### Should Have

- Ручной триггер workflow (workflow_dispatch)
- Health check после деплоя (curl /health endpoint)

### Won't Have (This Iteration)

- Blue-green deployment
- Автоматический rollback
- Уведомления (Slack/Telegram)
- Мониторинг и алертинг (Prometheus/Grafana)
- Kubernetes

## Technical Decisions

### Конфигурация (Proposed)
- **Подход:** `.env` + `docker-compose.override.yml` на сервере
- **Расположение:** `/opt/cloudflare-bypass/{env}/`
- **Что обновляется при деплое:** `docker-compose.yml`, `Dockerfile`, `src/`, `package*.json`
- **Что сохраняется:** `.env`, `docker-compose.override.yml`

### Параметризация docker-compose.yml
```yaml
# Пример параметризации
services:
  cloudflare-bypass:
    image: cloudflare-bypass:${ENV_TAG:-latest}
    ports:
      - "${BIND_IP:-0.0.0.0}:${PORT:-3000}:3000"
    environment:
      - PORT=3000
      - browserLimit=${BROWSER_LIMIT:-20}
      - timeOut=${TIMEOUT:-60000}
      - WARMUP_ENABLED=${WARMUP_ENABLED:-true}
      - authToken=${AUTH_TOKEN:-}
```

### Структура на сервере
```
/opt/cloudflare-bypass/
├── dev/
│   ├── .env                    # BIND_IP=10.0.0.2, ENV_TAG=dev, etc.
│   ├── docker-compose.yml      # Из репо (обновляется)
│   ├── docker-compose.override.yml  # Локальные override (persistent)
│   ├── Dockerfile              # Из репо (обновляется)
│   └── src/                    # Из репо (обновляется)
├── prod/
│   ├── .env                    # BIND_IP=10.0.0.1, ENV_TAG=prod, etc.
│   ├── docker-compose.yml
│   ├── docker-compose.override.yml
│   ├── Dockerfile
│   └── src/
└── stage/
    └── ...
```

## Constraints

- **Infrastructure:** Self-hosted GitHub Runner на каждом инстансе
- **Platform:** Docker + docker-compose на Linux (Ubuntu) и macOS
- **Network:** Разные IP-адреса для разных окружений (real IPs на Linux, loopback aliases или host IPs на macOS)
- **Build:** Сборка образов происходит локально на runner'е
- **Browser:** Chromium требует специфические системные зависимости (включены в Docker image)
- **Paths:** Linux: `/opt/cf-bypass/`, macOS: `~/cf-bypass/`

## Open Questions

- [x] Какие IP-адреса/интерфейсы доступны на серверах? → **Указываются вручную в `.env` на сервере**
- [x] Нужен ли integration с test.yml? → **Нет, test.yml остаётся отдельным. Деплой не зависит от тестов.**
- [x] Какие переменные окружения обязательны vs опциональны? → **См. ниже**

## Environment Variables

### Required (обязательные)
| Variable | Description | Example |
|----------|-------------|---------|
| `COMPOSE_PROJECT_NAME` | Изолирует контейнеры/сети/volumes | `cf-bypass-prod` |
| `ENV_TAG` | Тег Docker образа | `prod`, `dev`, `stage` |
| `BIND_IP` | IP для привязки порта | `10.0.0.1`, `0.0.0.0` |

### Optional (опциональные, есть defaults)
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Порт сервиса |
| `BROWSER_LIMIT` | `20` | Макс. concurrent browser contexts |
| `TIMEOUT` | `60000` | Request timeout (ms) |
| `WARMUP_ENABLED` | `true` | Browser warmup при старте |
| `WARMUP_SITES` | `instagram.com,google.com,x.com` | Сайты для warmup |
| `PROXY_WARMUP_ENABLED` | `true` | Per-proxy warmup |
| `PROXY_WARMUP_TTL` | `3600000` | TTL кеша warmup (ms) |
| `AUTH_TOKEN` | `` (empty) | API auth token (пустой = отключено) |

### Example .env Files

**Production (`/opt/cf-bypass/prod/.env`):**
```bash
# === Production Environment ===
COMPOSE_PROJECT_NAME=cf-bypass-prod
ENV_TAG=prod
BIND_IP=10.0.0.1

# Performance (production settings)
BROWSER_LIMIT=30
TIMEOUT=60000

# Security
AUTH_TOKEN=your-secure-production-token

# Warmup
WARMUP_ENABLED=true
WARMUP_SITES=instagram.com,google.com,x.com
PROXY_WARMUP_ENABLED=true
PROXY_WARMUP_TTL=3600000
```

**Development (`/opt/cf-bypass/dev/.env`):**
```bash
# === Development Environment ===
COMPOSE_PROJECT_NAME=cf-bypass-dev
ENV_TAG=dev
BIND_IP=10.0.0.2

# Performance (lower limits for dev)
BROWSER_LIMIT=10
TIMEOUT=120000

# Security (no auth for dev)
AUTH_TOKEN=

# Warmup
WARMUP_ENABLED=true
PROXY_WARMUP_ENABLED=false
```

**Stage (`/opt/cf-bypass/stage/.env`):**
```bash
# === Stage Environment ===
COMPOSE_PROJECT_NAME=cf-bypass-stage
ENV_TAG=stage
BIND_IP=127.0.0.1

# Same as prod
BROWSER_LIMIT=30
TIMEOUT=60000
AUTH_TOKEN=stage-test-token

WARMUP_ENABLED=true
PROXY_WARMUP_ENABLED=true
```

## References

- [GitHub Actions self-hosted runners](https://docs.github.com/en/actions/hosting-your-own-runners)
- [Docker Compose environment variables](https://docs.docker.com/compose/environment-variables/)
- Текущий `docker-compose.yml` и `test.yml` в репозитории

---

## Approval

- [x] Reviewed by: User
- [x] Approved on: 2026-02-12
- [x] Notes: test.yml stays separate, deploy independent of tests
