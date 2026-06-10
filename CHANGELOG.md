# Changelog — Porra Birreros F1 & Fútbol

Todos los cambios relevantes del proyecto están documentados en este archivo.

---

## [2026-05-26] — Porra Mundial FIFA 2026

### Added

- Modo **WC** en la app: jornadas precargadas (grupos J1–J3, dieciseisavos, octavos, cuartos, semifinal, tercer puesto, final), partido de España + estrella por grupo, cruces TBD en eliminatorias, horarios España + local del estadio.
- Puntuación como fútbol (+3/+1, penalizaciones); en KO bonus opcional prórroga/penaltis (+1/+1/+2).
- Premio solo al final: cena de bocata para el campeon absoluto, invitada por el resto (sin birra por jornada).
- API DynamoDB `MUN#` y rutas `/bets|results|admin/mundial`; tests `tests/mundial-scoring.test.mjs`.

---

## [2026-05-12] — Horarios de fútbol automáticos (La Liga API)

### Fútbol

- **Lambda** (`porra-state-api.mjs`): al guardar una jornada (`admin/futbol` tipo `jornada`, legacy o grupo), si existe `FOOTBALL_DATA_ORG_TOKEN` se consulta [football-data.org](https://www.football-data.org/) y se rellenan `kickoff` ISO en partidos que vayan sin hora, emparejando local/visitante con el calendario (competición por defecto `PD`). Respuesta JSON opcional: `kickoffEnrichment`, `jornada`.
- **Módulo** `lib/laliga-fixtures.mjs`: normalización de nombres de club y merge; tests en `tests/laliga-fixtures.test.mjs`.
- **Admin UI** (`FutbolAdmin.jsx`): campo opcional «Jornada La Liga (1–38)» para acotar la API; textos de ayuda; toasts según relleno API.
- **Penalización catastrófica**: usuarios en `lib/futbol-cat-excluded.mjs` (p. ej. `Paula`) no reciben el -1 por «apuesta catastrófica»; reexport en `config.js`.

### Operativa

- **Quitar jornada fútbol en DynamoDB** (p. ej. J36 sin Sporting): `npm run remove:futbol-jornada -- --dry-run` (ver `scripts/remove-futbol-jornada.mjs`). Requiere `TABLE_NAME`, `PORRA_GROUP_ID` (o `--legacy`), opcional `PORRA_JORNADA_ID=J36`.

### Seed local

- **App.jsx**: eliminada Jornada 36 del listado inicial `futbolJornadasV3` (solo afecta entornos que aún no tenían `futbolJornadasV3`; producción ya migrada debe usar el script o admin).

### Documentación

- **README**: variables `FOOTBALL_DATA_ORG_TOKEN`, `FOOTBALL_DATA_COMPETITION_ID`, `FOOTBALL_DATA_DATE_RANGE_DAYS`.

---

## [2026-05-04] — Logging estructurado end-to-end

### Observabilidad

- **Backend**: función `log(level, action, data)` en `porra-state-api.mjs` emite JSON estructurado a CloudWatch para todas las operaciones de apuestas (F1 y fútbol), login, sesiones expiradas y errores no capturados. Nivel configurable con env `LOG_LEVEL`.
- **Frontend**: `api.js` logea errores de red (`[API_NETWORK_FAIL]`), sesiones expiradas (`[API_SESSION_EXPIRED]`) y errores HTTP (`[API_ERROR]`). Componentes `Participante.jsx` y `FutbolParticipante.jsx` logean `[BET_F1_FAIL]` / `[BET_FUTBOL_FAIL]` con contexto completo.

### Documentación

- **README.md**: nueva sección "Logging y observabilidad" con tabla de acciones, consultas CloudWatch y guía de diagnóstico.
- **SKILL.md**: sección compacta "Logging / Observabilidad" con referencia rápida.
- **`.cursor/rules/systematic-debugging.mdc`**: referencia a logs disponibles para investigación.

---

## [2026-04-30b] — Contexto IA más ligero

### Documentación

- **Skill** `.cursor/skills/project-context/SKILL.md` reescrito en formato compacto (menos tokens por sesión).
- **Regla** `.cursor/rules/project-context.mdc` acortada; eliminada referencia inexistente a `reference.md`.
- **README**: nota para IA apuntando al skill.

---

## [2026-04-30] — Lambda Node.js 24 + despliegue automatizado

### Infraestructura

- **AWS Lambda**: todas las funciones del proyecto (`porra-ai`, `porra-state-api`, `porra-state-api-dev`, `porra-get`, `porra-put`) actualizadas a runtime **`nodejs24.x`** y código redesplegado (bundle esbuild + zip).
- **Script** `scripts/deploy-aws-lambdas.mjs` y comando npm `deploy:lambda` para repetir el despliegue con AWS CLI (`--profile default` por defecto; sobrescribible con `AWS_PROFILE`).
- **Documentación**: `README.md`, `docs/ASISTENTE_AI.md` — runtime y flujo de despliegue alineados con AWS.

---

## [2026-03-11d] — Fix crash al cerrar sesión + trashtalk fútbol

### Bugfixes

- **Error React #300 al pulsar "Salir"**: `WelcomeBanner` tenía hooks (`useMemo`) después de early returns, violando las reglas de hooks. Al hacer logout, `user` pasaba a `""`, activaba el early return y React veía menos hooks que en el render anterior. Movidos todos los hooks antes de cualquier `return`.
- **Redirección durante render en `App`**: `window.location.hash = "#/"` se ejecutaba como side-effect durante render, causando posible `setState` durante render. Movido a `useEffect`.
- **Trashtalk no visible en fútbol**: `FutbolParticipante.saveBet` no incluía `payload.trashtalk` en el objeto `nextBet` del estado local, por lo que la bravuconada no se mostraba tras guardar (ya desplegado en la iteración anterior).

### Mantenimiento

- **Service Worker v3**: actualizado `CACHE_NAME` para forzar limpieza de caché.

### Archivos modificados
- `src/components/WelcomeBanner.jsx` — Hooks movidos antes de early returns
- `src/components/App.jsx` — Redirects movidos a useEffect
- `src/components/FutbolParticipante.jsx` — trashtalk incluido en nextBet
- `sw.js` — Cache name v3

---

## [2026-03-11c] — Fix responsive: gradientes y navegación móvil

### Bugfixes

- **Gradientes de títulos rotos en móvil**: `background-clip: text` fallaba en GPUs móviles dentro de contenedores con `backdrop-filter`, produciendo un gradiente negro-a-rojo ilegible. En pantallas < 641px ahora se usa texto blanco sólido; el gradiente decorativo se mantiene solo en desktop.
- **Menú superior visible en móvil**: la regla CSS `display:flex` en `.porra-nav` sobreescribía la clase Tailwind `hidden md:flex`. Eliminado `display:flex` del CSS custom para que la bottom nav sea la única navegación en móvil.
- **Scroll al cambiar de vista**: añadido `window.scrollTo(0, 0)` al cambiar de pestaña para que siempre se muestre la parte superior del contenido.

### Mantenimiento

- **Service Worker v2**: actualizado `CACHE_NAME` de `porra-v1` a `porra-v2` para forzar limpieza de caché antigua en todos los navegadores.

### Archivos modificados
- `src.css` — Gradientes section-title solo desktop, eliminado display:flex de .porra-nav, light theme fix
- `src/components/App.jsx` — Scroll-to-top en cambio de vista, header móvil simplificado
- `sw.js` — Cache name v2

---

## [2026-03-11b] — Bravuconadas, Muro de la vergüenza y Birrómetro

### Nuevas funcionalidades

- **Bravuconadas (trash-talk)**: campo opcional de texto (máx. 120 caracteres) en los formularios de apuesta de F1 y Fútbol. El mensaje se guarda con la apuesta y se revela tras la publicación de resultados. Visible en la apuesta propia, en las apuestas de otros (post-resultados) y en el resumen del último GP del ranking F1 (con icono 🤡 para quien quedó mal y 😏 para el resto).

- **Muro de la vergüenza**: nuevo bloque en Estadísticas (F1 y Fútbol) que destaca con humor las peores predicciones. Incluye: peor puntuación individual (💀), rey del farolillo rojo (🥄), siempre tarde (🐌), el fantasma (👻) y bravuconadas fallidas (🗣️) — cuando alguien deja un trashtalk y acaba en la parte baja del ranking del evento. Frases de vergüenza aleatorias.

- **Birrómetro**: visualización del balance neto de birras por participante. Muestra cuántas te deben vs cuántas debes con barras bidireccionales (verde = positivo, rojo = negativo) y emojis contextuales (😎/😰/😅/😐). Excluye usuarios en BEER_EXCLUDED_USERS.

### UX

- **Menú móvil simplificado**: eliminada la barra de usuario duplicada en móvil (avatar + contraseña + salir), ya que la bottom nav cubre toda la navegación. Los botones de contraseña y salir quedan integrados en el header de forma compacta.

### Archivos nuevos
- `src/components/WallOfShame.jsx` — Muro de la vergüenza
- `src/components/Birrometro.jsx` — Balance neto de birras

### Archivos modificados
- `src/components/BetForm.jsx` — Campo trashtalk en apuestas F1
- `src/components/FutbolBetForm.jsx` — Campo trashtalk en apuestas Fútbol
- `src/components/Participante.jsx` — Revelado de bravuconadas en apuestas de otros
- `src/components/FutbolParticipante.jsx` — Revelado de bravuconadas en apuestas de otros
- `src/components/Ranking.jsx` — Sección de bravuconadas en resumen último GP
- `src/components/Stats.jsx` — Integración WallOfShame y Birrometro
- `src/components/FutbolStats.jsx` — Integración WallOfShame y Birrometro
- `src/components/App.jsx` — Eliminado menú responsive duplicado

---

## [2026-03-11] — Dinamismo, engagement y UX móvil (8 funcionalidades)

### Nuevas funcionalidades

- **Bottom navigation móvil** (#6): barra de navegación fija en la parte inferior de la pantalla en dispositivos móviles (md:hidden). Incluye Apuesta, Ranking, Stats, Preguntas (F1), Normas, Admin y ManriBot. La nav superior se oculta en móvil. Soporte para tema claro, safe-area-inset y modo F1/Fútbol con colores diferenciados.

- **Rivalidades automáticas** (#17): detección automática de los 3 pares de participantes que más compiten cabeza a cabeza. Algoritmo basado en cercanía en puntos (40%), equilibrio de victorias H2H (40%) y similitud de apuestas (20%). Visualización con barra comparativa, victorias H2H, empates e intensidad. Funciona para F1 (pole/podio) y Fútbol (signo de partidos). Requiere 2+ eventos y 3+ participantes.

- **Comparativa Tú vs Amigo** (#11): selector de rival con comparación directa en Stats (F1 y Fútbol). Muestra barra de puntos, grid de estadísticas (puntos, victorias, empates, aciertos, exactos) y mini-gráfico SVG de evolución por evento con barras duales.

- **Skeleton loaders** (#8): esqueletos animados con pulso que reemplazan el texto "Conectando con el servidor..." durante la carga inicial. Incluye SkeletonNav (barra de tabs) y SkeletonPage (2 tarjetas con filas de avatar + texto).

- **Logros/achievements** (#15): sistema de logros desbloqueables por participante. 12 logros F1 (primera apuesta, primera victoria, tricampeón, vidente de poles, hat-trick poles, pleno, en racha ×3, imparable ×5, rey de birras, nunca fallo, remontada, podio perfecto) y 10 logros fútbol (primera apuesta, primera victoria, exacto, coleccionista de exactos, jornada perfecta, en racha, rey de birras, nunca fallo, signólogo, remontada). Barra de progreso, selector de usuario, diseño con gradientes y estados bloqueado/desbloqueado.

- **Swipe entre vistas en móvil** (#9): detección de swipe horizontal en el contenedor principal para cambiar de pestaña. Threshold de 60px mínimo, ángulo máximo de 70% respecto al vertical, velocidad máxima de 400ms. Navega secuencialmente entre Apuesta → Ranking → Stats → Preguntas → Normas.

- **Historial personal con timeline** (#16): timeline vertical visual para cada participante con puntos de color según resultado (verde=positivo, rojo=negativo, dorado=pleno, gris=neutro). Muestra puntos del evento, posición en el evento, acumulado total, ranking acumulado, y badges (pole, podio exacto, pleno, exactos, signos, tarde, no apostó). Selector de usuario para ver el historial de cualquier participante. Funciona para F1 y Fútbol.

- **Animación cambio de posición en ranking** (#2): indicadores ▲N (verde), ▼N (rojo) y = (naranja) junto al nombre del participante en rankings F1 y Fútbol. Compara la posición actual con la que tendría sin el último evento completado. Animación popIn CSS. Requiere 2+ eventos completados.

### Archivos nuevos
- `src/components/HeadToHead.jsx` — Comparativa Tú vs Amigo
- `src/components/Skeleton.jsx` — Skeleton loaders
- `src/components/Achievements.jsx` — Logros/achievements
- `src/components/PersonalHistory.jsx` — Historial personal con timeline
- `src/components/Rivalries.jsx` — Rivalidades automáticas
- `src/components/BeerChart.jsx` — Gráfico de birras con jarras SVG
- `src/components/ShareRanking.jsx` — Imagen compartible del ranking

### Archivos modificados
- `src/components/App.jsx` — Bottom nav, skeleton, swipe, currentUser prop
- `src/components/Stats.jsx` — Integración HeadToHead, Achievements, PersonalHistory, Rivalries
- `src/components/FutbolStats.jsx` — Integración HeadToHead, Achievements, PersonalHistory, Rivalries
- `src.css` — Estilos bottom-nav, tema claro, safe-area

---

## [2026-03-10] — UX, rendimiento y lógica de birras

### UX — Rediseño visual

- **Horarios del GP en tres tarjetas**: la sección de horarios del GP se ha dividido en tres tarjetas visuales lado a lado (Clasificación azul, Carrera rojo, Preguntas ámbar) con gradientes, línea de acento y hover animado. Countdown badge debajo en barra separada.
- **Info jornada fútbol en tres tarjetas**: mismo diseño para fútbol (Partidos verde, Cierre ámbar, Estado azul).
- **Ranking F1 con conteo y ticks**: el selector de ranking F1 ahora muestra el número de carreras disputadas en la opción Global y un ✓ detrás de cada GP con resultados (como ya hacía fútbol).
- **Apuestas cerradas tras resultados completos**: cuando el admin publica todos los resultados (F1: pole + podio completo; fútbol: todos los marcadores), el estado pasa a "Cerrado" y se oculta el formulario de apuesta y el aviso de fuera de plazo. Resultados parciales no cierran las apuestas.

### Lógica de birras

- **El ganador recibe birras**: invertida la lógica — ahora los demás invitan al primero en la clasificación (antes el último pagaba).
- **Usuarios excluidos de birras**: ciertos usuarios pueden excluirse de la lógica de birras. Configurable en `BEER_EXCLUDED_USERS`.
- Actualizado en: Stats, WelcomeBanner, Ranking, FutbolRanking, Rules, LandingPage, App footer, Participante, FutbolParticipante.

### Rendimiento

- **ETag en GET /g/{groupId}/state**: el servidor computa un hash MD5 del estado y lo envía como ETag. Si el cliente envía `If-None-Match` y coincide, responde 304 sin body (ahorra ancho de banda y re-renders).
- **Polling adaptativo**: 60s con pestaña activa, 5 min en background, refresco inmediato al volver.
- **CountdownBadge con intervalo dinámico**: componente compartido con timeout adaptativo (1s < 2h, 10s < 12h, 60s > 12h). Deduplicado entre Participante y FutbolParticipante.
- **React.memo en charts**: PositionEvolutionChart, PointsTrendChart y FutbolEvolutionChart envueltos en memo para evitar re-renders innecesarios.
- **CORS actualizado**: expone ETag y acepta If-None-Match.

### Bugfixes

- **React error #31 en Stats**: `PointsTrendChart` renderizaba objetos `{name, scores}` como hijos React. Corregido accediendo a `p.name`.
- **Deploys CI/CD fallaban**: el paso "Restaurar config.local.js" abortaba si el archivo no existía en S3. Ahora advierte y usa config.js genérico como fallback.

---

## [2026-03-10] — Auditoría de seguridad completa + Skills de Cursor

### Seguridad — 27 fixes aplicados

#### CRITICAL
- **Eliminado fallback `x-porra-user`** — Ya no se acepta impersonación via header; se requiere Bearer token
- **Verificación de membresía en GET /g/{gid}/state** — Solo miembros del grupo pueden leer su estado
- **`npm audit` bloquea deploy** — CI/CD falla si hay vulnerabilidades críticas en dependencias

#### HIGH
- **GET /state legacy restringido a admin-only** — Previene full table scan por usuarios normales
- **Eliminado full table scan en `resolveUser`** — Ya no se hace Scan para case-insensitive; solo lookup directo y capitalizado
- **`npm audit` añadido a deploy-dev.yml** — Dev también audita dependencias
- **CloudFront ID como secreto en deploy-dev.yml** — Ya no está hardcoded
- **Build falla si `config.local.js` no se restaura** — Evita despliegue con hashes placeholder

#### MEDIUM
- **Try/catch en `decodeURIComponent`** — URLs malformadas devuelven 400 en vez de 500
- **Validación de resultados F1 y fútbol** — `validateF1Result` y `validateFutbolResult` aplicadas a todos los handlers de resultados
- **Rate limit en GET /invite** — Previene enumeración de códigos de invitación
- **`localStorage` residual → `sessionStorage`** — `index.html` ya no usa localStorage
- **`avatares_reales/` en .gitignore** — Fotos personales protegidas
- **URLs de API como secretos en workflows** — Con fallback a valores actuales

#### LOW
- Mensaje genérico en joinGroup (previene enumeración de usuarios)
- Validación de admin bets con validadores existentes
- Log seguro (solo message, no stack trace completo)
- SVG avatars deshabilitados — solo formatos raster (JPG, PNG, GIF, WebP)
- `clearSession` limpia todas las keys `porra_*`

### Skills instaladas (Cursor)
- **frontend-design** (anthropics) — Mejores prácticas de diseño React
- **systematic-debugging** (obra) — Depuración sistemática
- **test-driven-development** (obra) — TDD con Vitest
- **webapp-testing** (anthropics) — Testing de aplicaciones web
- **security-best-practices** (supercent-io) — Seguridad web OWASP
- **verification-before-completion** (obra) — Verificación obligatoria
- **git-commit** (github) — Conventional Commits

### Reglas de Cursor (`.cursor/rules/`)
7 reglas `.mdc` creadas para activar las skills en el proyecto.

---

## [2026-03-10] — Hardening: auth, CORS, validación, rate limiting, race conditions

### Vulnerabilidades corregidas
- **ALTA — Lectura del estado sin autenticación**: `GET /state` y `GET /g/{gid}/state` ahora requieren autenticación (session token o `x-porra-user`). Antes cualquiera podía leer todas las apuestas, usuarios y resultados.
- **ALTA — CORS permisivo**: cuando `ALLOWED_ORIGIN` está configurado (producción), el servidor ahora rechaza requests con origin distinto al permitido (403).
- **ALTA — Recovery code = password por defecto**: `RECOVERY_CODE_HASH` ahora tiene un valor distinto a `DEFAULT_PASSWORD_HASH` en el template, evitando que quien conozca la contraseña por defecto pueda usar el flujo de recuperación.
- **MEDIA — Sin validación de payload en apuestas**: ahora el servidor valida F1 (pole string max 100, podium max 5 drivers, preguntas max 10 × 500 chars) y fútbol (max 20 partidos, scores 0-99 enteros). Payloads malformados se rechazan con 400.
- **MEDIA — Race condition en join**: `handleJoinGroup` ahora usa conditional write (`attribute_not_exists`) para prevenir joins duplicados concurrentes.
- **MEDIA — migrate-to-group sobreescribía grupos**: ahora verifica que el grupo destino no exista antes de migrar.
- **MEDIA — Sin rate limiting en escrituras**: todos los endpoints `PUT`/`DELETE` ahora tienen rate limit de 30 req/min/IP.
- **MEDIA — targetUser sin validar**: rutas de usuario (`PUT /users/{name}`, `DELETE /users/{name}`) ahora validan el nombre con `isValidUserName`, evitando inyección en claves DynamoDB.
- **BAJA — Invite code sin validar**: ahora se valida formato alfanumérico y longitud máxima de 50 caracteres.

---

## [2026-03-10] — Seguridad: validación server-side de deadlines + auth con token

### Vulnerabilidades corregidas
- **CRITICA — Flag `late` controlado por el cliente**: el servidor aceptaba `late: true/false` directamente del body sin verificar. Un usuario podía apostar después del cierre y enviar `late: false` para evitar la penalización de -2 puntos. Ahora el servidor computa `late` comparando `new Date()` con el deadline almacenado en DynamoDB (fútbol: jornada config, F1: registro DEADLINE). También comprueba `betsWindow.forceClosed` y rechaza la apuesta si el admin ha cerrado las apuestas.
- **CRITICA — Suplantación de usuario via `x-porra-user`**: la identidad del usuario se tomaba del header sin verificación. Cualquiera que conociera el `API_SECRET` (o si estaba vacío) podía impersonar a cualquier usuario. Ahora `POST /auth/login` genera un token de sesión (256-bit, 24h TTL) almacenado en DynamoDB. El cliente envía `Authorization: Bearer <token>` y el servidor valida el token para derivar el username. Si el token es inválido/expirado, devuelve 401. Backward-compatible: sin token, usa `x-porra-user` (para scripts/tests).

### Cambios técnicos
- Nuevas funciones server-side: `createServerSession()`, `validateSession()`, `resolveF1Deadline()`, `resolveFutbolDeadline()`
- CORS headers actualizados para incluir `authorization`
- Frontend: `api.js` envía `Authorization: Bearer` automáticamente, gestiona sesión expirada con logout
- Frontend: `saveBetF1` envía `deadline` (cutoff de qualifying) para que el servidor lo almacene

---

## [2026-03-10] — Mejoras UX: fútbol y F1 responsive

### Fútbol
- **Jornada actual por defecto**: al entrar en la sección de fútbol, ahora se selecciona la primera jornada cuyo deadline aún no ha pasado (en vez de la primera de la lista). Si todas han pasado, se muestra la última.
- **Hora límite de apuestas → viernes 21:00**: cambiado el deadline por defecto de las jornadas de fútbol de 15:00 a 21:00, tanto en la configuración global como en el formulario de admin y en las jornadas predefinidas.

### F1
- **CircuitCard al final en móvil**: en pantallas pequeñas, la tarjeta de información del circuito se ha movido debajo del formulario de apuesta (antes estaba arriba y obligaba a hacer scroll para apostar).

---

## [2026-03-10] — Seguridad: eliminación de localStorage y fix CORS

### Seguridad
- **Eliminado localStorage**: todo el almacenamiento local (caché de DB, preferencias) migrado a sessionStorage o eliminado. Los datos van siempre contra la base de datos.
- **Fix login doble para admin**: corregido bug donde el admin siempre se le pedía la contraseña dos veces por un timestamp stale en localStorage.
- **Fix CORS en API Gateway**: configuración CORS de API Gateway actualizada para incluir POST y los headers custom necesarios.
- **Protección config.local.js**: los workflows de deploy excluyen `config.local.js` del `--delete` en s3 sync.

---

## [2026-03-05] — Segunda auditoria: bugs y seguridad

### Bugs corregidos
- **`queryByPk` sin paginacion**: si un grupo tenia mas de 1MB de items en DynamoDB, los items excedentes se perdian. Ahora usa `LastEvaluatedKey` para paginar correctamente.
- **`BatchWriteCommand` sin reintentos**: DynamoDB puede devolver `UnprocessedItems` en escrituras masivas. Ahora se reintentan hasta 3 veces con backoff, evitando perdida de datos.
- **`exportPDF` vulnerable a XSS**: los valores de celdas se inyectaban como HTML sin escapar. Ahora se usa `escapeHtml()` para sanitizar titulo, headers y contenido de celdas.
- **`processFutbolQuery` sin `x-porra-secret`**: las peticiones al ManriBot de futbol no incluian el header de autenticacion. Si se configura `API_SECRET` en la Lambda AI, el futbol dejaria de funcionar.

### Seguridad
- **Rate limiting server-side en auth**: `POST /auth/login`, `POST /auth/verify`, `POST /groups` (crear grupo) y `POST /groups/{gid}/join` ahora tienen rate limiting de 10 req/min/IP en el servidor, impidiendo ataques de fuerza bruta incluso sin frontend.
- **Mensajes de error genericos en login**: el backend ya no diferencia entre "usuario no encontrado" y "contraseña incorrecta". Ambos devuelven "Credenciales incorrectas", evitando enumeracion de usuarios.
- **Validacion de sports en creacion de grupo**: solo se aceptan "f1" y "futbol" como deportes validos, y se limita la longitud del nombre de grupo a 100 caracteres.

---

## [2026-03-05] — Auditoria de seguridad y hardening

### Vulnerabilidades corregidas
- **CRITICA — Hashes de contrasena expuestos**: `GET /state` y `GET /g/{gid}/state` devolvian `passwordHash` y `adminSecretHash` a todos los usuarios. Ahora se sanitizan con `sanitizeState()` antes de enviar la respuesta.
- **CRITICA — Join sin invite code**: `POST /groups/{gid}/join` no verificaba el codigo de invitacion. Cualquiera que conociera un `groupId` podia unirse sin invitacion. Ahora requiere `inviteCode` en el body y lo valida contra el almacenado.
- **CRITICA — PUT /state sin autenticacion**: `PUT /state` y `PUT /g/{gid}/state` permitian a cualquiera sobrescribir todo el estado. Ahora requieren admin. Ademas, preservan `passwordHash` existente si el payload no lo incluye.
- **ALTA — Endpoints destructivos sin auth**: `POST /seed-uidx/{gid}` y `POST /migrate-to-group` no requerian autenticacion. Ahora requieren admin.
- **ALTA — Enumeracion de grupos/usuarios**: `GET /users/{name}/groups` ahora requiere que el solicitante sea el propio usuario o admin. `GET /groups/list` ahora requiere admin.
- **ALTA — passwordHash en localStorage**: `saveGroupDB()` ahora elimina `passwordHash` y `adminSecretHash` antes de guardar en localStorage.
- **MEDIA — Inyeccion en claves DynamoDB**: añadida funcion `isValidId()` que valida que `groupId` solo contenga `[a-zA-Z0-9_-]` (max 50 chars). Validacion centralizada para todas las rutas `/g/{gid}/`.
- **BAJA — Error 500 filtraba detalles**: eliminado `detail: err.message` de la respuesta de error 500.

### Nuevas funcionalidades de seguridad
- **`POST /auth/verify`**: nuevo endpoint para verificar contraseña actual server-side, sin exponer el hash al frontend.
- **`sanitizeState()`**: funcion reutilizable que elimina campos sensibles (`passwordHash`, `adminSecretHash`) de objetos de estado.
- **`isValidId()`**: validacion de formato de IDs para prevenir inyeccion en claves DynamoDB.
- **ChangePasswordModal**: verificacion de contraseña actual via API (`POST /auth/verify`) en lugar de comparacion local con hash.
- **`setSaveRemoteUser()`**: el sync remoto debounced ahora envia `x-porra-user` para cumplir con la autenticacion requerida.

---

## [2026-03-05] — Multi-tenancy por usuario, login global y admin granular

### Multi-tenancy
- **Indice de usuarios (UIDX)**: nueva estructura en DynamoDB (`UIDX#nombre → G#groupId`) que mapea cada usuario a los grupos a los que pertenece.
- **Login global** (`POST /auth/login`): el usuario se autentica una vez con nombre + contraseña. El backend busca en todos sus grupos y devuelve los que coincidan. Lookup case-insensitive con prioridad al nombre capitalizado.
- **Grupo automatico**: si el usuario pertenece a un solo grupo, entra directamente. Si tiene varios, se muestra un selector de grupo.
- **Selector de grupo en header**: dropdown para cambiar entre grupos sin cerrar sesion (desktop y mobile).
- **Rutas multi-tenant**: todos los endpoints existentes duplicados con prefijo `/g/{groupId}/` para aislar datos por grupo.
- **Migracion UIDX**: endpoint `POST /seed-uidx/{groupId}` para crear entradas UIDX de usuarios existentes.
- **`GET /groups/list`**: lista todos los grupos disponibles (para admin).
- **`GET /users/{name}/groups`**: devuelve los grupos de un usuario.

### Admin granular
- **Roles por funcion**: `adminRoles: { general, f1, futbol }` reemplaza el booleano `isAdmin`. Backward-compatible.
- **AdminPanel unificado**: tabs General / F1 / Futbol visibles segun roles del usuario.
- **UserManagement**: toggles individuales por rol admin (GEN, F1, FUT) y por porra (F1, FUT).
- **Gestion de grupos**: boton "Grupos" en cada usuario para ver/añadir/quitar de grupos.
- **Helpers**: `admin-roles.js` con `isAdminFor()`, `hasAnyAdminRole()`, `getAdminRoles()`.
- **Migracion automatica**: usuarios con `isAdmin: true` sin `adminRoles` migran automaticamente a roles completos.

### Login y sesion
- **GlobalLogin**: pantalla de login centralizada en `#/` que autentica via API (no depende del estado del grupo).
- **Sesion con grupos**: `createSession(user, groups)` almacena la lista de grupos en la sesion.
- **mustChange**: si el usuario debe cambiar contraseña, se muestra modal `forceChange` al entrar (sin pedir contraseña actual).
- **Logout con redirect**: al cerrar sesion se redirige al login global y se limpia `porra_group_id`.

### Robustez
- **ErrorBoundary global**: componente React que captura errores de renderizado y muestra pantalla de recuperacion.
- **Fix React crash**: refactorizado `togglePorra` para evitar `toast.error()` dentro de state updater.
- **CloudFront**: añadidas rutas `/auth/*`, `/seed-uidx/*` para los nuevos endpoints.

---

## [2026-03-05] — DynamoDB, repositorio agnostico y seguridad server-side

### Backend DynamoDB
- **Migracion de S3 a DynamoDB**: el estado ya no se guarda como un unico JSON en S3, sino como items estructurados en DynamoDB.
- **Nueva Lambda `porra-state-api.mjs`**: API REST con rutas granulares (`/bets/f1/{race}`, `/results/f1/{race}`, `/users/{name}`, etc.).
- **Validacion server-side**: un usuario solo puede guardar sus propias apuestas; resultados y configuracion solo accesibles para admin.
- **Escrituras atomicas**: cada apuesta es un item independiente en DynamoDB, sin riesgo de sobreescritura.
- **Script de migracion**: `scripts/migrate-s3-to-dynamodb.mjs` para migrar datos existentes.

### Repositorio agnostico
- `src/config.js` ahora tiene valores genericos (Jugador1-5, hashes placeholder).
- Configuracion real en `src/config.local.js` (gitignored), con plugin esbuild que lo redirige transparentemente.
- URLs de produccion en `.env` (gitignored), inyectadas por `build.mjs` en el HTML.
- Avatares personales en `.gitignore` (solo `default.svg` en el repo).
- Eliminados todos los dominios, nombres y hashes del codigo fuente trackeado.

### Documentacion
- Diagrama SVG/PNG de infraestructura AWS con iconos y colores oficiales.
- README con documentacion completa del esquema DynamoDB y API endpoints.
- Guia de fork actualizada con nuevo flujo de configuracion local.

---

## [2026-03-05] — Desempates fútbol, birras condicionales y documentación

### Desempates fútbol
- Nuevo criterio final de desempate: **apuesta más temprana** (`avgSubmitTime`), equivalente al sistema F1.
- Orden completo: puntos → victorias → exactos → signos → menos pen. → menor dif. goles → apuesta más temprana.
- Nueva función `computeAvgFutbolSubmitTime` en `futbol-utils.js`.

### Birras condicionales
- **F1 Ranking**: no se muestra badge "🍺 paga las birras" ni podio si no hay GPs con resultados.
- **Fútbol Ranking**: misma lógica para jornadas sin resultados.
- **WelcomeBanner**: si no hay resultados, muestra un mensaje motivacional en vez de un ranking arbitrario.
- Caso de empate total con resultados: badge "🍺 todos pagamos" (ambos modos).

### Documentación
- `README.md` reescrito con arquitectura completa, estructura de archivos, stack y features.
- `CHANGELOG.md` actualizado.
- Diagrama de arquitectura draw.io (`architecture.drawio.xml` / `.svg`) para visualización.

---

## [2026-03-05] — Mega-features: estadísticas, simulador, tendencias y QoL

### Nuevas funcionalidades
- **Histórico de birras** 🍺: sección en Stats que muestra quién pagó las birras en cada GP + contador total por persona.
- **Tendencia de puntos por carrera** 📈: gráfico SVG de barras agrupadas con puntos por participante en cada GP.
- **Índice de suerte** 🍀: tabla con tasa de aciertos, eficiencia (pts/acierto), bonus, consistencia (σ), plenos y un índice combinado.
- **Simulador "¿Qué habría pasado si...?"** 🔮: modifica pole y podio de un GP y recalcula el ranking global con comparativa.
- **Mini-dashboard personal** 📊: tendencia de posición, estado de apuesta para próximo GP, puntos totales en el WelcomeBanner.
- **Banner recordatorio** ⏰: alerta si faltan <24h para el cierre y no has apostado.
- **Resumen post-carrera** 🏁: en Ranking, tarjeta con ganador, perdedor, aciertos de pole y plenos del último GP.

---

## [2026-03-05] — Mega-actualización: UX, rendimiento, features, build y PWA

### Nuevas funcionalidades
- **Dark/Light mode**: toggle de tema con persistencia en localStorage y CSS variables
- **Compartir apuesta**: botón "Compartir" usando Web Share API (con fallback WhatsApp), incluye respuestas a las 3 preguntas
- **Gráficos evolución fútbol**: chart SVG de posiciones por jornada (similar al de F1)
- **Predicción AI**: sugerencias 🔮 en ManriBot para predicciones F1 y fútbol
- **Multi-idioma (es/en)**: sistema i18n con React Context, traducciones para navegación principal
- **Exportar ranking CSV**: botón de descarga CSV en rankings F1 y fútbol
- **PWA**: Service Worker (cache stale-while-revalidate), manifest.json, instalable como app

### UX y Accesibilidad
- **Histórico multi-año**: selector dinámico (2025 → año actual) con manejo de 404
- **focus-visible**: outline amarillo en botones, links y navegación para teclado
- **aria-modal**: `role="dialog"`, `aria-modal`, `aria-labelledby` en modales
- **htmlFor/id**: labels asociados a inputs en Login, ChangePassword, ChangeAvatar
- **prefers-reduced-motion**: desactiva animaciones para quienes lo necesiten
- **Favicon**: emoji 🍺 como SVG inline
- **Meta OG**: description, og:title, og:description, theme-color
- **Noscript**: mensaje para usuarios sin JavaScript
- **Preconnect**: hints para APIs externas (Jolpica, backend, imágenes)

### Rendimiento
- **useMemo en races**: evita recálculo en cada render
- **useCallback en Participante**: BetForm onSubmit memorizado
- **colorOf memorizado**: useMemo + useCallback en PositionEvolutionChart
- **Asset hashing**: `app.[hash].js` y `styles.[hash].css` para cache-busting agresivo
- **Gzip pre-compresión**: archivos .gz generados en build (71-84% reducción)

### Arquitectura y código
- **CSS variables**: colores temáticos centralizados (:root)
- **Light theme CSS**: estilos para tema claro
- **Código muerto eliminado**: backupDefaults (JS), winner-shine, revving (CSS)
- **CONFIG object**: constantes centralizadas (participantes, timezone, equipos, etc.)
- **lib/scoring.mjs**: funciones puras de puntuación extraídas para tests

### Build y CI/CD
- **Error handling robusto en build.mjs**: try/catch en compilación JS y CSS
- **Gzip/Brotli**: pre-compresión automática de JS, CSS y HTML
- **serve en devDependencies**: disponible para preview local
- **ESLint**: configurado con eslint.config.mjs
- **Vitest**: 19 tests para lógica de puntuación F1 y fútbol
- **npm audit**: paso de auditoría en workflow GitHub Actions
- **Concurrencia en deploys**: `concurrency: deploy-production` evita deploys solapados
- **Notificación de fallo**: crea GitHub issue automáticamente si el deploy falla

### Lambda (ManriBot)
- **Logging estructurado**: JSON con requestId, latencia, modelo, IP
- **Validación de respuesta AI**: descarta respuestas < 5 caracteres
- **Fallback Ergast mejorado**: logging cuando se usan datos de respaldo, flag `approximate`

---

## [2026-03-05] — Caricaturas SVG y fix de avatares

- 10 avatares SVG rediseñados: estilo Vizcarra (F1, pilotos) y Alberto Arias (fútbol, futbolistas).
- Fix: avatares F1/fútbol mezclados en rankings — prop `mode` explícito en todos los `Avatar`.
- Fix: un usuario siempre mostrando avatar fútbol — reescritura de `Avatar.jsx` con `useRef` para fallback.
- Fix: XML syntax errors en SVGs (carlos, pere, toni, antonio).
- Fix: compartir apuesta WhatsApp ahora incluye respuestas a las 3 preguntas.

---

## [2026-03-04] — ManriBot para fútbol (Gemma 3 27B)

- ManriBot ahora disponible en la sección de fútbol con sugerencias específicas.
- Lambda `porra-ai` acepta `mode: "futbol"` con system prompt especializado en fútbol.
- Modelo principal cambiado a **Gemma 3 27B IT** con fallback a Gemini Flash.
- `systemInstruction` separado del contenido de usuario para mejores respuestas.
- Componente `AIAssistant` adaptado con texto, sugerencias y estilo según el modo (F1/fútbol).

## [2026-03-04] — Mejora de opacidad y contraste en fondos y menús

- Overlay del fondo incrementado de `.68` a `.78` para mayor legibilidad.
- Cards y sidebar con fondo oscuro sólido (`rgba(12,12,24,.75)`) en vez de blanco semitransparente (`.035`).
- Hero, navegación, tablas y paneles de fútbol con fondos más opacos.
- Bordes más visibles en todos los modos.

## [2026-03-04] — Build pipeline con esbuild y Tailwind v4

- Nuevo `build.mjs`: compila `app.jsx` con esbuild (bundle + minify + React incluido) y CSS con Tailwind CLI v4.
- **Eliminados de producción**: Babel (~3 MB), Tailwind CDN (~100 KB), vendor scripts.
- **Resultado**: carga reducida de ~3.5 MB a ~391 KB (~90% menos).
- `src.css` con todo el CSS custom + `@import "tailwindcss"`.
- `index.html` de producción limpio: sin CDN, sin `unsafe-eval`, CSP endurecido.
- GitHub Actions actualizado: `npm ci` → `node build.mjs` → `aws s3 sync dist/`.
- Cache headers optimizados: assets inmutables con max-age 1 año, index.html sin caché.

## [2026-03-04] — Optimizaciones de rendimiento

- `saveDB` (localStorage) debounced a 300ms, `saveRemoteState` debounced a 1500ms.
- Componentes `Avatar`, `RuleCard` y `CircuitCard` envueltos con `React.memo`.
- Hook `useNow` centralizado para `setInterval` de reloj (antes duplicado en 3 componentes).
- Consolidación de `last3WithResults`/`last3RacesDisplay` en `Participante`.
- Estado `ok` de Admin F1 inicializado desde `sessionStorage` (elimina flash de UI).
- Dependencia `exclude` estabilizada en `SelectDriver` `useMemo`.
- `readFileAsDataUrl` simplificado.

## [2026-03-04] — Revisión integral: seguridad, visibilidad, usabilidad

- Contraseñas hasheadas con SHA-256 (antes en texto plano en localStorage).
- Admin protegido con secreto hasheado + sesión temporal.
- Rate limiting en login (5 intentos, cooldown 30s).
- Sesiones con token aleatorio en sessionStorage (expiran 30 min).
- Datos sensibles (`users`, `adminSecret`) eliminados del localStorage.
- Footer más visible: color `text-amber-200`, opacidad `.85`, drop-shadow.
- WelcomeBanner adaptado para fútbol (clasificación y terminología correctas).

## [2026-03-04] — Avatares fútbol, UX fútbol y protección Admin

- Nuevos avatares SVG de futbolistas para cada usuario.
- Formulario de apuestas de fútbol: validación completa, modo solo-lectura tras guardar, botón "cambiar apuesta".
- Admin de fútbol protegido igual que F1.
- Avatar actualizado inmediatamente al cambiar de modo F1/fútbol.

## [2026-03-04] — Rediseño visual: estética racing y emoción de competición

- Hero con racing stripe rojo superior (3px gradient), gradiente diagonal dinámico e icono de modo con sombra.
- Branding "PORRA BIRREROS" en italic bold tracking-tighter, estilo F1 broadcasting.
- Podium rows con gradient lateral y border-left por posición: oro (1º), plata (2º), bronce (3º).
- Puntos con gradient text rojo para F1 y verde para fútbol.
- Racing accent line en cards principales.
- Animaciones CSS: `slideInLeft`, `pulse-soft`, `shimmer`.

## [2026-03-04] — Corregir responsive: modales, tablas, nav, AI assistant

- Modales (avatar, contraseña): `w-full max-w-sm` con padding en mobile.
- AI Assistant: full-width en mobile con `rounded-t-2xl`, full height.
- Rankings: stats debajo del nombre en mobile.
- Nav tabs: scroll horizontal en `<640px`.

## [2026-03-04] — Otros cambios del 4 de marzo

- Panel de puntos base movido del Ranking a Admin.
- Rediseño UI: header unificado, nav tabs, tablas mejoradas.
- ManriBot renombrado con icono R2-D2.
- Fix asistente F1: texto visible, multi-año, futuros.
- Fix CSP: api.jolpi.ca añadido a connect-src.
- Asistente F1 completo con Jolpica API (datos desde 1950).
- Penalizaciones automáticas (-3/-2/-1) y apuestas fuera de plazo.
- Nuevos criterios de desempate F1/fútbol.
- Glassmorphism, 24 circuitos SVG, avatares cartoon.

## [2026-03-03] — Lanzamiento temporada 2026

- Fix: histórico 2025 solo datos reales (Las Vegas, Qatar, Abu Dhabi).
- Calendario F1 2026: 24 GP con fechas y horarios.
- Pilotos y escuderías F1 2026.
- Ganador 2025: +1 campeonato mundial.
- Sincronización con repositorio porrabirreros.

## [2025-12-16] — Versión inicial

- Aplicación completa con modos F1 y Fútbol.
- Sistema de apuestas, ranking, preguntas, admin.
- Gestión de usuarios con contraseñas hasheadas.
- Sincronización con API remota (AWS).
- Despliegue automático a S3 via GitHub Actions.
