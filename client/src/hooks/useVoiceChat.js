import { useState, useRef, useCallback, useEffect } from 'react';

const API_URL = '/api/chat';
export const GREETING = 'Hola, ¿qué tal? Soy Jorge, ¿en qué te puedo ayudar?';
const MAX_HISTORY = 6;

export default function useVoiceChat() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const shouldListenRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isThinkingRef = useRef(false);
  const messagesRef = useRef([]);
  const startRetryRef = useRef(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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

  const sendToBackend = useCallback(async (text) => {
    const clean = text.trim();
    if (!clean) return;

    setIsThinking(true);
    isThinkingRef.current = true;
    setError(null);
    setTranscript('');

    const history = messagesRef.current.slice(-MAX_HISTORY);
    const userMessage = { role: 'user', content: clean };
    messagesRef.current = [...messagesRef.current, userMessage].slice(-(MAX_HISTORY * 2));
    setMessages([...messagesRef.current]);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: clean, history }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const replyText = typeof data.text === 'string' && data.text
        ? data.text
        : 'No he entendido eso.';

      const assistantMessage = { role: 'assistant', content: replyText };
      messagesRef.current = [...messagesRef.current, assistantMessage].slice(-(MAX_HISTORY * 2));
      setMessages([...messagesRef.current]);

      if (data.audioBase64) playAudio(`data:audio/mpeg;base64,${data.audioBase64}`);
    } catch (err) {
      console.error('Error al consultar a Jorge:', err?.message ?? 'desconocido');
      setError('No se pudo conectar con Jorge. Inténtalo de nuevo.');
      if (shouldListenRef.current) safeStart();
    } finally {
      setIsThinking(false);
      isThinkingRef.current = false;
    }
  }, [playAudio, safeStart]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge, o escribe tu pregunta.');
      return undefined;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      if (isSpeakingRef.current || isThinkingRef.current) return;
      const last = event.results[event.results.length - 1];
      const text = last?.[0]?.transcript?.trim();
      if (!text) return;
      setTranscript(text);
      sendToBackend(text);
    };

    recognition.onstart = () => setIsListening(true);

    recognition.onend = () => {
      setIsListening(false);
      if (shouldListenRef.current && !isSpeakingRef.current && !isThinkingRef.current) {
        setTimeout(() => {
          if (shouldListenRef.current && !isSpeakingRef.current && !isThinkingRef.current) safeStart();
        }, 250);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Permiso de micrófono denegado. Puedes usar el campo de texto.');
        shouldListenRef.current = false;
        return;
      }
      console.error('Error de reconocimiento:', event.error);
      setError('Hubo un problema con el micrófono. Puedes usar el campo de texto.');
    };

    recognitionRef.current = recognition;

    return () => {
      shouldListenRef.current = false;
      recognition.onresult = null;
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      try { recognition.abort(); } catch { /* noop */ }
      recognitionRef.current = null;
    };
  }, [safeStart, sendToBackend]);

  useEffect(() => {
    if (isSpeaking) {
      setIsPaused(true);
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
    } else {
      setIsPaused(false);
      if (shouldListenRef.current && !isThinkingRef.current) safeStart();
    }
  }, [isSpeaking, safeStart]);

  const startConversation = useCallback(() => {
    shouldListenRef.current = true;
    isThinkingRef.current = false;
    setIsThinking(false);
    setError(null);
    setTranscript('');
    setMessages([{ role: 'assistant', content: GREETING }]);
    messagesRef.current = [{ role: 'assistant', content: GREETING }];
    setIsActive(true);
    playAudio('/assets/saludo.mp3');
  }, [playAudio]);

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
    clearTimeout(startRetryRef.current);
    try { recognitionRef.current?.abort(); } catch { /* noop */ }
    stopAudio();
    setIsListening(false);
    setIsPaused(false);
    setIsActive(false);
    setTranscript('');
    setMessages([]);
    messagesRef.current = [];
    setError(null);
  }, [stopAudio]);

  const sendText = useCallback((text) => {
    setIsActive(true);
    sendToBackend(text);
  }, [sendToBackend]);

  return {
    isListening,
    isSpeaking,
    isThinking,
    isPaused,
    isActive,
    transcript,
    messages,
    error,
    startConversation,
    stopListening,
    stopAudio,
    hangUp,
    sendText,
  };
}
