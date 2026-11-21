import { useState } from 'react';
import AvatarVideo from './components/AvatarVideo.jsx';
import useVoiceChat, { LANGUAGES } from './hooks/useVoiceChat.js';

const HALO_STYLES = {
  idle: 'bg-slate-500/10 ring-1 ring-slate-300/5 halo-idle',
  listening: 'bg-emerald-400/20 ring-1 ring-emerald-300/30 halo-listening',
  thinking: 'halo-thinking ring-1 ring-sky-300/20',
  speaking: 'bg-cyan-400/25 ring-1 ring-cyan-200/40 halo-speaking',
};

const UI = {
  es: {
    title: 'Habla con Jorge',
    tagline: 'Informática y programación',
    notice: 'Soy una IA, clon de Jorge. No compartas datos personales.',
    voiceOnlyNotice: 'La voz solo funciona en Chrome o Edge.',
    language: 'Idioma',
    ready: 'Listo',
    listening: 'Te escucho…',
    thinking: 'Pensando…',
    speaking: 'Jorge está hablando…',
    start: 'Hablar con Jorge',
    hangUp: 'Colgar',
    mute: 'Silenciar',
    muted: 'Silenciado',
    you: 'Tú:',
    hint: 'Pulsa el micrófono para empezar a hablar con Jorge.',
    placeholder: 'O escribe tu pregunta…',
    send: 'Enviar',
    errors: {
      micDenied: 'Permiso de micrófono denegado. Actívalo para hablar con Jorge.',
      micError: 'Hubo un problema con el micrófono. Inténtalo de nuevo.',
      languageNotSupported: 'El navegador no admite el idioma seleccionado para la voz.',
      connection: 'No se pudo conectar con Jorge. Inténtalo de nuevo.',
    },
  },
  en: {
    title: 'Talk to Jorge',
    tagline: 'Computing and programming',
    notice: "I'm an AI, Jorge's clone. Don't share personal details.",
    voiceOnlyNotice: 'Voice only works in Chrome or Edge.',
    language: 'Language',
    ready: 'Ready',
    listening: "I'm listening…",
    thinking: 'Thinking…',
    speaking: 'Jorge is speaking…',
    start: 'Talk to Jorge',
    hangUp: 'Hang up',
    mute: 'Mute',
    muted: 'Muted',
    you: 'You:',
    hint: 'Press the microphone to start talking to Jorge.',
    placeholder: 'Or type your question…',
    send: 'Send',
    errors: {
      micDenied: 'Microphone permission denied. Enable it to talk to Jorge.',
      micError: 'There was a problem with the microphone. Please try again.',
      languageNotSupported: 'The browser does not support the selected language for voice recognition.',
      connection: 'Could not connect to Jorge. Please try again.',
    },
  },
  fr: {
    title: 'Parler à Jorge',
    tagline: 'Informatique et programmation',
    notice: 'Je suis une IA, le clone de Jorge. Ne partagez pas de données personnelles.',
    voiceOnlyNotice: 'La voix ne fonctionne que sur Chrome ou Edge.',
    language: 'Langue',
    ready: 'Prêt',
    listening: 'Je vous écoute…',
    thinking: 'Réflexion…',
    speaking: 'Jorge parle…',
    start: 'Parler à Jorge',
    hangUp: 'Raccrocher',
    mute: 'Couper le son',
    muted: 'Son coupé',
    you: 'Vous :',
    hint: 'Appuyez sur le micro pour commencer à parler à Jorge.',
    placeholder: 'Ou écrivez votre question…',
    send: 'Envoyer',
    errors: {
      micDenied: 'Autorisation du micro refusée. Activez-la pour parler à Jorge.',
      micError: "Il y a eu un problème avec le micro. Réessayez.",
      languageNotSupported: "Le navigateur ne prend pas en charge la langue sélectionnée pour la reconnaissance vocale.",
      connection: "Impossible de se connecter à Jorge. Réessayez.",
    },
  },
};

function statusLabel(chat, ui) {
  if (chat.isSpeaking) return ui.speaking;
  if (chat.isThinking) return ui.thinking;
  if (chat.isListening) return ui.listening;
  return ui.ready;
}

function haloState(chat) {
  if (chat.isSpeaking) return 'speaking';
  if (chat.isThinking) return 'thinking';
  if (chat.isListening) return 'listening';
  return 'idle';
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V5a3.5 3.5 0 1 0-7 0v6a3.5 3.5 0 0 0 3.5 3.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21m-3 0h6" />
    </svg>
  );
}

function HangUpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 10.5a14 14 0 0 1 17 0v3a1.5 1.5 0 0 1-1.6 1.5l-2.4-.2a1.5 1.5 0 0 1-1.4-1.3l-.2-1.2a10 10 0 0 0-6 0l-.2 1.2a1.5 1.5 0 0 1-1.4 1.3l-2.4.2a1.5 1.5 0 0 1-1.4-1.5v-3Z" />
    </svg>
  );
}

