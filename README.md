# jorgetwin

Clon IA de Jorge para hablar sobre Ciencias de la Computación (ESO y Bachillerato, Comunidad de Madrid).
Un único servicio Express sirve la API y el frontend compilado. Sin base de datos ni persistencia.

## Estructura

- `server/index.js`: API (`POST /api/chat`, `GET /health`) y estático de `client/dist`.
- `server/prompts/jorge.md` y `server/prompts/temario.md`: system prompt cargado al arrancar.
- `client/`: Vite + React + Tailwind. Web Speech API (Chrome/Edge) y campo de texto alternativo.
- `client/public/assets/`: avatar (imagen en reposo y víideo al hablar).

## Despliegue en Render

1. Crear un **Web Service** desde este repositorio.
2. **Name:** `jorgetwin`.
3. **Runtime:** Node (recomendado Node 22; la API funciona con Node 18+).
4. **Build Command:** `npm run build` (instala y compila el cliente).
5. **Start Command:** `npm start` (ejecuta `node server/index.js`).
6. **Health Check Path:** `/health`.
7. Variables de entorno:

| Variable | Obligatoria | Valor |
| --- | --- | --- |
| `GROQ_API_KEY` | Sí | Clave de la API de Groq. |
| `GROQ_MODEL` | No | `openai/gpt-oss-20b` por defecto. Alternativa: `openai/gpt-oss-120b`. |

Render asigna `PORT` automáticamente; el servidor lo usa. La voz del navegador envía audio a Google y el texto a Groq y Microsoft (TTS): avisa a los alumnos y gestiona el consentimiento del centro antes de usarlo con menores.

## Pruebas en local

```bash
cp .env.example .env
# editar .env y poner GROQ_API_KEY
npm install
npm run build
npm start
```

Abre `http://localhost:3001`. Para desarrollo con recarga automática:

```bash
npm install
npm run build   # una vez, para generar client/dist
npm start       # terminal 1: API en :3001
npm --prefix client install
npm --prefix client run dev   # terminal 2: Vite en :5173, proxy /api -> :3001
```

Comprobaciones rápidas:

```bash
curl http://localhost:3001/health
curl -X POST http://localhost:3001/api/chat -H "Content-Type: application/json" -d "{\"message\":\"Hola\"}"
```

## Assets del avatar

Los archivos incluidos son marcadores de posición. Sustituye:

- `client/public/assets/jorge-idle.png`: foto tuya en reposo (recomendado 640×800 o similar).
- `client/public/assets/jorge-hablando.mp4`: vídeo corto, mudo y en bucle, hablando (HeyGen).

El vídeo se reproduce solo mientras Jorge habla; si el archivo no es válido, se muestra la imagen fija.
