"use client";

import React from "react";

interface VoiceControlsProps {
  isInVoice: boolean;
  isConnecting?: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking?: boolean;
  voiceUserCount?: number;
  onJoinVoice: () => void;
  onLeaveVoice: () => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onOpenSettings?: () => void;
  variant?: "desktop" | "mobile";
  className?: string;
}

export default function VoiceControls({
  isInVoice,
  isConnecting = false,
  isMuted,
  isDeafened,
  isSpeaking = false,
  voiceUserCount = 0,
  onJoinVoice,
  onLeaveVoice,
  onToggleMute,
  onToggleDeafen,
  onOpenSettings,
  variant = "desktop",
  className = "",
}: VoiceControlsProps) {
  if (!isInVoice) {
    if (variant === "mobile") {
      return (
        <button
          type="button"
          onClick={onJoinVoice}
          disabled={isConnecting}
          className={`w-full flex items-center justify-between p-2 rounded-xl border border-[#e5e2db] dark:border-[#33312b] bg-white dark:bg-[#242320] hover:bg-[#f5f2eb] dark:hover:bg-[#2c2b27] text-[#1f1f1d] dark:text-[#f3efe8] transition-colors cursor-pointer text-xs font-semibold ${className}`}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <span>{isConnecting ? "Connecting to Voice..." : "Join Voice Party"}</span>
          </div>
          {voiceUserCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
              {voiceUserCount} online
            </span>
          )}
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={onJoinVoice}
        disabled={isConnecting}
        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs border ${
          voiceUserCount > 0
            ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/80"
            : "bg-white dark:bg-[#242320] border-[#d6d2c9] dark:border-[#33312b] hover:bg-[#f5f2eb] dark:hover:bg-[#2c2b27] text-[#1f1f1d] dark:text-[#f3efe8]"
        } ${className}`}
        title="Join room voice channel"
      >
        <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
        <span>{isConnecting ? "Connecting..." : "Join Voice"}</span>
        {voiceUserCount > 0 && (
          <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-100">
            {voiceUserCount}
          </span>
        )}
      </button>
    );
  }

  // When inside the voice channel:
  if (variant === "mobile") {
    return (
      <div className={`flex flex-col gap-1.5 p-2 rounded-xl border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/20 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Connected to Voice ({voiceUserCount})</span>
          </div>
          <div className="flex items-center gap-1.5">
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-md border border-[#d6d2c9] dark:border-[#33312b] bg-white dark:bg-[#242320] text-[#1f1f1d] dark:text-[#f3efe8] hover:bg-[#ebe7de] transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Voice Settings"
              >
                <svg className="w-3 h-3 text-[#706e68] dark:text-[#a09d95]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Mixer</span>
              </button>
            )}
            <button
              type="button"
              onClick={onLeaveVoice}
              className="text-[11px] font-semibold px-2 py-0.5 bg-red-600/90 hover:bg-red-700 text-white rounded-md transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
            >
              Leave
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <button
            type="button"
            onClick={onToggleMute}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
              isMuted
                ? "bg-red-100 dark:bg-red-950/70 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300"
                : "bg-white dark:bg-[#242320] border-[#d6d2c9] dark:border-[#33312b] text-[#1f1f1d] dark:text-[#f3efe8]"
            }`}
          >
            {isMuted ? (
              <>
                <svg className="w-3.5 h-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
                <span>Unmute</span>
              </>
            ) : (
              <>
                <svg className={`w-3.5 h-3.5 ${isSpeaking ? "text-emerald-500 animate-pulse" : "text-emerald-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span>Mute</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleDeafen}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
              isDeafened
                ? "bg-amber-100 dark:bg-amber-950/70 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300"
                : "bg-white dark:bg-[#242320] border-[#d6d2c9] dark:border-[#33312b] text-[#1f1f1d] dark:text-[#f3efe8]"
            }`}
          >
            {isDeafened ? "Undeafen" : "Deafen"}
          </button>
        </div>
      </div>
    );
  }

  // Desktop Pill
  return (
    <div
      className={`flex items-center gap-1 bg-[#f3efe8] dark:bg-[#242320] p-1 rounded-xl border ${
        isSpeaking
          ? "border-emerald-500 ring-2 ring-emerald-500/20"
          : "border-[#d6d2c9] dark:border-[#33312b]"
      } shadow-2xs transition-all ${className}`}
    >
      {/* Mute/Unmute Mic Toggle */}
      <button
        type="button"
        onClick={onToggleMute}
        className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
          isMuted
            ? "bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 hover:bg-red-200"
            : "bg-white dark:bg-[#1a1917] text-[#1f1f1d] dark:text-[#f3efe8] hover:bg-[#faf7f2] dark:hover:bg-[#2c2a26]"
        }`}
        title={isMuted ? "Unmute your microphone" : "Mute your microphone"}
      >
        {isMuted ? (
          <svg className="w-3.5 h-3.5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
          </svg>
        ) : (
          <svg className={`w-3.5 h-3.5 ${isSpeaking ? "text-emerald-500 animate-pulse" : "text-emerald-600 dark:text-emerald-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
        <span>{isMuted ? "Muted" : isSpeaking ? "Speaking" : "Voice"}</span>
      </button>

      {/* Deafen Toggle */}
      <button
        type="button"
        onClick={onToggleDeafen}
        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
          isDeafened
            ? "bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300"
            : "hover:bg-white/80 dark:hover:bg-[#1a1917] text-[#686762] dark:text-[#a8a49c]"
        }`}
        title={isDeafened ? "Undeafen (resume audio)" : "Deafen (mute all voice audio)"}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
          />
        </svg>
      </button>

      {/* Voice Settings & Mixer */}
      {onOpenSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg hover:bg-white/80 dark:hover:bg-[#1a1917] text-[#686762] dark:text-[#a8a49c] transition-colors cursor-pointer"
          title="Voice Settings (Mic volume, test, and mixer)"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      )}

      {/* Disconnect Voice */}
      <button
        type="button"
        onClick={onLeaveVoice}
        className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/60 transition-colors cursor-pointer"
        title="Leave voice party"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
          />
        </svg>
      </button>
    </div>
  );
}
