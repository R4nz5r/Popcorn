"use client";

import React, { useState, useEffect, useRef } from "react";
import { VoiceCallManager } from "@/lib/webrtc/VoiceCallManager";
import { VoicePeerUser } from "@/lib/socket";

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  voiceManager: VoiceCallManager | null;
  voiceUsers: VoicePeerUser[];
  currentUserId?: string;
  isHost?: boolean;
  onHostMuteUser?: (targetSocketId: string) => void;
  onHostMuteAll?: () => void;
}

export default function VoiceSettingsModal({
  isOpen,
  onClose,
  voiceManager,
  voiceUsers,
  currentUserId,
  isHost,
  onHostMuteUser,
  onHostMuteAll,
}: VoiceSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"mic" | "mixer">("mic");
  const [inputGain, setInputGainState] = useState<number>(100);
  const [micLevel, setMicLevel] = useState<number>(0);

  // Peer volumes & local mute states keyed by socketId
  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>({});
  const [peerMuted, setPeerMuted] = useState<Record<string, boolean>>({});

  const meterAnimationRef = useRef<number | null>(null);

  // Synchronize initial values when modal opens
  useEffect(() => {
    if (!isOpen || !voiceManager) return;

    // Load initial input gain
    const currentGain = Math.round(voiceManager.getInputGain() * 100);
    setInputGainState(currentGain);

    // Load initial peer volumes & local mute states
    const initialVols: Record<string, number> = {};
    const initialMuted: Record<string, boolean> = {};

    voiceUsers.forEach((peer) => {
      initialVols[peer.socketId] = voiceManager.getPeerVolume(peer.socketId);
      initialMuted[peer.socketId] = voiceManager.isPeerLocallyMuted(peer.socketId);
    });

    setPeerVolumes(initialVols);
    setPeerMuted(initialMuted);

    // Live VU meter update loop
    const updateMeter = () => {
      if (voiceManager) {
        const level = voiceManager.getMicLevel();
        setMicLevel(level);
      }
      meterAnimationRef.current = requestAnimationFrame(updateMeter);
    };

    meterAnimationRef.current = requestAnimationFrame(updateMeter);

    return () => {
      if (meterAnimationRef.current) {
        cancelAnimationFrame(meterAnimationRef.current);
        meterAnimationRef.current = null;
      }
    };
  }, [isOpen, voiceManager, voiceUsers]);

  if (!isOpen) return null;

  const handleGainChange = (newVal: number) => {
    setInputGainState(newVal);
    voiceManager?.setInputGain(newVal / 100);
  };

  const handlePeerVolumeChange = (socketId: string, val: number) => {
    setPeerVolumes((prev) => ({ ...prev, [socketId]: val }));
    voiceManager?.setPeerVolume(socketId, val);
  };

  const handleTogglePeerMute = (socketId: string) => {
    const nextState = !peerMuted[socketId];
    setPeerMuted((prev) => ({ ...prev, [socketId]: nextState }));
    voiceManager?.setPeerMuted(socketId, nextState);
  };

  const otherVoiceUsers = voiceUsers.filter((u) => u.userId !== currentUserId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white dark:bg-[#1a1917] border border-[#e5e2db] dark:border-[#33312b] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e2db] dark:border-[#2c2a26]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1f1f1d] dark:text-[#f3efe8]">Voice Settings</h2>
              <p className="text-[11px] text-[#706e68] dark:text-[#a09d95]">Audio volume, mic test, and room mixer</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#706e68] hover:text-[#1f1f1d] dark:text-[#a09d95] dark:hover:text-[#f3efe8] hover:bg-[#f5f2eb] dark:hover:bg-[#2c2a26] transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#e5e2db] dark:border-[#2c2a26] px-5 pt-2 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("mic")}
            className={`pb-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === "mic"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-[#706e68] dark:text-[#a09d95] hover:text-[#1f1f1d] dark:hover:text-[#f3efe8]"
            }`}
          >
            My Microphone
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("mixer")}
            className={`pb-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "mixer"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-[#706e68] dark:text-[#a09d95] hover:text-[#1f1f1d] dark:hover:text-[#f3efe8]"
            }`}
          >
            <span>Voice Mixer</span>
            {otherVoiceUsers.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#e5e2db] dark:bg-[#2c2a26] text-[#1f1f1d] dark:text-[#f3efe8]">
                {otherVoiceUsers.length}
              </span>
            )}
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-5">
          {activeTab === "mic" ? (
            <>
              {/* Mic Input Volume Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#1f1f1d] dark:text-[#f3efe8]">
                  <span>Microphone Input Volume</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono">{inputGain}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="150"
                  step="5"
                  value={inputGain}
                  onChange={(e) => handleGainChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-[#e5e2db] dark:bg-[#33312b] rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[10px] text-[#706e68] dark:text-[#a09d95]">
                  <span>0% (Muted)</span>
                  <span>100% (Normal)</span>
                  <span>150% (Boost)</span>
                </div>
              </div>

              {/* Realtime Mic Level VU Meter */}
              <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-[#f5f2eb] dark:bg-[#242320] border border-[#e5e2db] dark:border-[#33312b]">
                <div className="flex items-center justify-between text-xs font-semibold text-[#1f1f1d] dark:text-[#f3efe8]">
                  <span>Live Mic Level Test</span>
                  <span className="text-[11px] text-[#706e68] dark:text-[#a09d95]">Speak to test</span>
                </div>

                <div className="w-full h-2.5 bg-[#e5e2db] dark:bg-[#1a1917] rounded-full overflow-hidden p-0.5 flex">
                  <div
                    className="h-full rounded-full transition-all duration-75 bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400"
                    style={{ width: `${Math.min(100, Math.max(micLevel, 0))}%` }}
                  />
                </div>

                <p className="text-[11px] text-[#706e68] dark:text-[#a09d95] leading-relaxed">
                  If the bar moves into the green when you speak, your microphone is working cleanly with high-pass filtering and noise suppression.
                </p>
              </div>

              {/* Audio Engine Specs */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-[#e5e2db] dark:border-[#33312b] bg-white dark:bg-[#1e1d1b] text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-[#1f1f1d] dark:text-[#f3efe8]">Opus HD Voice 64 kbps</span>
                </div>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">FEC Active</span>
              </div>
            </>
          ) : (
            /* Voice Mixer Tab */
            <div className="flex flex-col gap-4">
              {/* Host Mute All Action */}
              {isHost && otherVoiceUsers.length > 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60">
                  <div className="text-xs">
                    <div className="font-bold text-amber-900 dark:text-amber-200">Host Moderation</div>
                    <div className="text-[11px] text-amber-700 dark:text-amber-400">Silence all room microphones for watching</div>
                  </div>
                  <button
                    type="button"
                    onClick={onHostMuteAll}
                    className="px-2.5 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                  >
                    Mute All Mics
                  </button>
                </div>
              )}

              {otherVoiceUsers.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#706e68] dark:text-[#a09d95]">
                  No other participants are currently in the voice party.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {otherVoiceUsers.map((user) => {
                    const vol = peerVolumes[user.socketId] ?? 100;
                    const isLocallyMuted = Boolean(peerMuted[user.socketId]);

                    return (
                      <div
                        key={user.socketId}
                        className="flex flex-col gap-2 p-3 rounded-xl border border-[#e5e2db] dark:border-[#33312b] bg-[#f5f2eb]/60 dark:bg-[#242320]/60"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs"
                              style={{ backgroundColor: user.avatarColor || "#93c5fd", color: "#1e3a8a" }}
                            >
                              {(user.displayName || "U").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-[#1f1f1d] dark:text-[#f3efe8]">
                                {user.displayName}
                              </span>
                              <span className="text-[10px] text-[#706e68] dark:text-[#a09d95]">
                                {user.isSpeaking ? "Speaking" : user.isMuted ? "Mic Muted" : "Listening"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Local Mute for Me Toggle */}
                            <button
                              type="button"
                              onClick={() => handleTogglePeerMute(user.socketId)}
                              title={isLocallyMuted ? "Unmute for me" : "Mute for me"}
                              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer border ${
                                isLocallyMuted
                                  ? "bg-red-500 text-white border-red-600 hover:bg-red-600"
                                  : "bg-white dark:bg-[#1a1917] border-[#d6d2c9] dark:border-[#33312b] text-[#1f1f1d] dark:text-[#f3efe8] hover:bg-[#ebe7de]"
                              }`}
                            >
                              {isLocallyMuted ? "Muted for You" : "Mute for Me"}
                            </button>

                            {/* Host Moderation Mute in Room */}
                            {isHost && (
                              <button
                                type="button"
                                onClick={() => onHostMuteUser?.(user.socketId)}
                                title="Mute participant for entire room"
                                className="px-2 py-1 rounded-md text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer shadow-2xs"
                              >
                                Mute in Room
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Individual Volume Slider */}
                        <div className="flex items-center gap-3 pt-1">
                          <svg className="w-3.5 h-3.5 text-[#706e68] dark:text-[#a09d95] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                            />
                          </svg>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={isLocallyMuted ? 0 : vol}
                            disabled={isLocallyMuted}
                            onChange={(e) => handlePeerVolumeChange(user.socketId, Number(e.target.value))}
                            className="flex-1 h-1.5 bg-[#e5e2db] dark:bg-[#33312b] rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-40"
                          />
                          <span className="text-[11px] font-mono text-[#1f1f1d] dark:text-[#f3efe8] w-8 text-right">
                            {isLocallyMuted ? "0%" : `${vol}%`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-[#e5e2db] dark:border-[#2c2a26] bg-[#f5f2eb]/40 dark:bg-[#242320]/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-[#1f1f1d] dark:bg-[#f3efe8] text-white dark:text-[#1f1f1d] rounded-xl hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
