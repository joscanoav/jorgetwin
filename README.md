# jorgetwin — contexto real del proyecto

Este README describe el estado actual del proyecto. Está escrito para que también sirva como contexto al retomar el trabajo o al pasárselo a otra IA.

## Objetivo

Enlace web donde un alumno ve a Jorge, escucha el saludo y conversa por voz sobre Ciencias de la Computación (ESO y Bachillerato, Comunidad de Madrid). La demostración prevista es el jueves 26 de noviembre de 2026.

El clon se presenta siempre como IA, no como el profesor real. Responde en dos o tres frases cortas, en texto plano hablado, sin Markdown, con explicaciones sencillas y una pregunta final cuando encaja.

## Stack

- Un único servicio en Render (plan free): la misma app Express sirve la API y el frontend compilado. No hay Netlify ni dominios separados.
- Backend: Node 18+, Express 5, `groq-sdk`, `msedge-tts`, `express-rate-limit`, `dotenv`.
- LLM: Groq, modelo configurable con `GROQ_MODEL`, `reasoning_effort: "low"`.
- Frontend: Vite 6, React 19, TailwindCSS 4.
- STT: Web Speech API del navegador, solo Chrome/Edge. No se añaden librerías de voz al cliente.
- TTS: Microsoft Edge TTS en el servidor para las respuestas y para los saludos generados.
- Sin base de datos. Sin persistencia. Sin cuentas de usuario.

Scripts principales:

- `npm run build`: instala y compila `client/` en `client/dist`.
- `npm start`: ejecuta `node server/index.js`.
- `npm run greeting`: regenera los MP3 del saludo en `client/public/assets`.

## Estructura

```text
.
├── server/
│   ├── index.js                 API, TTS, validación, estático y fallback SPA
│   └── prompts/
│       ├── jorge.md             identidad, tono y límites del clon
│       └── temario.md           contexto curricular de referencia
├── client/
│   ├── src/
│   │   ├── App.jsx              interfaz, textos, estados y layout
│   │   ├── hooks/useVoiceChat.js  STT, TTS del saludo, historial en memoria
│   │   ├── components/AvatarVideo.jsx
│   │   └── index.css
│   ├── public/assets/           avatar, vídeo y saludos MP3
│   └── vite.config.js           proxy /api -> localhost:3001 en desarrollo
├── scripts/generate-greeting.mjs
├── reference/                   código del proyecto anterior, solo consulta
├── PROJECT_CONTEXT.md
└── README.md
```

`client/dist/` se genera en el build; no es código fuente.

## Contrato de la API

### `GET /health`

Responde `200` con `{ "status": "ok" }`. Se usa como health check de Render.

### `POST /api/chat`

Petición:

```json
{
  "message": "texto del alumno",
  "history": [],
  "lang": "es"
}
```

Respuesta:

```json
{
  "text": "respuesta hablada de Jorge",
  "audioBase64": "MP3 en base64 o null"
}
```

- `message`: obligatorio, texto no vacío, máximo 500 caracteres.
- `history`: opcional, máximo 6 mensajes; cada uno con `role` `user` o `assistant` y `content` de hasta 500 caracteres. Se usa solo como contexto del modelo; no se guarda.
- `lang`: opcional. Valores permitidos: `es`, `en`, `fr`. Por defecto `es`. Cualquier otro valor devuelve `400`.
- La petición se envía desde el mismo origen del frontend, en JSON. La cabecera de texto antigua `X-Reply-Text` no se usa.
- Errores: validación incorrecta → `400`; falta la clave de Groq → `503`; fallo de Groq → `502`.
- Rate limit: 20 peticiones por minuto e IP bajo `/api/`.
- La respuesta de Groq se sanea antes de TTS: se quitan Markdown, listas, emojis y otros caracteres no hablables.
- Si falla el TTS, la petición sigue devolviendo `text` con `audioBase64: null`.

El cliente envía siempre `lang` con el idioma seleccionado en la interfaz. El servidor añade una instrucción de idioma al prompt del sistema para que Jorge no cambie de idioma salvo petición explícita.

## Voces TTS

Seleccionadas y verificadas con `getVoices()` de `msedge-tts`:

| Idioma | Voz |
| --- | --- |
| `es` | `es-ES-AlvaroNeural` |
| `en` | `en-GB-RyanNeural` |
| `fr` | `fr-FR-HenriNeural` |

Si una voz preferida no está disponible, el servidor busca otra voz masculina `Neural` de la misma locale y, si tampoco, usa la preferida como último recurso. Los saludos se generan con esas mismas voces en `saludo-es.mp3`, `saludo-en.mp3` y `saludo-fr.mp3`.

