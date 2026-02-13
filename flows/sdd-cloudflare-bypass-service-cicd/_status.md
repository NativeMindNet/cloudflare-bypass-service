# Status: sdd-cloudflare-bypass-service-cicd

## Current Phase

SPECIFICATIONS

## Phase Status

DRAFTED

## Last Updated

2026-02-12 by Claude

## Blockers

- None

## Progress

- [x] Requirements drafted
- [x] Requirements approved
- [x] Specifications drafted
- [ ] Specifications approved
- [x] Plan drafted
- [ ] Plan approved
- [ ] Implementation started
- [ ] Implementation complete

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

1. Review specifications (02-specifications.md)
2. Получить approval на specifications
3. Review plan (03-plan.md)
4. Получить approval на plan
5. Начать implementation
