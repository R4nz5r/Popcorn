"use client";

import { useEffect, useRef, useState } from "react";

interface ScreenSharePlayerProps {
  stream: MediaStream | null;
  isPresenter: boolean;
  sharerName: string;
  onStopSharing: () => void;
}

export default function ScreenSharePlayer({
  stream,
  isPresenter,
  sharerName,
  onStopSharing,
}: ScreenSharePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [needsUserInteractionToUnmute, setNeedsUserInteractionToUnmute] = useState(false);

  const effectiveMuted = isPresenter || isMuted;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.muted = effectiveMuted;
    video.volume = volume / 100;

    video
      .play()
      .catch((err) => {
        if (err.name === "NotAllowedError") {
          // Autoplay policy prevented audio, mute and retry
          video.muted = true;
          setNeedsUserInteractionToUnmute(true);
          video.play().catch(() => {});
        }
      });
  }, [stream, effectiveMuted, volume]);

  const handleToggleMute = () => {
    if (isPresenter) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    setNeedsUserInteractionToUnmute(false);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isPresenter) return;
    const newVol = parseInt(e.target.value, 10);
    setVolume(newVol);
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const handleToggleFullscreen = () => {
    const container = containerRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };

    const isFs = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);

    if (!isFs) {
      if (container?.requestFullscreen) {
        container.requestFullscreen().catch(() => {});
        setIsFullscreen(true);
      } else if (container?.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
        setIsFullscreen(true);
      } else if (video?.webkitEnterFullscreen) {
        // iOS Safari native video fullscreen on iPhone
        video.webkitEnterFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const doc = document as Document & { webkitFullscreenElement?: Element };
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-[#262624] shadow-md flex items-center justify-center group"
    >
      {/* Stream Video Surface */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-contain"
      />

      {/* Top Banner: Sharer Info */}
      <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-white z-10">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
        </span>
        <span className="text-xs font-semibold tracking-wide">
          {isPresenter ? "You are sharing your screen" : `${sharerName}'s screen`}
        </span>
      </div>

      {/* Unmute prompt banner if browser blocked autoplay sound */}
      {needsUserInteractionToUnmute && !isPresenter && (
        <button
          type="button"
          onClick={handleToggleMute}
          className="absolute top-3 right-3 flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs px-3 py-1.5 rounded-xl shadow-lg transition-all cursor-pointer z-10"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          <span>Click to Unmute Audio</span>
        </button>
      )}

      {/* Hover Control Overlay Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between opacity-90 transition-opacity z-10">
        <div className="flex items-center gap-3">
          {isPresenter ? (
            <button
              type="button"
              onClick={onStopSharing}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-xs transition-colors cursor-pointer shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Stop Sharing</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={handleToggleMute}
                className="text-white/80 hover:text-white transition-colors cursor-pointer"
                title={effectiveMuted ? "Unmute" : "Mute"}
              >
                {effectiveMuted || volume === 0 ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                )}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={effectiveMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 sm:w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-white"
                title={`Volume: ${volume}%`}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white/90 hover:text-white border border-white/10 transition-colors cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
