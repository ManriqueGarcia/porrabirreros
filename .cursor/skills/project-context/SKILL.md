---
name: project-context
description: >-
  Porra Birreros: SPA React+Tailwind, Lambda+DynamoDB, tests y despliegue.
  Leer este skill para contexto; evitar README salvo UX/docs o diagramas.
---

# Porra Birreros — contexto (compacto)

SPA porras **F1 + fútbol**, multi-tenant (grupos), login global. Perdedor invita birras.

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

- `src/App.jsx`, `api.js`, `scoring.js`, `futbol-utils.js`, `config.js` / `config.local.js` (gitignored)
- `porra-state-api.mjs` — auth Bearer, rate limits, rutas `/auth`, `/groups`, `/g/{id}/…`
- `porra-ai.mjs` — asistente
- **Scoring duplicado**: `src/scoring.js` y `lib/scoring.mjs` — **misma lógica**; tocar **ambos** si cambia puntuación F1
- **Legacy Lambda GET/PUT**: en repo, `porra-get.mjs` = lógica **PUT**; `porra-put.mjs` = **GET** (nombres cruzados). El script de deploy mapea bien a `porra-get` / `porra-put` en AWS.

## Dominio (mínimo)

- **F1**: pole + podio + 3 preguntas; scoring en `scoring.js`; apuesta ciega post-quali; penalizaciones -3/-2/-1
- **Fútbol**: jornadas N partidos; `futbol-utils.js`; +3 exacto, +1 signo, etc.
- **DynamoDB** (tabla única `pk`,`sk`): `UIDX#user`, `GROUPS`, `G#{gid}#USER|…`, `F1#…|BET#…`, `FUT#…|BET#…` — detalle en código/README si hace falta

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

## Seguridad (recordatorio)

- No confiar en cliente para `late`, deadlines, permisos — validar en Lambda
- `isValidUserName` / `isValidId` en rutas; CORS `ALLOWED_ORIGIN`

## Más detalle

README (arquitectura mermaid, onboarding), CHANGELOG (historial), `docs/`, `architecture.drawio.xml`.
