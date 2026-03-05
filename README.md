# Porra de los birreros — F1 y Fútbol

Aplicación web para gestionar porras de Fórmula 1 y Fútbol entre amigos. El que pierde, pone las birras 🍺

**URL en producción:** https://porra.manriquegarcia.com

## 🚀 Desarrollo local

### Requisitos

- Node.js 22+
- npm

### Instalar dependencias

```bash
npm install
```

### Build

```bash
node build.mjs
```

Genera la carpeta `dist/` con:
- `app.js` — React + app bundled y minificado (esbuild)
- `styles.css` — Tailwind CSS v4 + estilos custom precompilados
- `index.html` — sin dependencias CDN
- `assets/` — avatares, circuitos, datos JSON

### Previsualizar

```bash
npx serve dist
```

### Desarrollo sin build (legacy)

Para desarrollo rápido sin build, puedes servir directamente los archivos raíz con un servidor estático (usa Babel + Tailwind CDN en el navegador):

```bash
python3 -m http.server 8000
```

## 📋 Características

### Porra F1
- Apuestas por pole, podio y preguntas adicionales
- Ranking con desempates (victorias GP → podios exactos → aciertos)
- Estadísticas detalladas y histórico 2025
- 24 circuitos SVG con trazados realistas
- ManriBot 🏎️ — asistente AI con datos históricos F1 desde 1950 (Jolpica/Ergast API)

### Porra Fútbol
- 4 partidos por jornada (Madrid, Barça, Real Sociedad, Sporting)
- Puntuación: 3 pts exacto, 1 pt signo, 0 pts fallo
- Penalizaciones: -3 por no apostar, -2 por apuesta fuera de plazo
- ManriBot ⚽ — asistente AI de fútbol powered by Gemma 3 27B

### ManriBot (Asistente AI)
- **F1**: consultas locales contra Jolpica/Ergast API (resultados, campeonatos, pilotos, circuitos desde 1950)
- **Fútbol**: consultas a Lambda AWS con Gemma 3 27B (historia, equipos, jugadores, tácticas)
- Sugerencias de preguntas contextuales
- Interfaz de chat con historial

## 🏗️ Arquitectura

```
app.jsx          → Código fuente React (JSX)
src.css          → Tailwind v4 + CSS custom
build.mjs        → Script de build (esbuild + Tailwind CLI)
index.html       → HTML fuente (dev con Babel/CDN)
porra-ai.mjs     → Lambda AWS (ManriBot AI)
assets/          → Avatares SVG, circuitos, datos JSON
dist/            → Build de producción (generado)
```

### Stack
- **Frontend**: React 18, Tailwind CSS v4, glassmorphism UI
- **Build**: esbuild (bundle + minify), @tailwindcss/cli
- **Backend**: AWS Lambda (Node.js), API Gateway
- **AI**: Gemma 3 27B (Google AI API) con fallback a Gemini Flash
- **Datos F1**: Jolpica/Ergast API (client-side)
- **Storage**: AWS (estado remoto) + localStorage (caché local)
- **Hosting**: S3 + CloudFront
- **CI/CD**: GitHub Actions (build + deploy automático en push a main)

## 🔐 Acceso

- **Usuarios**: Antonio, Carlos, Pere, Toni, Manrique
- **Contraseña inicial**: `B1rr3r0s` (se pide cambiar en el primer acceso)
- **Admin**: Manrique

## 🌐 Despliegue

El despliegue es automático al hacer push a `main` via GitHub Actions:

1. `npm ci` — instala dependencias
2. `node build.mjs` — compila JS (esbuild) y CSS (Tailwind)
3. `aws s3 sync dist/` — sube a S3
4. CloudFront invalidation — limpia caché CDN

Ver [DEPLOY.md](DEPLOY.md) para configuración de secrets AWS.

## 📝 Notas

- El modo seleccionado (F1/Fútbol) se guarda en localStorage
- Los datos se sincronizan automáticamente con la API remota (AWS)
- Sesión expira tras 30 minutos de inactividad
- **Histórico 2025**: solo Las Vegas, Qatar y Abu Dhabi tienen datos reales
