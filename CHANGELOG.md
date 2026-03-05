# Changelog — Porra Birreros F1 & Fútbol

Todos los cambios relevantes del proyecto están documentados en este archivo.

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
- **WelcomeBanner**: si no hay resultados, muestra "las birras las paga Antonio, como siempre" en vez de un ranking arbitrario.
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
- Fix: Manrique siempre mostrando avatar fútbol — reescritura de `Avatar.jsx` con `useRef` para fallback.
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
- Pere: +1 campeonato mundial (ganador 2025).
- Sincronización con repositorio porrabirreros.

## [2025-12-16] — Versión inicial

- Aplicación completa con modos F1 y Fútbol.
- Sistema de apuestas, ranking, preguntas, admin.
- Gestión de usuarios con contraseñas hasheadas.
- Sincronización con API remota (AWS).
- Despliegue automático a S3 via GitHub Actions.
