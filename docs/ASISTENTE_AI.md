# Asistente AI de F1

El asistente conecta a la **API Ergast** (datos históricos de F1 desde 1950) y **OpenAI** para responder preguntas como:

- ¿Cuántos coches han acabado la carrera históricamente en Mónaco?
- ¿Quién ganó el GP de España en 2020?
- Estadísticas de un circuito concreto

## Requisitos

1. **Cuenta OpenAI** con API key
2. **Lambda** desplegada con `porra-ai.mjs`
3. **Ruta API** `/assistant` en tu API Gateway

## Despliegue en AWS

### 1. Crear la función Lambda

```bash
# Crear el paquete (porra-ai no usa dependencias externas)
zip porra-ai.zip porra-ai.mjs
```

En la consola AWS Lambda:
- Crear función: Node.js 20.x
- Subir `porra-ai.zip`
- Handler: `porra-ai.handler`

### 2. Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `OPENAI_API_KEY` | Tu API key de OpenAI (obligatorio) |
| `ALLOWED_ORIGIN` | Origen CORS, ej: `https://porra.manriquegarcia.com` |
| `API_SECRET` | Opcional: mismo que `x-porra-secret` si usas autenticación |

### 3. Permisos

La Lambda necesita acceso a internet para:
- `api.openai.com` (OpenAI)
- `ergast.com` (datos F1)

### 4. Añadir ruta en API Gateway

Si tu API está en API Gateway (porra.manriquegarcia.com):

- Crear recurso: `/assistant`
- Método: `POST`
- Integración: Lambda `porra-ai`
- Habilitar CORS

### 5. Alternativa: CloudFront + Lambda@Edge

Si usas CloudFront delante de la API, añade un behavior para `/assistant` que apunte a la Lambda o al API Gateway.

## Uso en la aplicación

1. Haz clic en **🤖 Asistente** en el menú (modo F1)
2. Escribe tu pregunta en español
3. El asistente consulta Ergast y genera la respuesta con OpenAI

## Fuentes de datos

- **Ergast API**: circuitos, resultados, pilotos, equipos (1950-actualidad)
- **OpenAI GPT-4o-mini**: interpreta la pregunta y genera la respuesta

## Coste estimado

- Ergast: gratuito
- OpenAI: ~0,15 USD / 1M tokens entrada, ~0,60 USD / 1M tokens salida (gpt-4o-mini)
- Una pregunta típica: < 0,01 USD
