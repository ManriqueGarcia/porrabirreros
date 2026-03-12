# Referencia Tecnica — Porra Birreros

## Scoring F1 detallado (scoring.js)

### scoreForRace(db, raceKey, name)

Calcula puntos de un usuario para una carrera:

| Concepto | Puntos |
|----------|--------|
| Acierto de pole | +1 |
| Acierto de cada posicion del podio (3) | +1 cada |
| Acierto de cada pregunta (3) | +1 cada |
| Bonus: pole + podio completo | +2 |
| Bonus: pleno (pole + podio + preguntas) | +2 adicional |
| No apostar (con resultados publicados) | -3 |
| Apuesta fuera de plazo (late) | -2 |
| Apuesta incompleta (sin pole ni podio) | -1 |
| Ajuste manual del admin | ±N |

Maximo teorico por carrera: 1 (pole) + 3 (podio) + 3 (preguntas) + 2 (bonus) + 2 (pleno) = **11 pts**

### computeGlobalStandings(db, races, participants)

Ordena por desempate encadenado:
1. Total de puntos (descendente)
2. Victorias de GP (descendente)
3. Podios exactos (descendente)
4. Aciertos totales (descendente)
5. Menos penalizaciones (ascendente)
6. Apuesta mas temprana en promedio (ascendente)

### computeGPWins(db, races, participants)

Cuenta cuantas carreras ha ganado cada usuario (ganador unico = mayor puntuacion en esa carrera).

## Scoring Futbol detallado (futbol-utils.js)

### scoreFutbolJornada(db, jornadaId, name)

| Concepto | Puntos |
|----------|--------|
| Resultado exacto por partido | +3 |
| Signo correcto (1/X/2) | +1 |
| Fallo | 0 |
| No apostar | -3 |
| Fuera de plazo | -2 |
| Catastrofica (hasBet, !late, 0 pts en partidos) | -1 |

### computeFutbolStandings(dbFutbol, jornadas, participants)

Desempate:
1. Puntos totales
2. Victorias de jornada
3. Exactos totales
4. Signos totales
5. Menos penalizaciones
6. Menor diferencia acumulada de goles
7. Apuesta mas temprana en promedio

## Esquema DynamoDB completo

Tabla unica `PorraBirreros` con pk (partition key, String) y sk (sort key, String).

### Entidades globales

| pk | sk | Campos |
|----|-----|--------|
| `UIDX#nombre_lower` | `G#groupId` | groupId, groupName, joinedAt, username |
| `GROUPS` | `G#groupId` | name, inviteCode, sports, memberCount, createdAt |
| `INVITE#code` | `META` | groupId, groupName |
| `SESSION#token` | `DATA` | username, createdAt, TTL |

### Entidades por grupo (pk = `G#{groupId}`)

| sk | Campos |
|----|--------|
| `META\|CONFIG` | drivers, teams, championships, basePoints, season |
| `META\|AVATARS` | avatares base64 por usuario |
| `META\|QUESTIONS` | preguntas F1 por carrera (raceKey → array) |
| `USER#nombre\|PROFILE` | passwordHash, isAdmin, adminRoles, blocked, porras, avatar |
| `F1#raceKey\|RESULT` | pole, podium, qAnswers |
| `F1#raceKey\|BET#nombre` | pole, podium, q, submittedAt, late, bravuconada |
| `F1#raceKey\|WINDOW` | forceClosed, forceOpen |
| `FUT#jornadaId\|CONFIG` | matches (array de {home, away}), deadline |
| `FUT#jornadaId\|RESULT` | matches (array de {home, away} con scores) |
| `FUT#jornadaId\|BET#nombre` | matches (predictions), submittedAt, late, bravuconada |
| `FUT#jornadaId\|WINDOW` | forceClosed, forceOpen |

## API endpoints completa

### Auth y grupos

```
POST /auth/login         → { token, groups, username }
POST /auth/verify        → { valid: true }
GET  /users/{name}/groups → [{ groupId, groupName }]
GET  /groups/list        → [{ groupId, name, memberCount }]  (admin only)
POST /groups             → { groupId, inviteCode }
POST /groups/{gid}/join  → { success: true }
GET  /invite/{code}      → { groupId, groupName }
```

