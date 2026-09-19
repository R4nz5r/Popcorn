"use client";

import React, { useState, useEffect, useCallback } from "react";
import { soundFx } from "@/lib/sound";

export interface ReactionItem {
  id: string;
  emoji: string;
  sender?: string;
  leftPercent: number;
  scale: number;
}

interface FloatingReactionsProps {
  incomingReaction?: { id: string; emoji: string; sender?: string } | null;
  enabled?: boolean;
  className?: string;
}

export default function FloatingReactions({
  incomingReaction,
  enabled = true,
  className = "",
}: FloatingReactionsProps) {
  const [reactions, setReactions] = useState<ReactionItem[]>([]);

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

  // Listen to incoming reactions from socket
  useEffect(() => {
    if (!enabled) return;
    if (incomingReaction) {
      addReactionBubble(incomingReaction.emoji, incomingReaction.sender);
    }
  }, [incomingReaction, addReactionBubble, enabled]);

  // Clean up bubbles after animation completes
  const removeReaction = (id: string) => {
    setReactions((prev) => prev.filter((r) => r.id !== id));
  };

  if (!enabled || reactions.length === 0) {
    return null;
  }

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
