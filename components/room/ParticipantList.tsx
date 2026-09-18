"use client";

import React from "react";
import { PeerUser } from "@/lib/socket";

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
}: ParticipantListProps) {
  const userMap = new Map<string, Participant>();

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
  // If 3 or fewer participants, show all real avatars
  // If more than 3 participants, show the first 2 and a +N remaining counter
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

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      <div className="text-sm font-bold text-[#1f1f1d] dark:text-[#f3efe8] tracking-tight">
        {totalWatching} watching
      </div>

      {/* Avatar stack (vertical list matching design/2-watch-room.jpg) */}
      <div className="flex flex-col gap-2">
        {displayAvatars.map((avatar) => (
          <div
            key={avatar.id}
            title={avatar.name}
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-xs transition-transform hover:scale-105 select-none"
            style={{ backgroundColor: avatar.bgColor, color: avatar.textColor }}
          >
            {avatar.initials}
          </div>
        ))}
      </div>
    </div>
  );
}
