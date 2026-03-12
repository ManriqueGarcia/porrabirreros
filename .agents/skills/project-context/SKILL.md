---
name: project-context
description: >-
  Provides comprehensive context about the Porra Birreros project: architecture,
  tech stack, domain logic, file structure, conventions, and workflows. Use at
  the start of any coding session, when onboarding to the project, or when the
  agent needs to understand the codebase before making changes.
---

# Porra Birreros — Contexto del Proyecto

## Resumen

Aplicacion web (SPA) para gestionar **porras de Formula 1 y Futbol** entre amigos. El perdedor invita a birras. Multi-tenant: varios grupos independientes con login global.

## Stack tecnologico

| Capa | Tecnologia |
|------|-----------|
| Frontend | React 18 (JSX, sin TSX), Tailwind CSS v4, glassmorphism UI |
| Build | esbuild (bundle + minify) + @tailwindcss/cli, script custom `build.mjs` |
| Backend | AWS Lambda (Node.js ESM), API Gateway REST |
| AI | Google AI API (Gemma 3 27B) para futbol, Jolpica/Ergast API para F1 historico |
| Storage | DynamoDB (tabla unica, clave compuesta pk/sk, multi-tenant) + localStorage (cache) |
| Hosting | S3 + CloudFront (CDN + HTTPS) |
| CI/CD | GitHub Actions: push a `main` → build → s3 sync → CloudFront invalidation |
| Tests | Vitest (unit + API funcional), Playwright (e2e) |

## Estructura de archivos clave

```
src/
├── index.jsx              Entry point React (ReactDOM.createRoot)
├── config.js              Config generica (placeholder) — se sustituye por config.local.js en build
├── api.js                 Cliente REST: auth, fetch/save estado, ETag caching
├── scoring.js             Puntuacion F1: scoreForRace, computeGlobalStandings, desempates
├── futbol-utils.js        Puntuacion futbol: scoreFutbolJornada, computeFutbolStandings
├── utils.js               Hash SHA-256, fechas, sesion, export CSV/PDF, share
├── f1-data.js             NLP + datos historicos F1 (Jolpica API)
├── i18n.jsx               Contexto de idioma (es/en)
├── toast.jsx              Sistema de notificaciones
├── confetti.js            Animacion de celebracion
└── components/
    ├── App.jsx             Root: routing, estado global, sync con backend, tabs
    ├── Auth.jsx            Login, cambio password, cambio avatar
    ├── Participante.jsx    Apuestas F1 (countdown, formulario, compartir)
    ├── BetForm.jsx         Formulario apuesta F1 (pole, podio, preguntas)
    ├── FutbolParticipante.jsx  Apuestas futbol
    ├── FutbolBetForm.jsx   Formulario apuesta futbol
    ├── Ranking.jsx         Ranking F1 + desglose + resumen post-carrera
    ├── FutbolRanking.jsx   Ranking futbol + grafico evolucion
    ├── Stats.jsx           Estadisticas F1 (birras, tendencia, suerte, simulador)
    ├── FutbolStats.jsx     Estadisticas futbol
    ├── AdminPanel.jsx      Panel admin unificado (tabs General/F1/Futbol)
    ├── Admin.jsx           Panel admin F1 (resultados, preguntas)
    ├── FutbolAdmin.jsx     Panel admin futbol (jornadas, resultados)
    └── [+15 componentes]   HeadToHead, Achievements, Rivalries, Charts, etc.

porra-state-api.mjs        Lambda backend (~1500 lineas): rutas REST, DynamoDB, auth, rate limiting
porra-ai.mjs               Lambda AI: ManriBot con Gemma/Gemini
build.mjs                  Build script: esbuild + Tailwind + asset hashing + gzip + .env injection
tests/                     3 test files: scoring.test.mjs, futbol-scoring.test.mjs, api-functional.test.mjs
e2e/                       Playwright: user-flow.spec.mjs, admin-flow.spec.mjs
```

## Dominio y logica de negocio

### Porra F1

- Apuestas: pole, podio (3 pilotos), 3 preguntas con autor rotativo
- Puntuacion (`scoring.js`): +1 por acierto, +2 bonus pole+podio, +2 bonus pleno (pole+podio+preguntas)
- Penalizaciones: -3 no apostar, -2 fuera de plazo, -1 apuesta incompleta
- **Apuesta ciega**: no ves las de otros hasta despues de quali
- Desempate: puntos → victorias GP → podios exactos → aciertos → menos penalizaciones → apuesta mas temprana

### Porra Futbol

- N partidos por jornada (configurable por admin)
- Puntuacion (`futbol-utils.js`): +3 exacto, +1 signo correcto, 0 fallo, -1 catastrofica (0 pts sin late)
- Penalizaciones: -3 no apostar, -2 fuera de plazo
- Desempate: puntos → victorias → exactos → signos → menos penalizaciones → menor diferencia goles → apuesta mas temprana

