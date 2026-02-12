# Implementation Plan: Cloudflare Bypass Service CI/CD

> Version: 1.0
> Status: DRAFTED
> Last Updated: 2026-02-12
> Specifications: ./02-specifications.md

## Summary

Реализация CI/CD для автодеплоя cloudflare-bypass-service на prod/dev/stage инстансы. Три основных deliverable: параметризованный docker-compose.yml, .env.example, и GitHub Actions workflow.

## Task Breakdown

### Phase 1: Docker Compose Parameterization

#### Task 1.1: Параметризация портов и IP
- **Description**: Заменить хардкод портов на переменные окружения с defaults
- **Files**:
  - `docker-compose.yml` - Modify
- **Dependencies**: None
- **Verification**: `docker-compose config` показывает переменные; запуск без .env использует defaults
- **Complexity**: Low

**Changes:**
```yaml
# Before
ports:
  - "3000:3000"

# After
ports:
  - "${BIND_IP:-0.0.0.0}:${PORT:-3000}:3000"
```

#### Task 1.2: Параметризация image tags
- **Description**: Добавить `${ENV_TAG:-latest}` к имени образа
- **Files**:
  - `docker-compose.yml` - Modify
- **Dependencies**: Task 1.1
- **Verification**: `docker-compose config` показывает теги; образы собираются с правильными тегами
- **Complexity**: Low

**Changes:**
```yaml
# Before
build: .

# After
build: .
image: cloudflare-bypass:${ENV_TAG:-latest}
```

#### Task 1.3: Параметризация environment variables
- **Description**: Вынести hardcoded environment переменные в .env
- **Files**:
  - `docker-compose.yml` - Modify
- **Dependencies**: Task 1.1
- **Verification**: `docker-compose config` показывает переменные из .env
- **Complexity**: Low

### Phase 2: Environment Configuration

#### Task 2.1: Создание .env.example
- **Description**: Создать документированный шаблон переменных окружения
- **Files**:
  - `.env.example` - Create
- **Dependencies**: Phase 1 complete
- **Verification**: Копия .env.example как .env позволяет запустить docker-compose
- **Complexity**: Low

**Content:**
- COMPOSE_PROJECT_NAME
- ENV_TAG
- BIND_IP
- PORT, DEV_PORT
- BROWSER_LIMIT, TIMEOUT
- WARMUP_ENABLED, WARMUP_SITES
- PROXY_WARMUP_ENABLED, PROXY_WARMUP_TTL
- AUTH_TOKEN
- Примеры для prod/dev/stage

#### Task 2.2: Обновление .gitignore
- **Description**: Добавить .env в .gitignore (если не добавлен)
- **Files**:
  - `.gitignore` - Modify
- **Dependencies**: None
- **Verification**: `git status` не показывает .env файлы
- **Complexity**: Low

### Phase 3: GitHub Actions Workflow

#### Task 3.1: Создание базового workflow
- **Description**: Создать deploy.yml с triggers и job structure
- **Files**:
  - `.github/workflows/deploy.yml` - Create
- **Dependencies**: None
- **Verification**: Workflow появляется в GitHub Actions UI
- **Complexity**: Medium

**Structure:**
```yaml
name: Deploy
on:
  push:
    branches: [prod, dev, stage]
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [prod, dev, stage]
jobs:
  deploy:
    runs-on: [self-hosted, "${{ ... }}"]
```

#### Task 3.2: Environment validation step
- **Description**: Проверка DEPLOY_DIR и .env перед деплоем
- **Files**:
  - `.github/workflows/deploy.yml` - Modify
- **Dependencies**: Task 3.1
- **Verification**: Workflow fails gracefully если DEPLOY_DIR не задан или .env отсутствует
- **Complexity**: Low

#### Task 3.3: Deploy step
- **Description**: Копирование файлов, build, restart
- **Files**:
  - `.github/workflows/deploy.yml` - Modify
- **Dependencies**: Task 3.2
- **Verification**: Push to branch triggers deploy, container restarts
- **Complexity**: Medium

#### Task 3.4: Health check step
- **Description**: Проверка что контейнер запустился (warning only)
- **Files**:
  - `.github/workflows/deploy.yml` - Modify
- **Dependencies**: Task 3.3
- **Verification**: Warning в логах если health check fails; workflow не fails
- **Complexity**: Low

### Phase 4: Documentation & Testing

#### Task 4.1: Локальное тестирование docker-compose
- **Description**: Проверить что параметризованный compose работает локально
- **Files**: None (testing only)
- **Dependencies**: Phase 1, Phase 2
- **Verification**:
  - `docker-compose config` без ошибок
  - `docker-compose up -d` запускает сервис
- **Complexity**: Low

## Dependency Graph

```
Phase 1 (Docker Compose)          Phase 2 (Env)         Phase 3 (Workflow)
========================          =============         ==================

Task 1.1 ─────┬─────────────────→ Task 2.1              Task 3.1
(ports/IP)    │                   (.env.example)           │
              │                        │                   ▼
Task 1.2 ─────┤                        │              Task 3.2
(image tags)  │                        │              (validation)
              │                        │                   │
Task 1.3 ─────┘                        │                   ▼
(env vars)                             │              Task 3.3
                                       │              (deploy)
              Task 2.2                 │                   │
              (.gitignore)             │                   ▼
                                       │              Task 3.4
                                       │              (health check)
                                       │                   │
                                       ▼                   ▼
                                  ┌─────────────────────────────┐
                                  │  Phase 4: Testing           │
                                  │  Task 4.1 (local test)      │
                                  └─────────────────────────────┘
```

## File Change Summary

| File | Action | Reason |
|------|--------|--------|
| `docker-compose.yml` | Modify | Параметризация (IP, ports, tags, env vars) |
| `.env.example` | Create | Шаблон конфигурации |
| `.github/workflows/deploy.yml` | Create | CI/CD workflow |
| `.gitignore` | Modify | Исключить .env |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Runner не имеет прав на DEPLOY_DIR | Medium | High | Документировать в README требования к permissions |
| docker-compose v1 vs v2 синтаксис | Low | Medium | Использовать `docker-compose` (v1 compatible) |
| Health check timeout | Medium | Low | Увеличить sleep перед health check |

## Rollback Strategy

Все изменения версионируются в git:

1. `git revert <commit>` для отката изменений
2. На серверах: старые контейнеры продолжают работать до успешного `docker-compose up`
3. `.env` на серверах не затрагивается деплоем

## Checkpoints

### После Phase 1:
- [ ] `docker-compose config` без ошибок
- [ ] Все переменные имеют defaults

### После Phase 2:
- [ ] `.env.example` содержит все переменные
- [ ] `.env` в .gitignore

### После Phase 3:
- [ ] Workflow виден в GitHub UI
- [ ] Push в dev ветку триггерит workflow

### После Phase 4:
- [ ] Локальный тест пройден

## Open Implementation Questions

- None at this time

---

## Approval

- [ ] Reviewed by: User
- [ ] Approved on: -
- [ ] Notes: -
