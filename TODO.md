# TODO — Porra Birreros F1 & Fútbol

Estado del proyecto y mejoras pendientes. Última revisión: 2026-03-04.

---

## Estado actual

- **Desplegado en producción**: https://porra.manriquegarcia.com
- **Build pipeline**: esbuild + Tailwind v4 via GitHub Actions
- **AI**: ManriBot con Gemma 3 27B (fútbol) y Jolpica API (F1)
- **Último commit**: `bb8c2a8` — Build pipeline, ManriBot fútbol, optimizaciones y mejoras UI

---

## 🔴 Prioridad alta — Bugs y seguridad

### Bugs

- [ ] **Clases Tailwind dinámicas en AIAssistant**: `bg-${accent}-900/20` y `border-${accent}-500/10` no se generan en el build porque Tailwind no detecta clases construidas dinámicamente. Reemplazar por clases estáticas explícitas (`bg-emerald-900/20`, etc.).
- [ ] **`REAL_HISTORICAL_2025_KEYS` definido después de `Historico`**: las constantes se usan en el componente `Historico` (~línea 1092) pero se definen más abajo (~línea 2663). Mover las constantes antes del componente.
- [ ] **`JSON.parse` sin try/catch en `callGemini`**: línea 175 de `porra-ai.mjs` puede lanzar excepción con JSON malformado de la API.
- [ ] **Error handling en carga inicial**: `loadCalendar()`, `loadDrivers()`, `loadTeams()` no tienen `.catch()`. Si un fetch falla, la app puede quedarse en blanco.

### Seguridad

- [ ] **`ALLOWED_ORIGIN: "*"` en Lambda**: el valor por defecto permite peticiones desde cualquier origen. Configurar con `https://porra.manriquegarcia.com`.
- [ ] **Rate limiting en Lambda**: no hay límite de peticiones por IP/usuario. Vulnerable a abuso y costes inesperados en la API de Gemini.
- [ ] **Prompt injection en ManriBot**: la pregunta del usuario se concatena directamente al prompt. Añadir delimitadores claros y/o validación para mitigar inyecciones.

---

## 🟡 Prioridad media — UX y rendimiento

### UX

- [ ] **Loading states en carga inicial**: no hay spinner ni mensaje de error cuando fallan las cargas de calendario, pilotos o equipos. Añadir indicadores de carga y mensajes de error.
- [ ] **Histórico limitado a 2025**: el selector de año solo ofrece 2025. Añadir soporte para 2024 y futuros años.
- [ ] **Accessibility — focus visible**: los botones de navegación (`.porra-nav button`) no tienen estilo `:focus-visible`. Añadir outline para usuarios de teclado.
- [ ] **Accessibility — modales**: falta `aria-modal`, `aria-labelledby` y focus trap en los modales (avatar, contraseña, ManriBot).
- [ ] **Accessibility — formularios**: muchos labels no tienen asociación `htmlFor`/`id` con sus inputs.
- [ ] **Accessibility — prefers-reduced-motion**: no hay regla `@media (prefers-reduced-motion)` para desactivar animaciones.
- [ ] **Favicon real**: actualmente usa `data:,` (vacío). Crear un favicon con el logo de la porra.
- [ ] **Meta description y Open Graph**: falta `<meta name="description">`, `og:title`, `og:image` para SEO y compartir en redes.
- [ ] **Noscript fallback**: no hay contenido para usuarios sin JavaScript.

### Rendimiento

- [ ] **`races` sin `useMemo`**: la derivación de `races` desde `cal` y `raceOverrides` se recalcula en cada render del componente `App`. Envolver en `useMemo`.
- [ ] **Callbacks inline en `Participante`**: `onSubmit` de `BetForm` es una función inline que cambia en cada render. Envolver en `useCallback`.
- [ ] **Callbacks inline en `Admin`**: múltiples handlers `onChange` inline. Extraer y memorizar.
- [ ] **`colorOf` en `PositionEvolutionChart`**: se recrea en cada render. Mover fuera del componente o memorizar.
- [ ] **Asset hashing**: los nombres de `app.js` y `styles.css` no incluyen hash de contenido, lo que dificulta cache-busting agresivo.
- [ ] **Preconnect**: añadir `<link rel="preconnect">` para `api.jolpi.ca`, `porra.manriquegarcia.com` e `images.unsplash.com`.

