# TODO — Porra Birreros F1 & Fútbol

Estado del proyecto y mejoras pendientes. Última revisión: 2026-03-10.

---

## Estado actual

- **Build pipeline**: esbuild + Tailwind v4 via GitHub Actions
- **Arquitectura modular**: 27 módulos ES en `src/` (config, utils, api, i18n, scoring, componentes)
- **AI**: ManriBot con Gemma 3 27B (fútbol) y Jolpica API (F1)
- **Asset hashing**: `app.[hash].js` y `styles.[hash].css` para cache-busting agresivo
- **PWA**: Service Worker + manifest.json para instalación como app
- **Tests**: 124 tests (Vitest) — puntuación F1/fútbol + API funcional
- **i18n**: Sistema de idiomas (es/en) con contexto React
- **Tema**: Toggle dark/light mode con estilos completos

---

## ✅ Completado

### Bugs (todos resueltos)
- [x] Clases Tailwind dinámicas en AIAssistant
- [x] `REAL_HISTORICAL_2025_KEYS` definido después de `Historico`
- [x] `JSON.parse` sin try/catch en `callGemini`
- [x] Error handling en carga inicial
- [x] **Histórico: no dejaba cambiar año tras error 404** (selector siempre visible ahora)
- [x] **Ranking: mostraba "Pere paga" con todos a 0 pts** (ahora dice "todos pagamos")

### Seguridad (todo resuelto)
- [x] `ALLOWED_ORIGIN` restrictivo + validación
- [x] Rate limiting (10 req/min/IP)
- [x] Prompt injection mitigation

### UX (todo resuelto)
- [x] Loading states en carga inicial
- [x] Histórico multi-año (selector dinámico + manejo 404)
- [x] Accessibility: focus-visible, aria-modal, htmlFor/id, prefers-reduced-motion
- [x] Favicon (emoji 🍺 SVG)
- [x] Meta description, Open Graph, theme-color
- [x] Noscript fallback
- [x] **Modo claro mejorado**: estilos para tablas, modales, inputs, selects, botones, badges, cards fútbol, podium
- [x] **Fútbol: jornada actual por defecto** al entrar (en vez de la última pasada)
- [x] **Fútbol: deadline viernes 21:00** (antes 15:00)
- [x] **F1 móvil: CircuitCard al final** para facilitar apostar sin scroll

### Rendimiento (todo resuelto)
- [x] `useMemo` para races, `useCallback` en Participante
- [x] `colorOf` memorizado en PositionEvolutionChart
- [x] Asset hashing (app.[hash].js, styles.[hash].css)
- [x] Preconnect para APIs externas
- [x] **Imagen fútbol comprimida**: 1663 KB → 416 KB (75% reducción)

### Arquitectura (completado)
- [x] CSS variables para colores temáticos
- [x] Eliminado código muerto (backupDefaults, winner-shine, revving)
- [x] Extraído constantes a CONFIG object
- [x] `lib/scoring.mjs` con funciones puras de puntuación (testable)
- [x] **Separación en módulos ES**: 27 ficheros en `src/` (config, utils, api, i18n, toast, scoring, futbol-utils, f1-data, 19 componentes React)

### Build y CI/CD (completado)
- [x] Error handling en build.mjs
- [x] Gzip pre-compresión en build
- [x] Optimización de imágenes (warning para >500KB)
- [x] `serve` en devDependencies
- [x] ESLint configurado
- [x] Tests con Vitest (124 tests: scoring + API funcional)
- [x] npm audit en workflow
- [x] Concurrencia en deploys
- [x] Notificación de fallo (crea GitHub issue)
- [x] **Build modular**: entry point `src/index.jsx` (sin tmp files)

### Lambda (completado)
- [x] Logging estructurado (JSON con requestId, latencia, modelo)
- [x] Validación de respuesta AI (mínimo 5 chars)
- [x] Fallback Ergast mejorado (logging de uso, flag `approximate`)

### PWA (completado)
- [x] Service Worker (cache stale-while-revalidate para assets)
- [x] manifest.json
- [x] theme-color meta

### Features nuevas (completado)
- [x] Dark/light mode toggle
- [x] Compartir apuesta (Web Share API / WhatsApp fallback)
- [x] Gráficos evolución fútbol (chart SVG por jornada)
- [x] Predicción AI ManriBot (sugerencias 🔮)
- [x] Multi-idioma (es/en) con contexto React
- [x] Exportar ranking CSV (F1 y fútbol)
- [x] **Exportar ranking PDF** (F1 y fútbol, print-to-PDF nativo)

---

## 💡 Ideas futuras
- [ ] **Notificaciones push**: requeriría datos de suscripción → implicaciones LOPD
