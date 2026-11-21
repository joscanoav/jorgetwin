import { useState } from 'react';
import AvatarVideo from './components/AvatarVideo.jsx';
import useVoiceChat from './hooks/useVoiceChat.js';

const HALO_STYLES = {
  idle: 'bg-slate-500/10 ring-1 ring-slate-300/5 halo-idle',
  listening: 'bg-emerald-400/20 ring-1 ring-emerald-300/30 halo-listening',
  thinking: 'halo-thinking ring-1 ring-sky-300/20',
  speaking: 'bg-cyan-400/25 ring-1 ring-cyan-200/40 halo-speaking',
};

function statusLabel(chat) {
  if (chat.isThinking) return 'Pensando…';
  if (chat.isSpeaking) return 'Jorge está hablando…';
  if (chat.isListening) return 'Te escucho…';
  return 'Listo';
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

  const lastReply = [...chat.messages].reverse().find((message) => message.role === 'assistant')?.content;

  const handleSubmit = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    chat.sendText(text);
  };

  return (
    <div className="app-bg min-h-screen text-slate-100">
      <div className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-slate-950/70 px-4 py-1.5 text-center text-[11px] text-slate-400 backdrop-blur">
        Soy una IA, clon de Jorge. No escribas datos personales.
      </div>

      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center px-4 pb-10 pt-12">
        <header className="mb-6 text-center">
          <h1 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-300">Habla con Jorge</h1>
          <p className="mt-1 text-xs text-slate-500">Ciencias de la Computación · ESO y Bachillerato</p>
        </header>

        <div className="relative w-[min(100%,420px,45.8vh)]">
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

        <p className="mt-1 text-center text-xs text-slate-400" aria-live="polite">{statusLabel(chat)}</p>

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={chat.isActive ? chat.hangUp : chat.startConversation}
            aria-label={chat.isActive ? 'Colgar' : 'Hablar con Jorge'}
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
            Silenciar
          </button>
        </div>

        {chat.error && (
          <p className="mt-3 max-w-md text-center text-xs text-rose-300/90" role="alert">{chat.error}</p>
        )}

        <div className="mt-6 w-full max-w-lg text-center">
          <p className="line-clamp-3 text-sm leading-relaxed text-slate-300" aria-live="polite">
            {lastReply || 'Pulsa el micrófono para empezar a hablar con Jorge.'}
          </p>
          <button
            type="button"
            onClick={() => setShowHistory((visible) => !visible)}
            aria-expanded={showHistory}
            className="mt-2 text-xs text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            {showHistory ? 'Ocultar conversación' : 'Ver conversación'}
          </button>

          {showHistory && (
            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/80 p-3 text-left backdrop-blur">
              {chat.messages.length === 0 && (
                <p className="text-xs text-slate-500">Aún no hay conversación.</p>
              )}
              {chat.messages.map((message, index) => (
                <div
                  key={`${index}-${message.role}`}
                  className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    message.role === 'assistant' ? 'bg-white/5 text-slate-200' : 'bg-cyan-500/10 text-cyan-100'
                  }`}
                >
                  <span className="mr-2 font-semibold uppercase tracking-wide text-slate-500">
                    {message.role === 'assistant' ? 'Jorge' : 'Tú'}
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
            placeholder="O escribe tu pregunta…"
            aria-label="Escribe tu pregunta"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={chat.isThinking || !draft.trim()}
            aria-label="Enviar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-500/90 text-slate-950 transition hover:bg-cyan-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:opacity-40"
          >
            <SendIcon />
          </button>
        </form>
      </main>
    </div>
  );
}