---

## 🟢 Prioridad baja — Mejoras y limpieza

### Arquitectura / código

- [ ] **Separar `app.jsx` en módulos**: el archivo tiene ~3280 líneas con ~35 componentes. Separar en:
  - `/lib/` — utilidades, storage, API
  - `/components/` — UI compartidos (Avatar, Toast, CircuitCard...)
  - `/components/f1/` — componentes F1
  - `/components/futbol/` — componentes fútbol
  - `/features/ai/` — ManriBot (~400 líneas)
  - `/constants/` — datos estáticos
- [ ] **CSS variables**: usar custom properties para colores temáticos (rojo F1, verde fútbol) en vez de repetir `rgba(225,6,0,...)` y `rgba(34,197,94,...)` por todo el CSS.
- [ ] **Eliminar código muerto**: `backupDefaults` en `Ranking` no se usa. `winner-shine` y keyframes `revving` en CSS tampoco.
- [ ] **Eliminar duplicación CSS**: `index.html` tiene ~300 líneas de CSS inline que duplican `src.css`. Solo se usa en modo dev (Babel). Considerar eliminar si no se usa dev mode.
- [ ] **Valores hardcodeados**: extraer a un archivo de configuración:
  - Usuarios iniciales (`Antonio, Carlos, Pere, Toni, Manrique`)
  - Hashes de contraseñas por defecto
  - Equipos de fútbol base
  - URL de APIs
  - Timezone (`Europe/Madrid`)
  - Timeout de sesión (30 min)

### Build y CI/CD

- [ ] **Error handling en `build.mjs`**: envolver `esbuild.build()` en try/catch con mensaje de error claro.
- [ ] **Linting**: añadir ESLint al proyecto y al workflow de GitHub Actions.
- [ ] **Tests**: añadir tests para la lógica de puntuación (F1 y fútbol) con Vitest o similar.
- [ ] **`npm audit`**: añadir paso de seguridad en el workflow.
- [ ] **Concurrencia en deploys**: añadir `concurrency` al workflow para evitar deploys solapados.
- [ ] **Notificaciones de fallo**: configurar notificación (Slack/email) cuando falle el deploy.
- [ ] **Gzip/Brotli en build**: precomprimir assets para servir directamente desde S3.
- [ ] **Optimización de imágenes**: la foto de fondo de fútbol (`connor-coyne...jpg`) pesa 1.7 MB. Comprimir y/o convertir a WebP.
- [ ] **`serve` en devDependencies**: se usa en `npm run preview` pero no está instalado.

### Lambda (ManriBot)

- [ ] **Logging estructurado**: añadir request ID, latencia y modelo usado en los logs.
- [ ] **Métricas CloudWatch**: registrar éxito/fallo, latencia y uso de tokens.
- [ ] **Validación de respuesta AI**: verificar que la respuesta no esté vacía o sea genérica antes de devolverla.
- [ ] **Fallback en Ergast**: mejorar mensajes cuando la API Ergast falla parcialmente.
- [ ] **Streaming**: considerar streaming de respuestas para mejorar la latencia percibida.

### PWA / Offline

- [ ] **Service Worker**: añadir para caché offline de assets estáticos.
- [ ] **`theme-color` meta**: añadir para personalizar la barra del navegador en móvil.
- [ ] **Manifest**: crear `manifest.json` para instalación como app.

---

## 💡 Ideas futuras

- [ ] **Modo oscuro/claro**: actualmente solo hay modo oscuro. Considerar toggle.
- [ ] **Notificaciones push**: avisar cuando se acerca el deadline de una jornada/GP.
- [ ] **Compartir apuesta**: generar imagen/card de la apuesta para compartir en WhatsApp.
- [ ] **Gráficos de evolución fútbol**: chart de posiciones por jornada (como el de F1).
- [ ] **Predicción AI**: que ManriBot sugiera una apuesta basada en datos históricos.
- [ ] **Multi-idioma**: soporte para inglés (por si crece el grupo).
- [ ] **Exportar datos**: CSV/PDF con ranking y estadísticas de la temporada.
