"use client";

import React, { useState } from "react";

interface UserNameModalProps {
  isOpen: boolean;
  initialName?: string;
  isInitialPrompt?: boolean;
  roomCode?: string;
  onSave: (name: string) => void;
  onClose?: () => void;
}

export default function UserNameModal({
  isOpen,
  initialName = "",
  isInitialPrompt = false,
  roomCode,
  onSave,
  onClose,
}: UserNameModalProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [prevProps, setPrevProps] = useState({ isOpen, initialName });

  if (isOpen !== prevProps.isOpen || initialName !== prevProps.initialName) {
    setPrevProps({ isOpen, initialName });
    if (isOpen) {
      setName(initialName);
      setError(null);
    }
  }

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter your name");
      return;
    }
    onSave(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-[#1c1b18] rounded-3xl p-8 border border-[#e8e4dc] dark:border-[#2b2925] shadow-xl flex flex-col gap-5 transition-colors">
        <div>
          <h2 className="text-xl font-bold text-[#1f1f1d] dark:text-[#f3efe8]">
            {isInitialPrompt ? "Join Watch Party" : "Change Your Name"}
          </h2>
          <p className="text-sm text-[#6b6b66] dark:text-[#a8a49c] mt-1">
            {isInitialPrompt
              ? roomCode
                ? `Enter your name to join room ${roomCode}`
                : "Enter your name to join this room"
              : "Update your display name visible to everyone in the room."}
          </p>
        </div>

        <form
          action="javascript:void(0)"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSubmit(e);
          }}
          className="flex flex-col gap-4"
        >
          <div>
            <label className="block text-xs font-semibold text-[#8e8c85] dark:text-[#95928a] uppercase tracking-wider mb-1.5">
              Your name
            </label>
            <input
              type="text"
              autoFocus
              placeholder="Enter your name (e.g. Rafi, Tasnim)"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              maxLength={30}
              className="w-full px-4 py-3 text-base md:text-sm rounded-xl border border-[#d6d2c9] dark:border-[#33312b] bg-white dark:bg-[#242320] text-[#1f1f1d] dark:text-[#f3efe8] placeholder-[#8e8c85] dark:placeholder-[#737069] focus:border-[#262624] dark:focus:border-[#f59e0b] focus:ring-1 focus:ring-[#262624] dark:focus:ring-[#f59e0b] outline-none transition-colors"
            />
            {error && (
              <p className="text-xs text-[#9b1c1c] dark:text-[#fca5a5] font-medium mt-1.5">{error}</p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 py-3 px-4 bg-[#262624] hover:bg-black dark:bg-[#f5f2eb] dark:hover:bg-white dark:text-[#141312] active:scale-[0.99] text-white rounded-xl text-sm font-medium transition-colors cursor-pointer shadow-xs"
            >
              {isInitialPrompt ? "Join Room" : "Save"}
            </button>
            {!isInitialPrompt && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="py-3 px-5 border border-[#d6d2c9] dark:border-[#33312b] bg-white dark:bg-[#242320] hover:bg-[#faf8f5] dark:hover:bg-[#2c2b27] text-[#1f1f1d] dark:text-[#f3efe8] rounded-xl text-sm font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

    </div>
  );
}
