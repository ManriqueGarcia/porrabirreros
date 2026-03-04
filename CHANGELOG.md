# Changelog — Porra Birreros F1 & Fútbol

Todos los cambios relevantes del proyecto están documentados en este archivo.

---

## [2026-03-04] — Rediseño visual: estética racing y emoción de competición

`99654a5`

- Hero con racing stripe rojo superior (3px gradient), gradiente diagonal dinámico e icono de modo con sombra.
- Branding "PORRA BIRREROS" en italic bold tracking-tighter, estilo F1 broadcasting.
- Podium rows con gradient lateral y border-left por posición: oro (1º), plata (2º), bronce (3º) via clases CSS `.podium-1/2/3`.
- Puntos con clase `.pts-cell`: font-weight 800, gradient text rojo para F1 y verde para fútbol.
- Racing accent line (`.card-racing::before`) en cards principales.
- Section titles con gradient text temático por modo.
- Cards con hover `translateY(-1px)` y transiciones suaves.
- RuleCards con hover scale en icono (group-hover).
- Login con botón gradient rojo y shadow.
- Animaciones CSS: `slideInLeft`, `pulse-soft`, `shimmer`.
- Footer racing con uppercase tracking-widest.
- Tablas: headers más discretos, filas más limpias.
- Background overlay reducido a 68% para más presencia del fondo.

## [2026-03-04] — Corregir responsive: modales, tablas, nav, AI assistant

`808f22b`

- Modales (avatar, contraseña): `w-full max-w-sm` con padding en mobile.
- AI Assistant: full-width en mobile con `rounded-t-2xl`, full height.
- Rankings F1/Fútbol: stats secundarias debajo del nombre en mobile en vez de columnas ocultas, para no perder información.
- Nav tabs: scroll horizontal en `<640px` en vez de wrap multi-línea.
- Eliminar `min-w-[400px]` de tabla Histórico.
- `SelectDriver`: `w-full min-w-0` para evitar overflow.
- QuestionsHistory: `flex-wrap` en cabecera de GP.
- Textos mínimos `text-[10px]` → `text-xs` para legibilidad táctil.
- Sugerencias AI: `text-xs` con padding mayor para touch targets.

## [2026-03-04] — Mover panel de puntos base del Ranking a Admin

`776673a`

- El editor de puntos base (backup inicial) solo es accesible desde Admin, no desde la vista pública de Ranking.

## [2026-03-04] — Rediseño UI: header unificado, nav tabs, tablas mejoradas

`a84afb5`

- Fusionar hero + header en una sección compacta con avatar integrado.
- Reemplazar botones de nav sueltos por nav tabs con estilos propios (`.porra-nav`).
- Tablas: sticky headers, zebra striping, columnas responsivas (`hidden sm:table-cell`).
- Rankings: iconos podio, borde izquierdo destacado, highlight primer puesto.
- Títulos de sección con clase `.section-title` (gradient text).
- Badges reutilizables (`.badge-red`, `.badge-green`, `.badge-amber`).
- Login centrado con labels uppercase y mejor spacing.
- Mejor contraste de textos auxiliares y footers.
- Responsive: nav compacta en móvil, user info adaptada.

## [2026-03-04] — Renombrar asistente a ManriBot con icono R2-D2

`0cf9a61`

- Nuevo nombre "ManriBot" (Manrique + Robot).
- Icono SVG estilo R2-D2 con colores F1 (rojo, azul, gris metálico).
- Mensaje de bienvenida con personalidad.
- Botón de navegación con icono integrado.

## [2026-03-04] — Fix: asistente F1 — texto visible, multi-año, futuros

`c61d567`

- Input del chat muestra texto blanco sobre fondo oscuro.
- Soporte para preguntas multi-año: "últimos 5 años", "desde 2019", "históricamente", etc.
- Nuevos handlers `hFinishersMulti` y `hResultsMulti`.
- Protección contra consultas a temporadas futuras sin resultados.
- Mejor extracción de nombres de GP antes de frases temporales.

## [2026-03-04] — Fix: añadir api.jolpi.ca al CSP connect-src

`787e6a1`

- La política de seguridad de contenido bloqueaba las peticiones del asistente F1 a la API Jolpica.

## [2026-03-04] — Asistente F1 completo con datos históricos (Jolpica API)

`959cf39`

