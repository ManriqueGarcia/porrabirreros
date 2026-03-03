# Porra de los birreros — F1 y Fútbol

Aplicación web para gestionar porras de Fórmula 1 y Fútbol.

## 🚀 Cómo arrancar en local

### Opción 1: Python (recomendado)

Si tienes Python instalado:

```bash
# Python 3
python3 -m http.server 8000

# O Python 2
python -m SimpleHTTPServer 8000
```

Luego abre en el navegador: `http://localhost:8000`

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

## 🌐 Despliegue

La app se despliega en **S3 + CloudFront**. El despliegue automático se ejecuta al hacer push a `main`. Ver [DEPLOY.md](DEPLOY.md) para la configuración.

**URL en producción:** https://porra.manriquegarcia.com

## 📝 Notas

- El modo seleccionado (F1/Fútbol) se guarda en localStorage
- Los datos se sincronizan automáticamente si hay API configurada
- La sesión expira tras 30 minutos de inactividad
- **Histórico 2025:** Solo Las Vegas, Qatar y Abu Dhabi tienen datos reales (la app se usó desde las últimas 3 carreras)

