# Implementation Plan: Cloudflare Bypass Service CI/CD

> Version: 1.0
> Status: DRAFTED
> Last Updated: 2026-02-12
> Specifications: ./02-specifications.md

## Summary

Реализация CI/CD для автодеплоя cloudflare-bypass-service на prod/dev/stage инстансы. Контейнер получает отдельный IP (Linux: macvlan в подсети роутера; macOS: bridge через override). Deliverable: параметризованный docker-compose.yml (сеть, без port mapping), .env.example, deploy.yml.

## Task Breakdown

### Phase 1: Docker Compose Parameterization

#### Task 1.1: Сеть с отдельным IP (macvlan на Linux, bridge на macOS через override)
- **Description**: Убрать привязку портов к хосту; подключить сервис к сети с фиксированным IP контейнера (CONTAINER_IP). На Linux — macvlan (отдельный интерфейс в подсети роутера), порт на хост не мапится — нет конфликтов с другими проектами.
- **Files**:
  - `docker-compose.yml` - Modify
- **Dependencies**: None
- **Verification**: `docker-compose config` показывает сеть cf_network (macvlan), ipv4_address; портов на хосте нет
- **Complexity**: Low

**Changes:**
```yaml
# Before
ports:
  - "3000:3000"

# After — портов нет; контейнер получает CONTAINER_IP в сети
networks:
  cf_network:
    ipv4_address: ${CONTAINER_IP}
# + секция networks: driver macvlan, parent ${NETWORK_PARENT}, subnet, gateway
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
- COMPOSE_PROJECT_NAME, ENV_TAG
- NETWORK_SUBNET, NETWORK_GATEWAY, NETWORK_PARENT, CONTAINER_IP (Linux: подсеть роутера; macOS: своя подсеть, override с bridge)
- PORT, DEV_PORT
- BROWSER_LIMIT, TIMEOUT, WARMUP_*, PROXY_WARMUP_*, AUTH_TOKEN
- Примеры для Linux (macvlan) и macOS (bridge)

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
(network/IP)  │                   (.env.example)           │
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
| `docker-compose.yml` | Modify | Сеть macvlan + CONTAINER_IP, параметризация тегов и env vars; порты не мапятся |
| `.env.example` | Create | Шаблон (NETWORK_*, CONTAINER_IP, ENV_TAG, PORT, warmup, AUTH_TOKEN) |
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
- [ ] `docker-compose config` без ошибок; сеть cf_network (macvlan), ipv4_address
- [ ] Порт на хост не мапится; переменные NETWORK_*, CONTAINER_IP

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
