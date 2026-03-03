# Asistente AI gratuito con Google Gemini

El asistente soporta **Google Gemini** (gratis, sin tarjeta) como alternativa a OpenAI.

## Obtener API key gratuita

1. Ve a **https://aistudio.google.com/app/apikey**
2. Inicia sesión con tu cuenta Google
3. Clic en **"Create API key"**
4. Copia la key (empieza por `AIza...`)

**Límites gratis:** ~15 preguntas/minuto, 1.500/día (puede variar)

## Configurar en la Lambda

En AWS Lambda → función `porra-ai` → Configuration → Environment variables:

Añade o edita:
- **GEMINI_API_KEY** = `AIza...` (tu key)

Puedes **quitar OPENAI_API_KEY** si solo quieres usar Gemini.

## Prioridad

1. Si hay GEMINI_API_KEY → usa Gemini (gratis)
2. Si falla o no hay → intenta con OPENAI_API_KEY
3. Si falla → mensaje de error
