"use client";

import React, { useState, useEffect, useRef } from "react";
import { PeerUser, VoicePeerUser } from "@/lib/socket";
import { VoiceCallManager } from "@/lib/webrtc/VoiceCallManager";

interface Participant {
  id: string;
  name: string;
  initials: string;
  bgColor: string;
  textColor: string;
}

interface ParticipantListProps {
  participants?: PeerUser[];
  participantIds?: string[];
  currentUserId?: string;
  currentUserName?: string;
  currentUserColor?: string;
  className?: string;
  voiceUsers?: VoicePeerUser[];
  voiceManager?: VoiceCallManager | null;
  isHost?: boolean;
  onHostMuteUser?: (targetSocketId: string) => void;
  onHostMuteAll?: () => void;
  onOpenVoiceSettings?: () => void;
}

// Preset palette matching design mockups (design/2, design/4)
const PALETTE_MAP: Record<string, string> = {
  "#93c5fd": "#1e3a8a", // Soft Blue
  "#c4b5fd": "#4c1d95", // Soft Purple
  "#fcd34d": "#78350f", // Amber
  "#86efac": "#14532d", // Green
  "#fca5a5": "#7f1d1d", // Rose
  "#fdba74": "#7c2d12", // Orange
};

const DEFAULT_BG_COLORS = [
  "#93c5fd",
  "#c4b5fd",
  "#fcd34d",
  "#86efac",
  "#fca5a5",
  "#fdba74",
];

function getTextColor(bgColor: string): string {
  const normalized = bgColor.toLowerCase();
  return PALETTE_MAP[normalized] || "#1f1f1d";
}

