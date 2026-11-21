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
    subtitle: 'Ciencias de la Computación · ESO y Bachillerato',
    notice: 'Soy una IA, clon de Jorge. No escribas datos personales.',
    language: 'Idioma',
    ready: 'Listo',
    listening: 'Te escucho…',
    thinking: 'Pensando…',
    speaking: 'Jorge está hablando…',
    start: 'Hablar con Jorge',
    hangUp: 'Colgar',
    mute: 'Silenciar',
    placeholder: 'O escribe tu pregunta…',
    hint: 'Pulsa el micrófono para empezar a hablar con Jorge.',
    viewHistory: 'Ver conversación',
    hideHistory: 'Ocultar conversación',
    emptyHistory: 'Aún no hay conversación.',
    you: 'Tú',
    send: 'Enviar',
    errors: {
      speechUnsupported: 'Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge, o escribe tu pregunta.',
      micDenied: 'Permiso de micrófono denegado. Puedes usar el campo de texto.',
      micError: 'Hubo un problema con el micrófono. Puedes usar el campo de texto.',
      connection: 'No se pudo conectar con Jorge. Inténtalo de nuevo.',
    },
  },
  en: {
    title: 'Talk to Jorge',
    subtitle: 'Computer Science · Secondary and Sixth Form',
    notice: "I'm an AI, Jorge's clone. Don't share personal details.",
    language: 'Language',
    ready: 'Ready',
    listening: "I'm listening…",
    thinking: 'Thinking…',
    speaking: 'Jorge is speaking…',
    start: 'Talk to Jorge',
    hangUp: 'Hang up',
    mute: 'Mute',
    placeholder: 'Or type your question…',
    hint: 'Press the microphone to start talking to Jorge.',
    viewHistory: 'View conversation',
    hideHistory: 'Hide conversation',
    emptyHistory: 'No conversation yet.',
    you: 'You',
    send: 'Send',
    errors: {
      speechUnsupported: 'Your browser does not support voice recognition. Use Chrome or Edge, or type your question.',
      micDenied: 'Microphone permission denied. You can use the text field.',
      micError: 'There was a problem with the microphone. You can use the text field.',
      connection: 'Could not connect to Jorge. Please try again.',
    },
  },
  fr: {
    title: 'Parler à Jorge',
    subtitle: 'Informatique · Collège et Lycée',
    notice: "Je suis une IA, un clone de Jorge. N'écrivez pas de données personnelles.",
    language: 'Langue',
    ready: 'Prêt',
    listening: 'Je vous écoute…',
    thinking: 'Réflexion…',
    speaking: 'Jorge parle…',
    start: 'Parler à Jorge',
    hangUp: 'Raccrocher',
    mute: 'Couper le son',
    placeholder: 'Ou écrivez votre question…',
    hint: 'Appuyez sur le micro pour commencer à parler à Jorge.',
    viewHistory: 'Voir la conversation',
    hideHistory: 'Masquer la conversation',
    emptyHistory: "Aucune conversation pour l'instant.",
    you: 'Vous',
    send: 'Envoyer',
    errors: {
      speechUnsupported: "Votre navigateur ne prend pas en charge la reconnaissance vocale. Utilisez Chrome ou Edge, ou écrivez votre question.",
      micDenied: "Autorisation du micro refusée. Vous pouvez utiliser le champ de texte.",
      micError: "Il y a eu un problème avec le micro. Vous pouvez utiliser le champ de texte.",
      connection: "Impossible de se connecter à Jorge. Réessayez.",
    },
  },
};

function statusLabel(chat, ui) {
  if (chat.isThinking) return ui.thinking;
  if (chat.isSpeaking) return ui.speaking;
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

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h13m-5-5 5 5-5 5" />
    </svg>
  );
}

