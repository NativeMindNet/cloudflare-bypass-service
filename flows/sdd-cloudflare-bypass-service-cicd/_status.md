# Status: sdd-cloudflare-bypass-service-cicd

## Current Phase

IMPLEMENTATION

## Phase Status

COMPLETE (implementation done; verify on runner)

## Last Updated

2026-02-12 by Claude

## Blockers

- None

## Progress

- [x] Requirements drafted
- [x] Requirements approved
- [x] Specifications drafted
- [x] Specifications approved
- [x] Plan drafted
- [x] Plan approved
- [x] Implementation started
- [x] Implementation complete

## Context Notes

Key decisions and context for resuming:

- Feature: CI/CD pipeline для cloudflare-bypass-service через GitHub Actions
- Целевые ветки: prod, dev, stage → соответствующие инстансы
- Self-hosted GitHub Runner на каждом инстансе
- Один контейнер (cloudflare-bypass) с Node.js + Puppeteer + Chromium
- **Multi-platform:** Linux (Ubuntu) + macOS
  - Linux: `/opt/cf-bypass/`, **macvlan** — отдельный интерфейс, IP в подсети роутера (CONTAINER_IP)
  - macOS: `~/cf-bypass/`, **bridge** (macvlan не поддерживается) — своя подсеть, статический IP
- Параметризация через .env (NETWORK_SUBNET, NETWORK_GATEWAY, NETWORK_PARENT, CONTAINER_IP, ENV_TAG, etc.)
- test.yml остаётся отдельным — деплой не зависит от тестов
- Порт на хост не мапится — нет конфликтов с другими проектами в Docker

## Fork History

Refactored from tor-socks-proxy-service CI/CD template

## Next Actions

1. On each runner: create deploy dirs, copy .env.example → .env, set NETWORK_* and CONTAINER_IP
2. On macOS runners: add docker-compose.override.yml with driver: bridge
3. Push to dev/stage/prod (or use workflow_dispatch) to verify deploy