## Avatar

- Imagen fija en reposo: `jorge-idle.png`.
- Vídeo corto y mudo en bucle: `jorge-hablando.mp4`, se muestra solo mientras `isSpeaking` es verdadero.
- Si el vídeo falla, se mantiene la imagen fija.
- Se usa `object-cover` con `object-top` para no cortar la cabeza; la proporción es `36/55`.
- No hay sincronización real de boca: es una animación de apoyo.

## Reconocimiento de voz

- El cliente usa `window.SpeechRecognition || window.webkitSpeechRecognition`.
- En Recognition: Chrome usa el servicio de Google y Edge el de Microsoft. Se ha observado mejor comportamiento en Edge para inglés.
- Idiomas de reconocimiento: `es-ES`, `en-US` y `fr-FR`. El inglés usa `en-US` para STT aunque la voz TTS sea `en-GB-RyanNeural`.
- `continuous = true` y `interimResults = true`.
- La línea “Tú: …” muestra la transcripción provisional mientras se habla con `aria-live="off"`.
- Solo se envía al backend un resultado con `isFinal === true`, una vez por frase. Mientras se está pensando o hablando se ignoran resultados nuevos.
- El historial interno se limita a 6 mensajes y vive solo en memoria.

## Interfaz

- Solo voz: micrófono para empezar y botón colgar; botón circular de silenciar con icono de altavoz, deshabilitado cuando Jorge no habla.
- No hay panel de conversación ni historial visible.
- El campo de texto y su botón de enviar aparecen únicamente si el navegador no soporta `SpeechRecognition`, acompañados de un aviso de que la voz solo funciona en Chrome o Edge.
- Subtítulo de la última respuesta de Jorge, limitado a tres líneas y con `aria-live="polite"`.
- Estado visible con prioridad: hablando > pensando > escuchando > listo.
- Selector discreto ES/EN/FR;botones de 44×44 px.
- Layout de una sola pantalla con `h-dvh`, `overflow-hidden` y padding inferior seguro; sin scroll en móvil ni escritorio.
- Se respeta `prefers-reduced-motion` en halos y ondas.

## Variables de entorno

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `GROQ_API_KEY` | Sí | Acceso a la API de Groq. |
| `GROQ_MODEL` | No | Modelo usado por Groq; el código define el valor por defecto. |
| `PORT` | No | Puerto de escucha. Render lo asigna automáticamente. |

No incluir valores en el repositorio. `.env` debe quedar fuera del control de versiones; `.env.example` solo contiene nombres.

## Despliegue en Render

1. Crear un **Web Service** desde el repositorio.
2. Nombre: `jorgetwin`.
3. Runtime: Node, versión 18 o superior.
4. Build Command: `npm run build`.
5. Start Command: `npm start`.
6. Health Check Path: `/health`.
7. Configurar las variables de entorno anteriores en el panel de Render.

Render asigna `PORT`; el servidor sirve `client/dist` y las rutas SPA desde el mismo puerto que la API.

## Pruebas en local

```bash
npm install
npm run build
npm start
```

Abrir `http://localhost:3001`.

Para desarrollo con recarga automática:

```bash
npm --prefix client install
npm --prefix client run dev
```

Vite escucha en `:5173` y redirige `/api` a `http://localhost:3001` según `client/vite.config.js`.

Comprobaciones rápidas:

```bash
curl http://localhost:3001/health
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hola","history":[],"lang":"es"}'
```

## Privacidad

- No hay base de datos, cuentas ni persistencia: no se guardan conversaciones.
- El historial viaja en cada petición solo para dar contexto al modelo y se descarta al terminar.
- Aviso visible en la interfaz: “Soy una IA, clon de Jorge. No compartas datos personales.”
- La voz del navegador envía audio a Google (Chrome) o Microsoft (Edge); el texto va a Groq y el TTS a Microsoft.
- El público son alumnos menores. Queda pendiente la autorización del centro y del DPD, y el consentimiento familiar para menores de 14 años.

## Fases futuras (no implementadas)

- Sincronización de boca con el volumen real.
- Temario con RAG.
- Voz clonada.
- Más modelos.

## Perfil de Jorge

El perfil de Jorge vive en `server/prompts/perfil.md` y debe tratarse como la fuente de verdad sobre su identidad y forma de hablar. El prompt cargado actualmente por `server/index.js` se construye con `server/prompts/jorge.md` y `server/prompts/temario.md`; si una copia del repositorio no incluye `perfil.md`, no inventar datos personales ni del centro: usar solo la información disponible en esos archivos.