- Reescrito el asistente F1 para funcionar 100% client-side usando la API pública Jolpica/Ergast (datos desde 1950).
- Soporta: resultados de carrera, podios, ganadores, campeonatos de pilotos y constructores, estadísticas de piloto (victorias, poles, campeonatos), calendario, clasificación (qualifying), vueltas rápidas, abandonos/DNFs, historial de GPs, resultados de piloto en circuito, compañeros de equipo.
- NLP en español con resolución de nombres de pilotos (~60), circuitos y países.
- Caché en memoria para rendimiento.
- UI mejorada con sugerencias clickeables.

## [2026-03-04] — Penalizaciones automáticas y apuestas fuera de plazo

`8241bae`

- No apostar: -3 pts (F1 y fútbol), aplicado automáticamente.
- Apuesta fuera de plazo: -2 pts (antes -3 en F1).
- Formularios siempre abiertos (excepto cierre por admin).
- Banner de aviso al apostar fuera de plazo.
- Botones con estilo diferenciado para apuestas tardías.
- Vista de normas actualizada con nuevas penalizaciones.
- Ranking fútbol muestra penalizaciones combinadas.

## [2026-03-04] — Nuevos criterios de desempate F1/fútbol y vista de Normas

`07fe25d`

### F1
- Eliminar TB1 (suma posiciones), sustituir por victorias de GP.
- Nuevo orden: puntos → victorias GP → podios exactos → aciertos → penalizaciones → timestamp apuesta.
- Nueva vista "Normas" con puntuación y desempates detallados.

### Fútbol
- Añadir jornadas ganadas como 2º criterio de desempate.
- Añadir diferencia de goles acumulada como último criterio cuantitativo.
- Nuevo orden: puntos → jornadas ganadas → exactos → preguntas → signos → sin apostar → dif. goles.
- Reglas actualizadas con nuevos desempates.

## [2026-03-04] — Overlay más oscuro para legibilidad

`87e8db2`

- Overlay del fondo más oscuro para mejorar la legibilidad de textos sobre la imagen de fondo.

## [2026-03-04] — Rediseño glassmorphism, circuitos, avatares y limpieza 2026

`29cf454`

- Glassmorphism en toda la UI: cards, hero, sidebar, botones, inputs con backdrop-filter blur.
- Estilos modernos: animaciones fadeInUp, hover effects, scrollbar custom, gradientes radiales.
- Sección fútbol mejorada: reglas con tarjetas, formulario glass, ranking actualizado.
- 24 circuitos SVG realistas (19 nuevos + 5 mejorados) con trazados Bézier y glow.
- Avatares cartoon chibi con colores regionales: Pere (Cataluña), Antonio (Cataluña+Murcia), Manrique (Asturias), Toni (Cataluña+Burgos), Carlos (San Sebastián).
- Background F1 cambiado a imagen Unsplash con `background-size:cover`.
- Histórico 2025 guardado, estado remoto limpio para temporada 2026.

## [2026-03-03] — Fix: histórico 2025 solo datos reales

`9a10d55`

- Resultado año anterior y puntos: solo para las 3 últimas carreras (Las Vegas, Qatar, Abu Dhabi).
- Preguntas por GP: guión (—) cuando no hay datos reales.
- Nuevos assets: circuit_tracks, circuits_2026, avatares.

## [2026-03-03] — F1 2026: calendario, pilotos, escuderías, histórico

`dd6fb61`

- Calendario 2026: 24 GP con fechas y horarios.
- Pilotos y escuderías F1 2026.
- Puntos base iniciales a 0 para todos.
- Pestaña Histórico con resultados 2025.
- Pere: +1 campeonato mundial (ganador 2025).

## [2026-03-03] — Merge y sincronización con porrabirreros

`0c86d7b`

- Sincronización del repositorio con la versión F1 + Fútbol.

## [2025-12-16] — Configurar despliegue automático a S3

`8777ffa`

- Workflow de GitHub Actions para desplegar a S3 en push a main.
- Excluir archivos innecesarios del despliegue.
- Soporte opcional para CloudFront invalidation.

## [2025-12-16] — Initial commit

`6b9d2dd`

- Aplicación completa con modos F1 y Fútbol.
- Sistema de apuestas, ranking, preguntas, admin.
- Gestión de usuarios con contraseñas hasheadas.
- Sincronización con API remota (AWS).