function SpeakerIcon({ muted }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 9.5h3l4-3.5v12l-4-3.5H4z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 9a4 4 0 0 1 0 6" />
      {muted && <path strokeLinecap="round" d="M4 4l16 16" />}
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h13m-5-5 5 5-5 5" />
    </svg>
  );
}

export default function App() {
  const [draft, setDraft] = useState('');
  const chat = useVoiceChat();
  const ui = UI[chat.lang];
  const userLine = chat.interimTranscript || chat.transcript;

  const handleSubmit = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    chat.sendText(text);
  };

  return (
    <div className="app-bg flex h-dvh flex-col overflow-hidden text-slate-100">
      <div className="shrink-0 border-b border-white/5 bg-slate-950/40 px-4 py-1 text-center text-[11px] leading-tight text-slate-400">
        {ui.notice}
      </div>

      <main className="safe-bottom mx-auto flex w-full max-w-xl flex-1 flex-col items-center overflow-hidden px-3 pt-2">
        <div className="w-full shrink-0 text-center">
          <h1 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-300">{ui.title}</h1>
          <p className="mt-0.5 text-[10px] text-slate-500">{ui.tagline}</p>
          <div className="mt-2 flex justify-center" role="group" aria-label={ui.language}>
            <div className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-0.5">
              {LANGUAGES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => chat.changeLanguage(code)}
                  aria-pressed={chat.lang === code}
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-[11px] font-medium tracking-wide transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                    chat.lang === code ? 'bg-cyan-500/90 text-slate-950' : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="avatar-slot relative mt-1 flex min-h-0 w-full flex-1 items-center justify-center">
          <div className={`avatar-fit relative aspect-[36/55]`}>
            <div className={`pointer-events-none absolute -inset-3 rounded-[2.5rem] blur-md transition-colors duration-500 ${HALO_STYLES[haloState(chat)]}`} />
            <AvatarVideo isSpeaking={chat.isSpeaking} />
          </div>
        </div>

        <div className="mt-1 flex h-4 shrink-0 items-end justify-center gap-1.5" aria-hidden="true">
          {chat.isSpeaking && [0, 1, 2, 3, 4].map((index) => (
            <span
              key={index}
              className="wave-bar h-full w-1 rounded-full bg-cyan-300/80"
              style={{ animationDelay: `${index * 110}ms` }}
            />
          ))}
        </div>

        <p className="mt-2 text-center text-[11px] text-slate-400" aria-live="polite">{statusLabel(chat, ui)}</p>

        <p className="mt-2 h-5 max-w-full truncate text-center text-[11px] italic text-slate-500" aria-live="off">
          {userLine ? `${ui.you} ${userLine}` : ''}
        </p>

        <p className="line-clamp-3 mt-2 max-w-md text-center text-xs leading-snug text-slate-300" aria-live="polite">
          {chat.lastReply || ui.hint}
        </p>

        <div className="mt-4 flex shrink-0 items-center justify-center gap-6">
          <button
            type="button"
            onClick={chat.isActive ? chat.hangUp : chat.startConversation}
            aria-label={chat.isActive ? ui.hangUp : ui.start}
            className={`flex h-[72px] w-[72px] items-center justify-center rounded-full shadow-lg shadow-black/30 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
              chat.isActive
                ? 'bg-rose-500/90 text-white hover:bg-rose-500'
                : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
            }`}
          >
            {chat.isActive ? <HangUpIcon /> : <MicIcon />}
          </button>
          <button
            type="button"
            onClick={chat.stopAudio}
            disabled={!chat.isSpeaking}
            aria-label={chat.isSpeaking ? ui.mute : ui.muted}
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-40 disabled:hover:bg-white/5"
          >
            <SpeakerIcon muted={!chat.isSpeaking} />
          </button>
        </div>

        {chat.error && (
          <p className="mt-1 max-w-md text-center text-[11px] text-rose-300/90" role="alert">{ui.errors[chat.error]}</p>
        )}

        {!chat.speechSupported && (
          <div className="mt-1 w-full max-w-md shrink-0">
            <p className="text-center text-[10px] text-amber-200/80">{ui.voiceOnlyNotice}</p>
            <form
              onSubmit={handleSubmit}
              className="mt-1 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"
            >
              <input
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={500}
                placeholder={ui.placeholder}
                aria-label={ui.placeholder}
                className="min-w-0 flex-1 bg-transparent text-xs text-slate-100 outline-none placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={chat.isThinking || !draft.trim()}
                aria-label={ui.send}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/90 text-slate-950 transition hover:bg-cyan-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:opacity-40"
              >
                <SendIcon />
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