### Multi-tenant (prefijo /g/{groupId})

```
GET    /g/{gid}/state                    → estado completo sanitizado (ETag)
PUT    /g/{gid}/bets/f1/{raceKey}        → guardar apuesta F1
PUT    /g/{gid}/bets/futbol/{jornadaId}  → guardar apuesta futbol
PUT    /g/{gid}/results/f1/{raceKey}     → guardar resultado F1 (admin)
PUT    /g/{gid}/results/futbol/{jornadaId} → guardar resultado futbol (admin)
PUT    /g/{gid}/users/{name}             → modificar perfil
POST   /g/{gid}/users                    → crear usuario (admin)
DELETE /g/{gid}/users/{name}             → eliminar usuario (admin)
PUT    /g/{gid}/meta                     → config general (admin)
PUT    /g/{gid}/admin/f1/{raceKey}       → ops admin F1 (admin)
PUT    /g/{gid}/admin/futbol/{jornadaId} → ops admin futbol (admin)
```

### Headers

- `Authorization: Bearer <token>` en todas las peticiones autenticadas
- `If-None-Match: <etag>` en GET /state para caching condicional
- Response incluye `ETag` para 304 Not Modified

## Estado del frontend (App.jsx)

El estado global vive en `App.jsx` con `useState`:
- `db`: estado completo del grupo (bets, results, users, meta, futbol)
- `user`: usuario logueado
- `group`: grupo activo
- `mode`: "f1" | "futbol"
- `view`: "bet" | "ranking" | "stats" | "admin" | "rules" | "historico"

Sync con backend: `fetchRemoteState()` con ETag caching, polling cada 30s.

## Estructura de datos del estado (db)

```javascript
{
  participants: { nombre: { color, ... } },
  users: { nombre: { isAdmin, adminRoles, porras, blocked, avatar } },
  bets: { raceKey: { nombre: { pole, podium, q, submittedAt, late, bravuconada } } },
  results: { raceKey: { pole, podium, qAnswers } },
  betsWindow: { raceKey: { forceClosed, forceOpen } },
  questions: { raceKey: [...] },
  scoreAdjustments: { raceKey: { nombre: N } },
  futbol: {
    order: [jornadaId, ...],
    jornadas: { jornadaId: { matches: [{home, away}], deadline } },
    bets: { jornadaId: { nombre: { matches: [{home, away}], submittedAt, late } } },
    results: { jornadaId: { matches: [{home, away}] } },
    betsWindow: { jornadaId: { forceClosed, forceOpen } },
    questions: { jornadaId: { text, author } },
    questionsStatus: { jornadaId: "revealed" | null }
  },
  meta: { season, sports, ... }
}
```

## CI/CD — Workflows

### deploy-s3.yml (produccion)
Trigger: push a `main`
Steps: npm ci → npm audit → build.mjs → s3 sync → CloudFront invalidation
Secrets: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME, CLOUDFRONT_DISTRIBUTION_ID

### deploy-dev.yml (desarrollo)
Trigger: push a `dev` (o manual)
Similar a produccion pero apuntando a bucket/distribucion de dev.

## Patrones comunes en el codigo

### Validacion de inputs (backend)
```javascript
if (!isValidId(groupId)) return res(400, "groupId inválido");
if (!isValidUserName(name)) return res(400, "nombre inválido");
```

### Sanitizacion de estado
`sanitizeState()` elimina passwordHash y adminSecretHash antes de enviar al cliente.

### Rate limiting
```javascript
if (!checkRateLimit(`auth:${ip}`, AUTH_RATE_MAX)) return res(429, "Rate limited");
```

### ETag caching
GET /state calcula ETag con MD5 del JSON. Si `If-None-Match` coincide, devuelve 304.

### Config local override
En build, esbuild plugin redirige `import ... from "./config.js"` a `./config.local.js` si existe.