### Multi-tenancy

- Login global: POST `/auth/login` devuelve token + lista de grupos del usuario
- Cada grupo tiene datos aislados (prefijo `G#{groupId}` en DynamoDB)
- Admin roles granulares: general (usuarios), F1, futbol
- Invite code obligatorio para unirse a un grupo

## Backend API (porra-state-api.mjs)

Lambda unica con routing interno. Patron: API Gateway → Lambda → DynamoDB.

### Rutas principales

| Prefijo | Ejemplos | Notas |
|---------|----------|-------|
| `/auth/*` | login, verify | Rate limited (10 req/min/IP) |
| `/groups/*` | create, join, list | Rate limited |
| `/g/{groupId}/state` | GET estado completo | ETag + 304 Not Modified |
| `/g/{groupId}/bets/*` | PUT apuesta F1/futbol | Valida permisos + deadline server-side |
| `/g/{groupId}/results/*` | PUT resultado | Solo admin |
| `/g/{groupId}/users/*` | CRUD usuarios | Admin o propio usuario |

### DynamoDB — Tabla unica (pk, sk)

- `UIDX#nombre_lower` + `G#groupId` → indice de usuario global
- `GROUPS` + `G#groupId` → metadata del grupo
- `G#{groupId}` + `USER#nombre|PROFILE` → perfil del usuario
- `G#{groupId}` + `F1#raceKey|BET#nombre` → apuesta F1
- `G#{groupId}` + `FUT#jornadaId|BET#nombre` → apuesta futbol

## Configuracion y build

### Archivos locales (gitignored)

- `src/config.local.js`: participantes reales, hashes, colores, equipos
- `.env`: URLs de produccion (PORRA_API_BASE, PORRA_AI_URL, PORRA_DOMAIN)

### Como funciona el build (`build.mjs`)

1. Lee `.env` e inyecta URLs en HTML (CSP, og:url, preconnect, window.*)
2. Si existe `config.local.js`, plugin esbuild redirige imports de `config.js` → `config.local.js`
3. esbuild: bundle src/index.jsx → dist/app.[hash].js (minified, sourcemap)
4. Tailwind CLI: src.css → dist/styles.[hash].css (minified)
5. Copia assets, genera gzip, optimiza imagenes

### Variables de entorno Lambda

| Lambda | Variables |
|--------|-----------|
| State | TABLE_NAME, ALLOWED_ORIGIN, API_SECRET |
| AI | GEMINI_API_KEY, ALLOWED_ORIGIN |

## Entornos

| Entorno | URL | Rama | CloudFront |
|---------|-----|------|------------|
| Produccion | https://porra.manriquegarcia.com | `main` | deploy automatico en push |
| Desarrollo | https://dev.porra.manriquegarcia.com | `dev` | deploy automatico en push |

- Ambos entornos comparten las mismas Lambdas (state + AI). `ALLOWED_ORIGIN` acepta multiples origenes comma-separated
- `.env` y `config.local.js` son locales (gitignored). En CI se restaura `config.local.js` desde S3 y las URLs se inyectan via secrets/fallbacks en el workflow
- Flujo de trabajo: desarrollar en `dev`, probar en dev.porra, merge a `main` para produccion

## Comandos de desarrollo

```bash
node build.mjs             # Build completo → dist/
npx serve dist             # Preview local
npm test                   # Vitest (unit + API funcional, 124+ tests)
npm run test:e2e           # Playwright e2e
npm run lint               # ESLint
```

## Convenciones del proyecto

- **Idioma del codigo**: nombres de variables y funciones en ingles, comentarios y UI en espanol
- **Modulos ES**: todo el proyecto usa ESM (import/export), no CommonJS
- **React sin TSX**: JSX puro, sin TypeScript
- **Tests**: Vitest con `.test.mjs`, Playwright con `.spec.mjs` en `e2e/`
- **Git**: Conventional Commits (feat/fix/refactor/etc), rama `dev` para desarrollo, `main` para produccion
- **Seguridad**: nunca commitear config.local.js, .env, credenciales. Validar inputs server-side siempre
- **No Next.js**: es una SPA vanilla con esbuild, sin SSR ni framework
- **Styling**: Tailwind v4 utility-first, glassmorphism, dark/light mode con CSS variables

## Seguridad — puntos clave

- passwordHash nunca se envia al cliente (sanitizeState)
- Validacion server-side de permisos en cada escritura
- Rate limiting por IP en endpoints sensibles
- isValidId y isValidUserName previenen inyeccion en claves DynamoDB
- CSP dinamico generado en build
- Sesiones con token aleatorio + TTL

## Referencia adicional

Para detalles tecnicos mas profundos (esquema DynamoDB completo, scoring detallado, API completa), ver [reference.md](reference.md).
