# Clon IA de Jorge — Contexto

## Objetivo
Enlace web donde un alumno entra, ve mi cara, oye "Hola, ¿qué tal? Soy Jorge, ¿en qué te puedo ayudar?" y conversa por voz sobre mi asignatura (Ciencias de la Computación, ESO y Bachillerato, Comunidad de Madrid). Demo prevista: jueves 26 de noviembre de 2026.

## Stack (decidido)
- Un solo servicio en Render (free) que sirve API + frontend. Sin Netlify.
- Backend: Node 18+, Express 5, groq-sdk, msedge-tts (es-ES-AlvaroNeural, en-GB-RyanNeural, fr-FR-HenriNeural), express-rate-limit, dotenv.
- Frontend: React + Vite + TailwindCSS. Web Speech API (STT, solo Chrome/Edge) + campo de texto únicamente como alternativa si el navegador no soporta SpeechRecognition.
- Reconocimiento de voz: Google (Chrome) o Microsoft (Edge). Mejor comportamiento observado en Edge para inglés.
- LLM: Groq, modelo por variable GROQ_MODEL (por defecto openai/gpt-oss-20b; alternativa openai/gpt-oss-120b). reasoning_effort "low".
- Sin base de datos. Sin persistencia. No se guardan conversaciones.

## Estructura
/server/index.js · /server/prompts/jorge.md · /server/prompts/temario.md
/client (Vite) · /reference (server.js y useVoiceChat.js del proyecto anterior, solo consulta)

## Contrato de la API
POST /api/chat  { message, history, lang? } → { text, audioBase64 | null }
GET /health → 200
Validación: message ≤ 500 chars; history solo roles user/assistant, máx. 6 mensajes de ≤ 500 chars; lang opcional "es" | "en" | "fr" (por defecto "es"; otro valor → 400); rate limit por IP.

## Avatar (Fase 1)
Imagen fija en reposo + vídeo MP4 corto mío hablando (HeyGen), mudo y en bucle mientras isSpeaking. Sin sincronización real.

## Lecciones del proyecto anterior (no repetir)
- El backend ignoraba "message" y dependía del historial.
- Cabecera X-Reply-Text no legible entre dominios → por eso ahora JSON y un solo dominio.
- Historial del cliente sin validar (inyección de rol system).
- Modelo llama-3.1-8b-instant retirado el 16/08/2026.
- max_tokens bajo corta frases y rompe modelos con razonamiento.

## Privacidad
Alumnos menores. Aviso visible: "Soy una IA, clon de Jorge. No escribas datos personales." Voz → Google (Web Speech), texto → Groq y Microsoft. Pendiente: autorización del centro / DPD y consentimiento familiar (menores de 14).

## Fases futuras (NO hacer ahora)
Sincronía de boca con volumen · temario con RAG · voz clonada · más modelos.