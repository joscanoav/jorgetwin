import { useState, useRef, useCallback, useEffect } from 'react';

const API_URL = '/api/chat';
const DEFAULT_LANG = 'es';
export const LANGUAGES = ['es', 'en', 'fr'];
export const GREETINGS = {
  es: 'Hola, ¿qué tal? Soy Jorge, ¿en qué te puedo ayudar?',
  en: "Hi, how are you? I'm Jorge, how can I help you?",
  fr: "Salut, ça va ? Je suis Jorge, comment puis-je t'aider ?",
};
const SPEECH_LANGS = { es: 'es-ES', en: 'en-US', fr: 'fr-FR' };
const FALLBACK_REPLIES = {
  es: 'No he entendido eso.',
  en: 'I did not understand that.',
  fr: "Je n'ai pas compris.",
};
const MAX_HISTORY = 6;

export default function useVoiceChat() {
  const speechSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const [lang, setLang] = useState(DEFAULT_LANG);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lastReply, setLastReply] = useState('');
  const [error, setError] = useState(null);

  const langRef = useRef(DEFAULT_LANG);
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const shouldListenRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isThinkingRef = useRef(false);
  const messagesRef = useRef([]);
  const lastFinalRef = useRef({ text: '', at: 0 });
  const startRetryRef = useRef(null);

  const setSpeaking = useCallback((value) => {
    isSpeakingRef.current = value;
    setIsSpeaking(value);
  }, []);

  const safeStart = useCallback(() => {
    const attemptStart = (attempt) => {
      if (!recognitionRef.current || !shouldListenRef.current) return;
      if (isSpeakingRef.current || isThinkingRef.current) return;
      try {
        recognitionRef.current.start();
      } catch (err) {
        if (err?.name === 'InvalidStateError') return;
        if (attempt < 3) {
          clearTimeout(startRetryRef.current);
          startRetryRef.current = setTimeout(() => attemptStart(attempt + 1), 300 * (attempt + 1));
          return;
        }
        console.error('Error arrancando reconocimiento:', err?.name ?? 'desconocido');
      }
    };
    attemptStart(0);
  }, []);

  const playAudio = useCallback((src) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(src);
    audioRef.current = audio;
    audio.onplay = () => setSpeaking(true);
    audio.onended = () => {
      audioRef.current = null;
      setSpeaking(false);
    };
    audio.onerror = () => {
      audioRef.current = null;
      setSpeaking(false);
    };
    setSpeaking(true);
    audio.play().catch(() => {
      audioRef.current = null;
      setSpeaking(false);
    });
  }, [setSpeaking]);

  const beginGreeting = useCallback((language) => {
    shouldListenRef.current = true;
    isThinkingRef.current = false;
    lastFinalRef.current = { text: '', at: 0 };
    setIsThinking(false);
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    setLastReply(GREETINGS[language]);
    const greetingMessage = { role: 'assistant', content: GREETINGS[language] };
    messagesRef.current = [greetingMessage];
    setIsActive(true);
    playAudio(`/assets/saludo-${language}.mp3`);
  }, [playAudio]);

  const sendToBackend = useCallback(async (text) => {
    const clean = text.trim();
    if (!clean) return;

    setIsThinking(true);
    isThinkingRef.current = true;
    setError(null);
    setTranscript(clean);
    setInterimTranscript('');

    const history = messagesRef.current.slice(-MAX_HISTORY);
    const userMessage = { role: 'user', content: clean };
    messagesRef.current = [...messagesRef.current, userMessage].slice(-(MAX_HISTORY * 2));

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: clean, history, lang: langRef.current }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const replyText = typeof data.text === 'string' && data.text
        ? data.text
        : FALLBACK_REPLIES[langRef.current];

      messagesRef.current = [
        ...messagesRef.current,
        { role: 'assistant', content: replyText },
      ].slice(-(MAX_HISTORY * 2));
      setLastReply(replyText);

      if (data.audioBase64) playAudio(`data:audio/mpeg;base64,${data.audioBase64}`);
    } catch (err) {
      console.error('Error al consultar a Jorge:', err?.message ?? 'desconocido');
      setError('connection');
      shouldListenRef.current = false;
      clearTimeout(startRetryRef.current);
      setIsListening(false);
    } finally {
      setIsThinking(false);
      isThinkingRef.current = false;
    }
  }, [playAudio]);

  const createRecognition = useCallback((language) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.lang = SPEECH_LANGS[language];
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onspeechstart = () => {};

    recognition.onresult = (event) => {
      if (isSpeakingRef.current || isThinkingRef.current) return;

      let interim = '';
      let finalText = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result?.[0]?.transcript?.trim();
        if (!text) continue;
        if (result.isFinal) finalText += `${text} `;
        else interim += `${text} `;
      }

      const cleanInterim = interim.trim();
      const cleanFinal = finalText.trim();
      setInterimTranscript(cleanInterim);

      if (!cleanFinal) return;

      const now = Date.now();
      if (cleanFinal === lastFinalRef.current.text && now - lastFinalRef.current.at < 1000) return;
      lastFinalRef.current = { text: cleanFinal, at: now };
      setInterimTranscript('');
      setTranscript(cleanFinal);
      sendToBackend(cleanFinal);
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') setError('micDenied');
      else if (event.error === 'language-not-supported') setError('languageNotSupported');
      else setError('micError');
      shouldListenRef.current = false;
      clearTimeout(startRetryRef.current);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (shouldListenRef.current && !isSpeakingRef.current && !isThinkingRef.current) {
        clearTimeout(startRetryRef.current);
        startRetryRef.current = setTimeout(() => {
          if (shouldListenRef.current && !isSpeakingRef.current && !isThinkingRef.current) safeStart();
        }, 250);
      }
    };

    return recognition;
  }, [safeStart, sendToBackend]);

  const recreateRecognition = useCallback((language) => {
    const previous = recognitionRef.current;
    if (previous) {
      previous.onstart = null;
      previous.onspeechstart = null;
      previous.onresult = null;
      previous.onerror = null;
      previous.onend = null;
      try { previous.abort(); } catch { /* noop */ }
    }
    recognitionRef.current = createRecognition(language);
  }, [createRecognition]);

  useEffect(() => {
    recognitionRef.current = createRecognition(langRef.current);

    return () => {
      shouldListenRef.current = false;
      clearTimeout(startRetryRef.current);
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onstart = null;
        recognition.onspeechstart = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        try { recognition.abort(); } catch { /* noop */ }
      }
      recognitionRef.current = null;
    };
  }, [createRecognition]);

  useEffect(() => {
    if (isSpeaking) {
      setIsPaused(true);
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
    } else {
      setIsPaused(false);
      if (shouldListenRef.current && !isThinkingRef.current) safeStart();
    }
  }, [isSpeaking, safeStart]);

  useEffect(() => {
    if (isSpeaking || error) {
      setTranscript('');
      setInterimTranscript('');
    }
  }, [isSpeaking, error]);

  const startConversation = useCallback(() => {
    beginGreeting(langRef.current);
  }, [beginGreeting]);

  const changeLanguage = useCallback((nextLang) => {
    if (!LANGUAGES.includes(nextLang) || nextLang === langRef.current) return;

    langRef.current = nextLang;
    setLang(nextLang);
    shouldListenRef.current = false;
    isThinkingRef.current = false;
    lastFinalRef.current = { text: '', at: 0 };
    clearTimeout(startRetryRef.current);
    recreateRecognition(nextLang);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeaking(false);
    setIsListening(false);
    setIsPaused(false);
    messagesRef.current = [];
    beginGreeting(nextLang);
  }, [beginGreeting, recreateRecognition, setSpeaking]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    clearTimeout(startRetryRef.current);
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeaking(false);
  }, [setSpeaking]);

  const hangUp = useCallback(() => {
    shouldListenRef.current = false;
    isThinkingRef.current = false;
    lastFinalRef.current = { text: '', at: 0 };
    clearTimeout(startRetryRef.current);
    try { recognitionRef.current?.abort(); } catch { /* noop */ }
    stopAudio();
    setIsListening(false);
    setIsPaused(false);
    setIsActive(false);
    setTranscript('');
    setInterimTranscript('');
    setLastReply('');
    messagesRef.current = [];
    setError(null);
  }, [stopAudio]);

  const sendText = useCallback((text) => {
    setIsActive(true);
    sendToBackend(text);
  }, [sendToBackend]);

  return {
    lang,
    speechSupported,
    isListening,
    isSpeaking,
    isThinking,
    isPaused,
    isActive,
    transcript,
    interimTranscript,
    lastReply,
    error,
    startConversation,
    changeLanguage,
    stopListening,
    stopAudio,
    hangUp,
    sendText,
  };
}
