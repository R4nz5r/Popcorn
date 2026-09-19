"use client";

import React, { useState, useEffect, useCallback } from "react";
import { soundFx } from "@/lib/sound";

export interface ReactionItem {
  id: string;
  emoji: string;
  sender?: string;
  leftPercent: number; // 60% to 92%
  scale: number; // 0.85 to 1.3
}

interface FloatingReactionsProps {
  onSendReaction: (emoji: string) => void;
  incomingReaction?: { id: string; emoji: string; sender?: string } | null;
  className?: string;
}

const EMOJI_OPTIONS = ["🍿", "❤️", "😂", "😮", "🔥", "👏"];

export default function FloatingReactions({
  onSendReaction,
  incomingReaction,
  className = "",
}: FloatingReactionsProps) {
  const [reactions, setReactions] = useState<ReactionItem[]>([]);
  const [isBarExpanded, setIsBarExpanded] = useState(false);

  const addReactionBubble = useCallback((emoji: string, sender?: string) => {
    const newItem: ReactionItem = {
      id: `react-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      emoji,
      sender,
      leftPercent: 68 + Math.random() * 24, // Float along bottom-right
      scale: 0.9 + Math.random() * 0.4,
    };

    setReactions((prev) => [...prev.slice(-25), newItem]);
    soundFx.playReactionPop();
  }, []);

  // Listen to incoming socket reactions from other peers
  useEffect(() => {
    if (incomingReaction) {
      addReactionBubble(incomingReaction.emoji, incomingReaction.sender);
    }
  }, [incomingReaction, addReactionBubble]);

  // Clean up bubbles after animation completes (2.5 seconds)
  const removeReaction = (id: string) => {
    setReactions((prev) => prev.filter((r) => r.id !== id));
  };

  const handleEmojiClick = (emoji: string) => {
    addReactionBubble(emoji, "You");
    onSendReaction(emoji);
  };

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden z-20 rounded-2xl ${className}`}>
      {/* Floating Bubbles Canvas */}
      <div className="absolute inset-0 pointer-events-none">
        {reactions.map((item) => (
          <div
            key={item.id}
            onAnimationEnd={() => removeReaction(item.id)}
            style={{
              left: `${item.leftPercent}%`,
              transform: `scale(${item.scale})`,
            }}
            className="absolute bottom-20 pointer-events-none animate-float-fade flex flex-col items-center select-none"
          >
            <span className="text-3xl sm:text-4xl filter drop-shadow-md">{item.emoji}</span>
            {item.sender && item.sender !== "You" && (
              <span className="text-[9px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded-full backdrop-blur-xs mt-0.5 whitespace-nowrap shadow-xs">
                {item.sender}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Floating Quick Reaction Pill (Bottom Right, elevated above player scrubber) */}
      <div className="absolute bottom-12 right-3 sm:bottom-14 sm:right-4 pointer-events-auto flex items-center gap-1.5 transition-all">
        {isBarExpanded ? (
          <div className="flex items-center gap-1 bg-black/80 dark:bg-[#1a1917]/90 backdrop-blur-md px-2 py-1.5 rounded-full border border-white/20 dark:border-white/10 shadow-xl animate-in fade-in slide-in-from-right-3 duration-150">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleEmojiClick(emoji)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:scale-130 active:scale-95 transition-transform cursor-pointer text-base sm:text-lg select-none"
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIsBarExpanded(false)}
              className="w-6 h-6 rounded-full flex items-center justify-center text-white/60 hover:text-white text-xs ml-1 hover:bg-white/10 transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsBarExpanded(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs font-semibold backdrop-blur-md border border-white/20 shadow-lg cursor-pointer transition-all hover:scale-105 active:scale-95"
            title="React with emojis"
          >
            <span className="text-sm">🍿</span>
            <span className="hidden sm:inline text-[11px]">React</span>
          </button>
        )}
      </div>

      <style jsx>{`
        @keyframes floatFade {
          0% {
            opacity: 0;
            transform: translateY(0) scale(0.6);
          }
          15% {
            opacity: 1;
            transform: translateY(-20px) scale(1.1);
          }
          40% {
            opacity: 0.95;
            transform: translateY(-80px) translateX(8px) scale(1);
          }
          70% {
            opacity: 0.8;
            transform: translateY(-160px) translateX(-10px) scale(0.95);
          }
          100% {
            opacity: 0;
            transform: translateY(-240px) translateX(6px) scale(0.8);
          }
        }
        :global(.animate-float-fade) {
          animation: floatFade 2.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          will-change: transform, opacity;
        }
      `}</style>
    </div>
  );
}
