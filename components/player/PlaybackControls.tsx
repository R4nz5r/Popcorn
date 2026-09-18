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
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);

  const displayTime = dragTime !== null ? dragTime : currentTime;
  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;

  const calculateTimeFromEvent = useCallback(
    (e: MouseEvent | React.MouseEvent<HTMLDivElement> | TouchEvent | React.TouchEvent<HTMLDivElement>) => {
      if (!progressBarRef.current || duration <= 0) return 0;
      const rect = progressBarRef.current.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const percentage = clickX / rect.width;
      return percentage * duration;
    },
    [duration]
  );

  const canSeek = isHost || syncStatus === "host-left";

  const handlePointerDown = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!canSeek) return;
    e.preventDefault();
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
    window.addEventListener("touchmove", handlePointerMove);
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
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const percentage = clickX / rect.width;
      return Math.round(Math.min(100, Math.max(0, percentage * 100)));
    },
    []
  );

  const handleVolumePointerDown = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
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

  return (
    <div
      className={`w-full bg-white rounded-2xl border border-[#d6d2c9] px-4 py-3 flex items-center gap-3 shadow-xs select-none ${className}`}
    >
      {/* Play / Pause Toggle */}
      <button
        type="button"
        onClick={onPlayPause}
        aria-label={isPlaying ? "Pause" : "Play"}
        title={isPlaying ? "Pause" : "Play"}
        className="p-1 flex items-center justify-center shrink-0 transition-opacity text-[#1f1f1d] hover:opacity-75 cursor-pointer"
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
      <div className="hidden sm:flex items-center text-xs font-mono font-medium text-[#4b5563] shrink-0 tracking-tight">
        <span>{formatTime(displayTime, duration)}</span>
        <span className="mx-1 text-[#9ca3af]">/</span>
        <span>{formatTime(duration, duration)}</span>
      </div>

      {/* Scrubber Progress Bar */}
      <div
        ref={progressBarRef}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        title={canSeek ? "Click or drag to seek" : "Only host controls playback"}
        className={`flex-1 py-2 group flex items-center relative ${
          canSeek ? "cursor-pointer" : "cursor-default"
        }`}
      >
        {/* Background track */}
        <div className="w-full h-1.5 bg-[#d6d2c9] rounded-full overflow-hidden relative">
          {/* Progress fill */}
          <div
            className="h-full bg-[#1f1f1d] transition-all duration-75"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Thumb indicator on hover or dragging (for host or when host left) */}
        {canSeek && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-[#1f1f1d] rounded-full shadow-sm transition-transform pointer-events-none ${
              isDragging ? "scale-125" : "opacity-0 group-hover:opacity-100"
            }`}
            style={{ left: `${progressPercent}%` }}
          />
        )}
      </div>

      {/* Sound / Volume Controls */}
      <div className="flex items-center gap-1.5 shrink-0 text-[#1f1f1d]">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
          className="p-1 hover:opacity-75 transition-opacity cursor-pointer flex items-center justify-center text-[#1f1f1d]"
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

        {/* Volume Bar Line matching time scrubber */}
        <div
          ref={volumeBarRef}
          onMouseDown={handleVolumePointerDown}
          onTouchStart={handleVolumePointerDown}
          className="w-16 sm:w-20 py-2 cursor-pointer flex items-center relative group"
          role="slider"
          aria-label="Volume slider"
          aria-valuenow={isMuted ? 0 : volume}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {/* Background track */}
          <div className="w-full h-1.5 bg-[#d6d2c9] rounded-full overflow-hidden relative">
            {/* Volume fill */}
            <div
              className="h-full bg-[#1f1f1d] transition-all duration-75"
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
          className="p-1 hover:opacity-75 transition-opacity cursor-pointer flex items-center justify-center text-[#1f1f1d] shrink-0"
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
                ? "bg-rose-100 text-rose-700 border border-rose-200"
                : "bg-[#cbf3bb] text-[#1b4317]"
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
            className="px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-amber-100 text-amber-900 border border-amber-200 select-none flex items-center gap-1.5 shadow-xs"
            title="The host has left the room. Playback is currently local and independent."
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
            Host Left
          </span>
        ) : (syncStatus ?? (isSynced ? "synced" : "syncing")) === "syncing" ? (
          <button
            type="button"
            onClick={onSyncToHost}
            title="Catching up or behind. Click to instantly sync with host"
            className="px-3 py-1 rounded-full text-xs font-semibold tracking-wide transition-all bg-amber-100 hover:bg-amber-200 active:scale-95 text-amber-800 cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <svg className="w-3 h-3 animate-spin text-amber-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync to Host
          </button>
        ) : (syncStatus ?? (isSynced ? "synced" : "syncing")) === "synced" ? (
          <button
            type="button"
            onClick={onSyncToHost}
            title="In sync with host. Click to re-sync anytime"
            className="px-3 py-1 rounded-full text-xs font-semibold tracking-wide transition-all bg-[#cbf3bb] hover:bg-[#bbf0a7] active:scale-95 text-[#1b4317] cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#1b4317]" />
            Synced
          </button>
        ) : (
          <span className="px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-neutral-200 text-neutral-600 select-none">
            Disconnected
          </span>
        )}
      </div>
    </div>
  );
}
