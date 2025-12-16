# Sincronización con DynamoDB

La aplicación guarda automáticamente todos los datos (F1 y Fútbol) en DynamoDB además del localStorage local.

## Funcionamiento

### Guardado Automático
- Cada vez que cambia el estado (`db`), se guarda automáticamente en:
  1. **LocalStorage** (inmediato, siempre)
  2. **DynamoDB** (solo si está configurada la API y la app está "hydrated")

### Carga Inicial
- Al iniciar la aplicación, intenta cargar desde DynamoDB
- Si hay datos remotos y no hay cambios locales recientes, los carga
- Si hay cambios locales, prioriza los datos locales

### Estructura de Datos

El objeto completo `db` se guarda en DynamoDB, incluyendo:

```javascript
{
  // Datos F1
  bets: {...},           // Apuestas F1
  results: {...},        // Resultados F1
  participants: {...},  // Participantes
  users: {...},         // Usuarios
  meta: {...},          // Metadatos
  
  // Datos Fútbol
  futbol: {
    jornadas: {...},    // Jornadas de fútbol
    bets: {...},        // Apuestas de fútbol
    results: {...},     // Resultados de fútbol
    questions: {...},   // Preguntas
    order: [...],       // Orden de jornadas
    // ... otros campos
  }
}
```

## Configuración

### Variables de Entorno (Lambda)

Los archivos `porra-get.mjs` y `porra-put.mjs` necesitan:

- `STATE_TABLE`: Nombre de la tabla DynamoDB
- `ALLOWED_ORIGIN`: Origen permitido para CORS (o "*")
- `API_SECRET`: (Opcional) Secreto para autenticación

### Configuración en el Cliente

En `index.html` o mediante variables de entorno:

```javascript
window.PORRA_API_BASE = "https://porra.manriquegarcia.com";
window.PORRA_API_SECRET = "tu-secreto"; // Opcional
```

## Endpoints

- **GET** `/state`: Obtiene el estado completo desde DynamoDB
- **PUT** `/state`: Guarda el estado completo en DynamoDB

## Notas

- El estado de fútbol se inicializa automáticamente si no existe al cargar
- Los cambios se sincronizan en tiempo real
- Si falla la sincronización remota, los datos locales se mantienen
- La sincronización es asíncrona y no bloquea la UI

