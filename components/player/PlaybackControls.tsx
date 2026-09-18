"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  volume?: number;
  isMuted?: boolean;
  onVolumeChange?: (volume: number) => void;
  onToggleMute?: () => void;
  isSynced?: boolean;
  syncStatus?: "synced" | "syncing" | "disconnected" | "host-left";
  isHost?: boolean;
  onSyncToHost?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  className?: string;
}

function formatTime(seconds: number, referenceDuration?: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";

  const totalSecs = Math.floor(seconds);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  const useHours = (referenceDuration && referenceDuration >= 3600) || hrs > 0;

  if (useHours) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export default function PlaybackControls({
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  volume = 100,
  isMuted = false,
  onVolumeChange,
  onToggleMute,
  isSynced = true,
  syncStatus,
  isHost = true,
  onSyncToHost,
  isFullscreen = false,
  onToggleFullscreen,
  className = "",
}: PlaybackControlsProps) {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState<number | null>(null);

  const volumeBarRef = useRef<HTMLDivElement>(null);
  const volumeContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [isMobileVolumeOpen, setIsMobileVolumeOpen] = useState(false);

  const displayTime = dragTime !== null ? dragTime : currentTime;
  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;

  // Sound logo click: On mobile (<640px) toggle volume slider; on desktop toggle mute
  const handleSoundLogoClick = () => {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
    if (isMobile) {
      setIsMobileVolumeOpen((prev) => !prev);
    } else {
      onToggleMute?.();
    }
  };

  // Close mobile volume slider when clicking/tapping outside
  useEffect(() => {
    if (!isMobileVolumeOpen) return;

    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      if (isDraggingVolume) return;
      if (volumeContainerRef.current && !volumeContainerRef.current.contains(e.target as Node)) {
        setIsMobileVolumeOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDownOutside);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDownOutside);
    };
  }, [isMobileVolumeOpen, isDraggingVolume]);

  const getClientX = (
    e: MouseEvent | React.MouseEvent<HTMLDivElement> | TouchEvent | React.TouchEvent<HTMLDivElement>
  ): number => {
    if ("touches" in e) {
      if (e.touches && e.touches.length > 0) {
        return e.touches[0].clientX;
      }
      if ("changedTouches" in e && e.changedTouches && e.changedTouches.length > 0) {
        return e.changedTouches[0].clientX;
      }
      return 0;
    }
    return e.clientX;
  };

  const calculateTimeFromEvent = useCallback(
    (e: MouseEvent | React.MouseEvent<HTMLDivElement> | TouchEvent | React.TouchEvent<HTMLDivElement>) => {
      if (!progressBarRef.current || duration <= 0) return 0;
      const rect = progressBarRef.current.getBoundingClientRect();
      const clientX = getClientX(e);
      const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const percentage = clickX / rect.width;
      return percentage * duration;
    },
    [duration]
  );

  const canSeek = isHost || syncStatus === "host-left";

  const handlePointerDown = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!canSeek) return;
    setIsDragging(true);
    const targetTime = calculateTimeFromEvent(e);
    setDragTime(targetTime);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const targetTime = calculateTimeFromEvent(e);
      setDragTime(targetTime);
    };

    const handlePointerUp = (e: MouseEvent | TouchEvent) => {
      setIsDragging(false);
      const finalTime = calculateTimeFromEvent(e);
      setDragTime(null);
      onSeek(finalTime);
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove, { passive: true });
    window.addEventListener("touchend", handlePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);
    };
  }, [isDragging, calculateTimeFromEvent, onSeek]);

  const calculateVolumeFromEvent = useCallback(
    (e: MouseEvent | React.MouseEvent<HTMLDivElement> | TouchEvent | React.TouchEvent<HTMLDivElement>) => {
      if (!volumeBarRef.current) return 0;
      const rect = volumeBarRef.current.getBoundingClientRect();
      const clientX = getClientX(e);
      const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const percentage = clickX / rect.width;
      return Math.round(Math.min(100, Math.max(0, percentage * 100)));
    },
    []
  );

  const handleVolumePointerDown = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    setIsDraggingVolume(true);
    const targetVol = calculateVolumeFromEvent(e);
    onVolumeChange?.(targetVol);
  };

  useEffect(() => {
    if (!isDraggingVolume) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const targetVol = calculateVolumeFromEvent(e);
      onVolumeChange?.(targetVol);
    };

    const handlePointerUp = () => {
      setIsDraggingVolume(false);
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove);
    window.addEventListener("touchend", handlePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);
    };
  }, [isDraggingVolume, calculateVolumeFromEvent, onVolumeChange]);

  const isDarkFs = isFullscreen;

  return (
    <div
      className={`w-full rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xs select-none transition-colors ${
        isDarkFs
          ? "bg-[#141413]/90 border border-white/20 text-white shadow-2xl backdrop-blur-md"
          : "bg-white dark:bg-[#1c1b18] border border-[#d6d2c9] dark:border-[#2b2925] text-[#1f1f1d] dark:text-[#f3efe8]"
      } ${className}`}
    >
      {/* Play / Pause Toggle */}
      <button
        type="button"
        onClick={onPlayPause}
        aria-label={isPlaying ? "Pause" : "Play"}
        title={isPlaying ? "Pause" : "Play"}
        className={`p-1 flex items-center justify-center shrink-0 transition-opacity hover:opacity-75 cursor-pointer ${
          isDarkFs ? "text-white" : "text-[#1f1f1d] dark:text-[#f3efe8]"
        }`}
      >
        {isPlaying ? (
          // Pause Icon: two vertical bars
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <rect x="5" y="4" width="4" height="16" rx="1" />
            <rect x="15" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          // Play Icon: solid triangle
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4.5v15a1 1 0 0 0 1.524.852l12-7.5a1 1 0 0 0 0-1.704l-12-7.5A1 1 0 0 0 6 4.5z" />
          </svg>
        )}
      </button>

      {/* Time Display (hidden on very small screens if needed, or shown in monospace) */}
      <div
        className={`hidden sm:flex items-center text-xs font-mono font-medium shrink-0 tracking-tight ${
          isDarkFs ? "text-neutral-300" : "text-[#4b5563] dark:text-[#a8a49c]"
        }`}
      >
        <span>{formatTime(displayTime, duration)}</span>
        <span className={`mx-1 ${isDarkFs ? "text-neutral-500" : "text-[#9ca3af] dark:text-[#737069]"}`}>/</span>
        <span>{formatTime(duration, duration)}</span>
      </div>

      {/* Scrubber Progress Bar */}
      <div
        ref={progressBarRef}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        title={canSeek ? "Click or drag to seek" : "Only host controls playback"}
        className={`flex-1 py-2.5 sm:py-2 group flex items-center relative touch-none ${
          canSeek ? "cursor-pointer" : "cursor-default"
        }`}
      >
        {/* Background track */}
        <div
          className={`w-full h-1.5 rounded-full overflow-hidden relative ${
            isDarkFs ? "bg-white/20" : "bg-[#d6d2c9] dark:bg-[#33312b]"
          }`}
        >
          {/* Progress fill */}
          <div
            className={`h-full transition-all duration-75 ${
              isDarkFs ? "bg-white" : "bg-[#1f1f1d] dark:bg-[#f59e0b]"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Thumb indicator on hover or dragging (for host or when host left) */}
        {canSeek && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full shadow-sm transition-transform pointer-events-none ${
              isDarkFs ? "bg-white" : "bg-[#1f1f1d] dark:bg-[#fbbf24]"
            } ${isDragging ? "scale-125" : "opacity-0 group-hover:opacity-100"}`}
            style={{ left: `${progressPercent}%` }}
          />
        )}
      </div>

      {/* Sound / Volume Controls */}
      <div
        ref={volumeContainerRef}
        className={`flex items-center shrink-0 ${
          isDarkFs ? "text-white" : "text-[#1f1f1d] dark:text-[#f3efe8]"
        }`}
      >
        <button
          type="button"
          onClick={handleSoundLogoClick}
          aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
          title={isMuted || volume === 0 ? "Unmute" : "Mute"}
          className={`p-1 hover:opacity-75 transition-opacity cursor-pointer flex items-center justify-center ${
            isDarkFs ? "text-white" : "text-[#1f1f1d] dark:text-[#f3efe8]"
          }`}
        >
          {isMuted || volume === 0 ? (
            // Muted speaker icon
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L21 13.5m0-3.75l-3.75 3.75M15.536 8.464a5 5 0 010 7.072M11 5L6 9H2v6h4l5 4V5z" />
            </svg>
          ) : volume < 50 ? (
            // Low volume speaker icon
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M11 5L6 9H2v6h4l5 4V5z" />
            </svg>
          ) : (
            // High volume speaker icon
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07M11 5L6 9H2v6h4l5 4V5z" />
            </svg>
          )}
        </button>

        {/* Volume Bar Line matching time scrubber: collapsible on mobile, visible on desktop */}
        <div
          ref={volumeBarRef}
          onMouseDown={handleVolumePointerDown}
          onTouchStart={handleVolumePointerDown}
          className={`py-2.5 sm:py-2 cursor-pointer flex items-center relative group touch-none transition-all duration-200 ease-out ${
            isMobileVolumeOpen
              ? "w-16 opacity-100 pointer-events-auto ml-1.5"
              : "w-0 opacity-0 pointer-events-none overflow-hidden ml-0 sm:w-20 sm:opacity-100 sm:pointer-events-auto sm:ml-1.5 sm:overflow-visible"
          }`}
          role="slider"
          aria-label="Volume slider"
          aria-valuenow={isMuted ? 0 : volume}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {/* Background track */}
          <div
            className={`w-full h-1.5 rounded-full overflow-hidden relative ${
              isDarkFs ? "bg-white/20" : "bg-[#d6d2c9] dark:bg-[#33312b]"
            }`}
          >
            {/* Volume fill */}
            <div
              className={`h-full transition-all duration-75 ${
                isDarkFs ? "bg-white" : "bg-[#1f1f1d] dark:bg-[#f59e0b]"
              }`}
              style={{ width: `${isMuted ? 0 : volume}%` }}
            />
          </div>
        </div>
      </div>

      {/* Fullscreen Button */}
      {onToggleFullscreen && (
        <button
          type="button"
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          className={`p-1 hover:opacity-75 transition-opacity cursor-pointer flex items-center justify-center shrink-0 ${
            isDarkFs ? "text-white" : "text-[#1f1f1d] dark:text-[#f3efe8]"
          }`}
        >
          {isFullscreen ? (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          )}
        </button>
      )}

      {/* Synced Status Badge / Interactive Sync Button */}
      <div className="shrink-0 flex items-center">
        {isHost ? (
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide select-none ${
              syncStatus === "disconnected"
                ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60"
                : "bg-[#cbf3bb] dark:bg-emerald-950/60 text-[#1b4317] dark:text-emerald-300 dark:border dark:border-emerald-800/50"
            }`}
            title={
              syncStatus === "disconnected"
                ? "Host: Disconnected from sync server (Refresh page to reconnect)"
                : "You are the room host"
            }
          >
            {syncStatus === "disconnected" ? "Host (Disconnected)" : "Host"}
          </span>
        ) : (syncStatus ?? (isSynced ? "synced" : "syncing")) === "host-left" ? (
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 select-none flex items-center gap-1.5 shadow-xs"
            title="The host has left the room. Playback is currently local and independent."
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400" />
            Host Left
          </span>
        ) : (syncStatus ?? (isSynced ? "synced" : "syncing")) === "syncing" ? (
          <button
            type="button"
            onClick={onSyncToHost}
            title="Catching up or behind. Click to instantly sync with host"
            className="px-3 py-1 rounded-full text-xs font-semibold tracking-wide transition-all bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 dark:border dark:border-amber-800/60 active:scale-95 text-amber-800 dark:text-amber-300 cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <svg className="w-3 h-3 animate-spin text-amber-700 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync to Host
          </button>
        ) : (syncStatus ?? (isSynced ? "synced" : "syncing")) === "synced" ? (
          <button
            type="button"
            onClick={onSyncToHost}
            title="In sync with host. Click to re-sync anytime"
            className="px-3 py-1 rounded-full text-xs font-semibold tracking-wide transition-all bg-[#cbf3bb] hover:bg-[#bbf0a7] dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:border dark:border-emerald-800/50 active:scale-95 text-[#1b4317] dark:text-emerald-300 cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#1b4317] dark:bg-emerald-400" />
            Synced
          </button>
        ) : (
          <span className="px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-neutral-200 dark:bg-[#2c2a26] text-neutral-600 dark:text-[#95928a] select-none">
            Disconnected
          </span>
        )}
      </div>
    </div>
  );
}