export function getInitials(name: string): string {
  if (!name) return "U";
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export default function ParticipantList({
  participants: externalParticipants,
  participantIds = [],
  currentUserId,
  currentUserName = "You",
  currentUserColor,
  className = "",
  voiceUsers = [],
  voiceManager,
  isHost,
  onHostMuteUser,
  onHostMuteAll,
  onOpenVoiceSettings,
}: ParticipantListProps) {
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
  const [userVolumes, setUserVolumes] = React.useState<Record<string, number>>({});
  const [localMuted, setLocalMuted] = React.useState<Record<string, boolean>>({});
  const popoverRef = React.useRef<HTMLDivElement>(null);

  const userMap = new Map<string, Participant>();

  // Close popover when clicking outside
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSelectedUserId(null);
      }
    }
    if (selectedUserId) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [selectedUserId]);

  // Update volume & mute states when selected participant changes
  React.useEffect(() => {
    if (!selectedUserId || !voiceManager) return;
    const targetPeer = voiceUsers?.find((v) => v.userId === selectedUserId);
    if (targetPeer) {
      setUserVolumes((prev) => ({
        ...prev,
        [selectedUserId]: voiceManager.getPeerVolume(targetPeer.socketId),
      }));
      setLocalMuted((prev) => ({
        ...prev,
        [selectedUserId]: voiceManager.isPeerLocallyMuted(targetPeer.socketId),
      }));
    }
  }, [selectedUserId, voiceManager, voiceUsers]);

  // 1. If real socket peer users are provided, populate from them
  if (externalParticipants && externalParticipants.length > 0) {
    externalParticipants.forEach((p) => {
      if (!userMap.has(p.userId)) {
        userMap.set(p.userId, {
          id: p.userId,
          name: p.displayName || "Guest",
          initials: getInitials(p.displayName || "Guest"),
          bgColor: p.avatarColor || "#93c5fd",
          textColor: getTextColor(p.avatarColor || "#93c5fd"),
        });
      }
    });
  }

  // 2. Always ensure the local user is present in the list
  if (currentUserId && !userMap.has(currentUserId)) {
    userMap.set(currentUserId, {
      id: currentUserId,
      name: currentUserName || "You",
      initials: getInitials(currentUserName || "You"),
      bgColor: currentUserColor || "#93c5fd",
      textColor: getTextColor(currentUserColor || "#93c5fd"),
    });
  }

  // 3. Fallback if only participantIds array was provided without full PeerUser objects
  if (userMap.size === 0 && participantIds.length > 0) {
    participantIds.forEach((pid, idx) => {
      const isCurrent = pid === currentUserId;
      const name = isCurrent ? (currentUserName || "You") : `Guest ${pid.slice(-4)}`;
      const color =
        isCurrent && currentUserColor
          ? currentUserColor
          : DEFAULT_BG_COLORS[idx % DEFAULT_BG_COLORS.length];
      userMap.set(pid, {
        id: pid,
        name,
        initials: getInitials(name),
        bgColor: color,
        textColor: getTextColor(color),
      });
    });
  }

  const list = Array.from(userMap.values());
  const totalWatching = list.length;

  // Build the avatar display stack
  const displayAvatars: Participant[] = [];
  if (totalWatching <= 3) {
    displayAvatars.push(...list);
  } else {
    displayAvatars.push(...list.slice(0, 2));
    const remaining = totalWatching - 2;
    displayAvatars.push({
      id: "remaining",
      name: `${remaining} more`,
      initials: `+${remaining}`,
      bgColor: "#fcd34d",
      textColor: "#78350f",
    });
  }

  const handleVolumeChange = (socketId: string, userId: string, val: number) => {
    setUserVolumes((prev) => ({ ...prev, [userId]: val }));
    voiceManager?.setPeerVolume(socketId, val);
  };

  const handleToggleLocalMute = (socketId: string, userId: string) => {
    const nextState = !localMuted[userId];
    setLocalMuted((prev) => ({ ...prev, [userId]: nextState }));
    voiceManager?.setPeerMuted(socketId, nextState);
  };

  return (
    <div className={`flex flex-col gap-2.5 relative ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-bold text-[#1f1f1d] dark:text-[#f3efe8] tracking-tight">
          {totalWatching} watching
        </div>
        {isHost && (voiceUsers?.length || 0) > 1 && onHostMuteAll && (
          <button
            type="button"
            onClick={onHostMuteAll}
            className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800/80 rounded-md transition-colors cursor-pointer shadow-2xs"
            title="Silence all microphones in room"
          >
            Mute All Mics
          </button>
        )}
      </div>

      {/* Avatar stack (vertical list matching design/2-watch-room.jpg) */}
      <div className="flex flex-col gap-2">
        {displayAvatars.map((avatar) => {
          const isRemaining = avatar.id === "remaining";
          const voiceInfo = voiceUsers?.find((v) => v.userId === avatar.id);
          const isInVoice = Boolean(voiceInfo);
          const isMuted = Boolean(voiceInfo?.isMuted);
          const isSpeaking = Boolean(voiceInfo?.isSpeaking);
          const isSelected = selectedUserId === avatar.id;

          return (
            <div key={avatar.id} className="relative inline-block w-8 h-8">
              <button
                type="button"
                disabled={isRemaining}
                onClick={() => setSelectedUserId(isSelected ? null : avatar.id)}
                title={`${avatar.name}${
                  isInVoice
                    ? isMuted
                      ? " (Voice: Muted)"
                      : isSpeaking
                      ? " (Voice: Speaking)"
                      : " (In Voice)"
                    : ""
                } - Click for audio controls`}
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-xs transition-all hover:scale-105 select-none cursor-pointer ${
                  isSpeaking
                    ? "ring-2 ring-emerald-500 ring-offset-1 ring-offset-white dark:ring-offset-[#121110] animate-pulse"
                    : isInVoice
                    ? "ring-1 ring-emerald-500/50"
                    : ""
                } ${isSelected ? "ring-2 ring-[#1f1f1d] dark:ring-[#f3efe8]" : ""}`}
                style={{ backgroundColor: avatar.bgColor, color: avatar.textColor }}
              >
                {avatar.initials}
              </button>

              {/* Voice status indicator badge */}
              {isInVoice && (
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center border-2 border-white dark:border-[#161514] shadow-2xs pointer-events-none ${
                    isMuted ? "bg-red-500" : isSpeaking ? "bg-emerald-500 animate-pulse" : "bg-emerald-500"
                  }`}
                  title={isMuted ? "Microphone muted" : "In voice party"}
                >
                  {isMuted ? (
                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 3l18 18" />
                    </svg>
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
              )}

              {/* Floating Participant Audio Card Popover */}
              {isSelected && (
                <div
                  ref={popoverRef}
                  className="absolute right-10 top-0 z-50 w-64 p-3 rounded-2xl bg-white dark:bg-[#1a1917] border border-[#e5e2db] dark:border-[#33312b] shadow-2xl flex flex-col gap-2.5 animate-in fade-in slide-in-from-right-2 duration-150 text-left"
                >
                  {/* Popover Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px]"
                        style={{ backgroundColor: avatar.bgColor, color: avatar.textColor }}
                      >
                        {avatar.initials}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-[#1f1f1d] dark:text-[#f3efe8] leading-tight">
                          {avatar.name} {avatar.id === currentUserId ? "(You)" : ""}
                        </span>
                        <span className="text-[10px] text-[#706e68] dark:text-[#a09d95]">
                          {isInVoice
                            ? isSpeaking
                              ? "Speaking"
                              : isMuted
                              ? "Mic Muted"
                              : "Listening"
                            : "Watching"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedUserId(null)}
                      className="text-xs text-[#706e68] hover:text-[#1f1f1d] dark:text-[#a09d95] dark:hover:text-[#f3efe8] p-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Audio Controls for Remote Peer in Voice */}
                  {isInVoice && avatar.id !== currentUserId && voiceInfo && (
                    <div className="flex flex-col gap-2 pt-1 border-t border-[#e5e2db] dark:border-[#2c2a26]">
                      {/* Volume Slider */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-[#1f1f1d] dark:text-[#f3efe8]">
                          <span>Volume</span>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400">
                            {localMuted[avatar.id] ? "0%" : `${userVolumes[avatar.id] ?? 100}%`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          disabled={localMuted[avatar.id]}
                          value={localMuted[avatar.id] ? 0 : userVolumes[avatar.id] ?? 100}
                          onChange={(e) =>
                            handleVolumeChange(voiceInfo.socketId, avatar.id, Number(e.target.value))
                          }
                          className="w-full h-1.5 bg-[#e5e2db] dark:bg-[#33312b] rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-40"
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleToggleLocalMute(voiceInfo.socketId, avatar.id)}
                          className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border ${
                            localMuted[avatar.id]
                              ? "bg-red-500 text-white border-red-600 hover:bg-red-600"
                              : "bg-[#f5f2eb] dark:bg-[#242320] border-[#d6d2c9] dark:border-[#33312b] text-[#1f1f1d] dark:text-[#f3efe8] hover:bg-[#ebe7de]"
                          }`}
                        >
                          {localMuted[avatar.id] ? "Muted for You" : "Mute for Me"}
                        </button>

                        {isHost && (
                          <button
                            type="button"
                            onClick={() => {
                              onHostMuteUser?.(voiceInfo.socketId);
                              setSelectedUserId(null);
                            }}
                            className="py-1 px-2 rounded-lg text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer shadow-2xs"
                            title="Mute participant for the room"
                          >
                            Mute in Room
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Current User Card Content */}
                  {avatar.id === currentUserId && (
                    <div className="flex flex-col gap-2 pt-1 border-t border-[#e5e2db] dark:border-[#2c2a26]">
                      <p className="text-[11px] text-[#706e68] dark:text-[#a09d95]">
                        This is your profile. Adjust your microphone input gain or test audio in Voice Settings.
                      </p>
                      {onOpenVoiceSettings && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUserId(null);
                            onOpenVoiceSettings();
                          }}
                          className="w-full py-1.5 px-2 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          ⚙️ Mic Settings & Mixer
                        </button>
                      )}
                    </div>
                  )}

                  {/* Remote User Not In Voice */}
                  {!isInVoice && avatar.id !== currentUserId && (
                    <div className="pt-1 border-t border-[#e5e2db] dark:border-[#2c2a26] text-[11px] text-[#706e68] dark:text-[#a09d95]">
                      Not connected to voice party.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
