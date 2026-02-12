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
  - Linux: `/opt/cf-bypass/`, real IPs (10.0.0.x)
  - macOS: `~/cf-bypass/`, loopback aliases (127.0.0.2, 127.0.0.3) или host IPs
- Параметризация через .env (PORT, BIND_IP, ENV_TAG, BROWSER_LIMIT, etc.)
- test.yml остаётся отдельным — деплой не зависит от тестов
- IP-адреса указываются вручную в .env на каждом сервере

## Fork History

Refactored from tor-socks-proxy-service CI/CD template

## Next Actions

1. Review specifications (02-specifications.md)
2. Получить approval на specifications
3. Review plan (03-plan.md)
4. Получить approval на plan
5. Начать implementation
