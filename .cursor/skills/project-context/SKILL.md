---
name: project-context
description: >-
  Porra Birreros: SPA React+Tailwind, Lambda+DynamoDB, tests y despliegue.
  Leer este skill para contexto; evitar README salvo UX/docs o diagramas.
---

# Porra Birreros — contexto (compacto)

SPA porras **F1 + fútbol La Liga + Mundial 2026**, multi-tenant (grupos), login global. F1/fútbol: perdedor invita birras; Mundial: premio solo al final (bocata).

## Stack

| Capa | Tecnología |
|------|------------|
| UI | React 18 JSX, Tailwind v4, ESM |
| Build | `build.mjs` (esbuild app, Tailwind CLI, hash, gzip, inyecta `.env` en HTML) |
| API | `porra-state-api.mjs` (Lambda **nodejs24.x**, API Gateway REST, DynamoDB) |
| AI | `porra-ai.mjs` (Lambda eu-west-1; Gemini/OpenAI + Ergast/Jolpica según modo) |
| Hosting | S3 + CloudFront; CI: push `main`/`dev` → Actions → sync S3 |
| Tests | Vitest (`tests/*.test.mjs`), Playwright (`e2e/*.spec.mjs`) |

## Rutas de código (prioridad)

- `src/App.jsx`, `api.js`, `scoring.js`, `futbol-utils.js`, `mundial-utils.js`, `lib/mundial-fixtures.mjs`, `config.js` / `config.local.js` (gitignored)
- `porra-state-api.mjs` — auth Bearer, rate limits, rutas `/auth`, `/groups`, `/g/{id}/…`
- `porra-ai.mjs` — asistente
- **Scoring duplicado**: `src/scoring.js` y `lib/scoring.mjs` — **misma lógica**; tocar **ambos** si cambia puntuación F1
- **Legacy Lambda GET/PUT**: en repo, `porra-get.mjs` = lógica **PUT**; `porra-put.mjs` = **GET** (nombres cruzados). El script de deploy mapea bien a `porra-get` / `porra-put` en AWS.

## Dominio (mínimo)

- **F1**: pole + podio + 3 preguntas; scoring en `scoring.js`; apuesta ciega post-quali; penalizaciones -3/-2/-1
- **Fútbol**: jornadas N partidos; `futbol-utils.js`; +3 exacto, +1 signo, etc.
- **Mundial 2026**: `mundial-utils.js` + calendario en `lib/mundial-fixtures.mjs`; mismas penalizaciones que fútbol; KO: bonus prórroga/penaltis; participantes = `porras.mundial` (migración desde fútbol).
- **DynamoDB** (tabla única `pk`,`sk`): `UIDX#user`, `GROUPS`, `G#{gid}#USER|…`, `F1#…`, `FUT#…`, `MUN#…` — detalle en código/README si hace falta

## Comandos (obligatorios antes de “listo”)

```bash
npm run test:unit   # scoring + fútbol + carreras canceladas (regla workspace)
npm run build
npm run test:api    # opcional si tocas API
npm run test:e2e    # opcional, lento
```

```bash
npm run deploy:lambda   # sube Lambdas (esbuild); AWS_PROFILE o perfil default
```

## Config / secretos

- No commitear: `src/config.local.js`, `.env`, credenciales
- Lambda state: `TABLE_NAME`, `ALLOWED_ORIGIN`, `API_SECRET`; AI: `GEMINI_API_KEY` / `OPENAI_API_KEY`, `ALLOWED_ORIGIN`

## Convenciones

- ESM; nombres código en inglés, UI/comentarios español
- Commits: Conventional Commits; `dev` → probar; `main` → prod (promoción con tests Red-Green si aplica reglas)

## Logging / Observabilidad

### Backend (Lambda `porra-state-api.mjs`)

Función `log(level, action, data)` emite JSON estructurado a CloudWatch. Nivel configurable con env `LOG_LEVEL` (debug/info/warn/error; default `info`).

| action | level | Cuándo |
|--------|-------|--------|
| `bet_f1_saved` | info | Apuesta F1 guardada (raceKey, user, late, pole) |
| `bet_f1_reject` | warn | Apuesta F1 rechazada (reason: missing_params/invalid_raceKey/cancelled/incomplete/validation/closed/no_user) |
| `bet_futbol_saved` | info | Apuesta fútbol guardada (jornadaId, user, late, matchCount) |
| `bet_futbol_reject` | warn | Apuesta fútbol rechazada (reason similar) |
| `auth_login` | info | Login exitoso (user, groupCount) |
| `auth_reject` | warn | Login rechazado antes de verificar (no_username/no_password/no_groups) |
| `auth_fail` | warn | Login fallido tras verificar credenciales (user, groupCount) |
| `session_expired` | warn | Token de sesión expirado (ip, method, path) |
| `lambda_unhandled` | error | Error no capturado (method, path, user, error, stack) |

Consultas CloudWatch:

```bash
aws logs filter-log-events --log-group-name /aws/lambda/porra-state-api --filter-pattern '"bet_f1_saved" "Carlos"'
aws logs filter-log-events --log-group-name /aws/lambda/porra-state-api --filter-pattern '"bet_f1_reject"'
aws logs filter-log-events --log-group-name /aws/lambda/porra-state-api --filter-pattern '"session_expired"'
```

### Frontend (consola del navegador)

| tag | Cuándo |
|-----|--------|
| `[API_NETWORK_FAIL]` | `fetch` falla por red (offline, DNS, timeout) |
| `[API_SESSION_EXPIRED]` | API devuelve 401 |
| `[API_ERROR]` | API devuelve cualquier otro error HTTP |
| `[BET_F1_FAIL]` | Error al guardar apuesta F1 (user, raceKey, error, ts) |
| `[BET_FUTBOL_FAIL]` | Error al guardar apuesta fútbol (user, jornadaId, error, ts) |

## Seguridad (recordatorio)

- No confiar en cliente para `late`, deadlines, permisos — validar en Lambda
- `isValidUserName` / `isValidId` en rutas; CORS `ALLOWED_ORIGIN`

## Más detalle

README (arquitectura mermaid, onboarding), CHANGELOG (historial), `docs/`, `architecture.drawio.xml`.
