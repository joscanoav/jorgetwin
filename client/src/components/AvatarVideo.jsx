import { useEffect, useRef, useState } from 'react';

export default function AvatarVideo({ isSpeaking }) {
  const videoRef = useRef(null);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || videoFailed) return;

    if (isSpeaking) {
      try { video.currentTime = 0; } catch { /* noop */ }
      video.play().catch(() => setVideoFailed(true));
    } else {
      video.pause();
    }
  }, [isSpeaking, videoFailed]);

  return (
    <div className="relative aspect-[36/55] w-full overflow-hidden rounded-[2.5rem] bg-slate-900 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
      <img
        src="/assets/jorge-idle.png"
        alt="Jorge en reposo"
        className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-500 ${isSpeaking && !videoFailed ? 'opacity-0' : 'opacity-100'}`}
      />
      {!videoFailed && (
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="auto"
          src="/assets/jorge-hablando.mp4"
          onError={() => setVideoFailed(true)}
          className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-500 ${isSpeaking ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
}