export default function App() {
  const [draft, setDraft] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const chat = useVoiceChat();
  const ui = UI[chat.lang];

  const lastReply = [...chat.messages].reverse().find((message) => message.role === 'assistant')?.content;

  const handleSubmit = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    chat.sendText(text);
  };

  const handleLanguageChange = (nextLang) => {
    if (nextLang === chat.lang) return;
    chat.changeLanguage(nextLang);
    setDraft('');
    setShowHistory(false);
  };

  return (
    <div className="app-bg min-h-screen text-slate-100">
      <div className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-slate-950/70 px-4 py-1.5 text-center text-[11px] text-slate-400 backdrop-blur">
        {ui.notice}
      </div>

      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center px-4 pb-10 pt-12">
        <header className="text-center">
          <h1 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-300">{ui.title}</h1>
          <p className="mt-1 text-xs text-slate-500">{ui.subtitle}</p>
          <div
            className="mt-3 flex justify-center"
            role="group"
            aria-label={ui.language}
          >
            <div className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-1">
              {LANGUAGES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleLanguageChange(code)}
                  aria-pressed={chat.lang === code}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium tracking-wide transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                    chat.lang === code ? 'bg-cyan-500/90 text-slate-950' : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="relative mt-6 w-[min(100%,420px,45.8vh)]">
          <div className={`pointer-events-none absolute -inset-4 rounded-[3rem] blur-md transition-colors duration-500 ${HALO_STYLES[haloState(chat)]}`} />
          <AvatarVideo isSpeaking={chat.isSpeaking} />
        </div>

        <div className="mt-4 flex h-6 items-end justify-center gap-1.5" aria-hidden="true">
          {chat.isSpeaking && [0, 1, 2, 3, 4].map((index) => (
            <span
              key={index}
              className="wave-bar h-full w-1 rounded-full bg-cyan-300/80"
              style={{ animationDelay: `${index * 110}ms` }}
            />
          ))}
        </div>

        <p className="mt-1 text-center text-xs text-slate-400" aria-live="polite">{statusLabel(chat, ui)}</p>

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={chat.isActive ? chat.hangUp : chat.startConversation}
            aria-label={chat.isActive ? ui.hangUp : ui.start}
            className={`flex h-16 w-16 items-center justify-center rounded-full shadow-lg shadow-black/30 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
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
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-40 disabled:hover:bg-white/5"
          >
            {ui.mute}
          </button>
        </div>

        {chat.error && (
          <p className="mt-3 max-w-md text-center text-xs text-rose-300/90" role="alert">{ui.errors[chat.error]}</p>
        )}

        <div className="mt-6 w-full max-w-lg text-center">
          <p className="line-clamp-3 text-sm leading-relaxed text-slate-300" aria-live="polite">
            {lastReply || ui.hint}
          </p>
          <button
            type="button"
            onClick={() => setShowHistory((visible) => !visible)}
            aria-expanded={showHistory}
            className="mt-2 text-xs text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            {showHistory ? ui.hideHistory : ui.viewHistory}
          </button>

          {showHistory && (
            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/80 p-3 text-left backdrop-blur">
              {chat.messages.length === 0 && (
                <p className="text-xs text-slate-500">{ui.emptyHistory}</p>
              )}
              {chat.messages.map((message, index) => (
                <div
                  key={`${index}-${message.role}`}
                  className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    message.role === 'assistant' ? 'bg-white/5 text-slate-200' : 'bg-cyan-500/10 text-cyan-100'
                  }`}
                >
                  <span className="mr-2 font-semibold uppercase tracking-wide text-slate-500">
                    {message.role === 'assistant' ? 'Jorge' : ui.you}
                  </span>
                  {message.content}
                </div>
              ))}
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-5 flex w-full max-w-md items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 transition focus-within:border-cyan-400/40"
        >
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={500}
            placeholder={ui.placeholder}
            aria-label={ui.placeholder}
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={chat.isThinking || !draft.trim()}
            aria-label={ui.send}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-500/90 text-slate-950 transition hover:bg-cyan-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:opacity-40"
          >
            <SendIcon />
          </button>
        </form>
      </main>
    </div>
  );
}
