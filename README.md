# Porra de los birreros — F1 y Fútbol

Aplicación web para gestionar porras de Fórmula 1 y Fútbol.

## 🚀 Cómo arrancar en local

**⚠️ IMPORTANTE:** Usa `localhost` (no `0.0.0.0`) para que la API de fútbol funcione correctamente.

### Opción 1: Python (recomendado)

Si tienes Python instalado:

```bash
# Python 3 - Usa localhost explícitamente
python3 -m http.server 8000 --bind localhost

# O si tu versión no soporta --bind:
python3 -m http.server 8000
# Luego accede a http://localhost:8000 (NO uses 0.0.0.0:8000)
```

Luego abre en el navegador: `http://localhost:8000` (no uses `0.0.0.0`)

### Opción 2: Node.js (http-server)

Si tienes Node.js instalado:

```bash
# Instalar http-server globalmente
npm install -g http-server

# Ejecutar en el directorio del proyecto
http-server -p 8000
```

Luego abre en el navegador: `http://localhost:8000`

### Opción 3: PHP

Si tienes PHP instalado:

```bash
php -S localhost:8000
```

Luego abre en el navegador: `http://localhost:8000`

### Opción 4: VS Code Live Server

Si usas VS Code:
1. Instala la extensión "Live Server"
2. Click derecho en `index.html` → "Open with Live Server"

## 📋 Características

### Porra F1
- Apuestas por pole, podio y preguntas adicionales
- Ranking y estadísticas
- Gestión de resultados y ajustes manuales

### Porra Fútbol
- 4 partidos por jornada (Madrid, Barça, Real Sociedad, Sporting)
- Sistema de puntuación: 3 puntos exacto, 1 punto signo, 0 puntos fallo
- 3 preguntas adicionales (2 puntos cada una)
- Penalizaciones: -2 por no apostar, -1 por apuesta catastrófica
- Eliminación tras 3 jornadas sin apostar

## 🔐 Acceso

**Usuarios por defecto:**
- Antonio, Carlos, Pere, Toni, Manrique
- Contraseña inicial: `B1rr3r0s`
- Admin: Manrique

**Nota:** En el primer acceso, se pedirá cambiar la contraseña.

## 💾 Almacenamiento

Los datos se guardan en:
- **LocalStorage del navegador** (clave: `porra_f1_clean_v3`)
- **Sincronización remota** (si está configurada la API)

## 🛠️ Desarrollo

La aplicación usa:
- React (CDN)
- Tailwind CSS (CDN)
- Babel (CDN para JSX)

No requiere build ni instalación de dependencias. Solo sirve los archivos estáticos con un servidor HTTP.

## 📝 Notas

- El modo seleccionado (F1/Fútbol) se guarda en localStorage
- Los datos se sincronizan automáticamente si hay API configurada
- La sesión expira tras 30 minutos de inactividad

## ⚠️ Problemas Comunes

### Errores de CORS

**Si ves errores de CORS:**
- **DynamoDB**: Normal en desarrollo local. Los datos se guardan en localStorage.
- **API de fútbol**: Requiere `localhost` (no `0.0.0.0`). Asegúrate de acceder a `http://localhost:8000`.

**Solución:**
```bash
# En lugar de:
python3 -m http.server 8000  # (puede usar 0.0.0.0)

# Usa:
python3 -m http.server 8000 --bind localhost
# Y accede a http://localhost:8000
```

