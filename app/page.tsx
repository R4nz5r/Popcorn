"use client";

import { useState } from "react";
import { getOrCreateAnonymousUser, updateUserName } from "@/lib/identity";
import { sanitizeRoomCode } from "@/lib/code-generator";

export default function LandingPage() {
  const [userName, setUserName] = useState(() => {
    if (typeof window !== "undefined") {
      const user = getOrCreateAnonymousUser();
      return user.hasCustomName ? user.displayName : "";
    }
    return "";
  });
  const [roomCode, setRoomCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    setError(null);

    const trimmed = userName.trim();
    if (!trimmed) {
      setError("Please enter your name");
      return;
    }

    setIsCreating(true);

    try {
      const user = updateUserName(trimmed);
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: user.userId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create room");
      }

      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/room/${data.roomCode}`;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create room";
      setError(msg);
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setError(null);

    const trimmed = userName.trim();
    if (!trimmed) {
      setError("Please enter your name");
      return;
    }

    const sanitized = sanitizeRoomCode(roomCode);
    if (!sanitized) {
      setError("Please enter a room code");
      return;
    }

    setIsJoining(true);

    try {
      const res = await fetch(`/api/rooms/${sanitized}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Room not found");
      }

      updateUserName(trimmed);
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/room/${data.room.code}`;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Room not found";
      setError(msg);
      setIsJoining(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-[#f3efe8] p-4 sm:p-6">
      <div className="w-full max-w-[420px] bg-white rounded-[28px] p-8 sm:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-[#e8e4dc]">
        {/* Header */}
        <div className="flex items-center justify-center gap-2.5 mb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="Popcorn" className="w-8 h-8 select-none" />
          <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-[#1f1f1d]">
            Popcorn
          </h1>
        </div>
        <p className="text-sm sm:text-base text-[#686762] text-center font-normal">
          Sync any video with friends, live
        </p>

        {/* Your name input */}
        <div className="mt-6 text-left">
          <label className="block text-xs font-semibold text-[#8e8c85] uppercase tracking-wider mb-1.5">
            Your name
          </label>
          <input
            type="text"
            placeholder="Enter your name (e.g. Rafi)"
            value={userName}
            onChange={(e) => {
              setUserName(e.target.value);
              if (error) setError(null);
            }}
            maxLength={30}
            className="w-full px-4 py-3 bg-white border border-[#d6d2c9] focus:border-[#262624] focus:ring-1 focus:ring-[#262624] outline-none rounded-xl text-[#1f1f1d] placeholder:text-[#99968f] text-sm transition-colors"
          />
        </div>

        {/* Create room button */}
        <button
          type="button"
          onClick={handleCreateRoom}
          onPointerDown={(e) => {
            if (e.pointerType === "touch") {
              handleCreateRoom();
            }
          }}
          disabled={isCreating}
          className="w-full mt-4 py-3.5 px-4 bg-[#262624] hover:bg-[#1a1a18] active:scale-[0.99] text-white font-medium rounded-xl transition-all duration-150 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer text-base"
        >
          {isCreating ? (
            <>
              <svg
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <span>Creating room...</span>
            </>
          ) : (
            <span>+ Create a room</span>
          )}
        </button>

        {/* Divider */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="w-full border-t border-[#e5e2db]" />
          <span className="absolute bg-white px-3 text-sm text-[#8e8c85] font-normal">
            or
          </span>
        </div>

        {/* Join room container */}
        <div className="flex gap-2.5 items-center">
          <input
            type="text"
            enterKeyHint="go"
            placeholder="Enter room code"
            value={roomCode}
            onChange={(e) => {
              setRoomCode(e.target.value.toUpperCase());
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
                handleJoinRoom();
              }
            }}
            maxLength={10}
            autoCapitalize="characters"
            spellCheck={false}
            className="flex-1 min-w-0 px-4 py-3 bg-white border border-[#d6d2c9] focus:border-[#262624] focus:ring-1 focus:ring-[#262624] outline-none rounded-xl text-[#1f1f1d] placeholder:text-[#99968f] text-sm tracking-wider transition-colors"
          />
          <button
            type="button"
            onClick={() => handleJoinRoom()}
            onPointerDown={(e) => {
              if (e.pointerType === "touch") {
                handleJoinRoom();
              }
            }}
            disabled={isJoining}
            className="px-6 py-3 bg-white hover:bg-[#faf8f5] active:scale-[0.99] border border-[#d6d2c9] text-[#1f1f1d] font-medium rounded-xl text-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            {isJoining ? "Joining..." : "Join"}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-[#fdf2f2] border border-[#fbd5d5] text-[#9b1c1c] text-xs font-medium text-center transition-all">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
