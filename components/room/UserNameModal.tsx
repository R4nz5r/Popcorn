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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-[#e8e4dc] shadow-xl flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-bold text-[#1f1f1d]">
            {isInitialPrompt ? "Join Watch Party" : "Change Your Name"}
          </h2>
          <p className="text-sm text-[#6b6b66] mt-1">
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
            <label className="block text-xs font-semibold text-[#8e8c85] uppercase tracking-wider mb-1.5">
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
              className="w-full px-4 py-3 text-base md:text-sm rounded-xl border border-[#d6d2c9] text-[#1f1f1d] focus:border-[#262624] focus:ring-1 focus:ring-[#262624] outline-none transition-colors"
            />
            {error && (
              <p className="text-xs text-[#9b1c1c] font-medium mt-1.5">{error}</p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 py-3 px-4 bg-[#262624] hover:bg-black active:scale-[0.99] text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
            >
              {isInitialPrompt ? "Join Room" : "Save"}
            </button>
            {!isInitialPrompt && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="py-3 px-5 border border-[#d6d2c9] hover:bg-[#faf8f5] text-[#1f1f1d] rounded-xl text-sm font-medium transition-colors cursor-pointer"
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
