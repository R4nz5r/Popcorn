"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ActiveVideoSource } from "@/lib/player/types";

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSource: (source: ActiveVideoSource) => void;
  hasActiveVideo?: boolean;
}

// Utility to extract YouTube video ID from various link formats
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // If already an 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Handle standard youtu.be, youtube.com, shorts, live, or embed links
  const regExp =
    /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/|live\/)([^#&?]*).*/;
  const match = trimmed.match(regExp);

  return match && match[1].length === 11 ? match[1] : null;
}

export default function AddSourceModal({
  isOpen,
  onClose,
  onSelectSource,
  hasActiveVideo = false,
}: AddSourceModalProps) {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleClose = useCallback(() => {
    setYoutubeUrl("");
    setErrorMessage("");
    onClose();
  }, [onClose]);

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const handleSubmitYouTube = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    const videoId = extractYouTubeId(youtubeUrl);

    if (!videoId) {
      setErrorMessage("Please enter a valid YouTube link or video ID.");
      return;
    }

    // Local-only state change: sets active YouTube video
    onSelectSource({
      type: "youtube",
      videoId,
      title: "YouTube Video",
    });
    handleClose();
  };

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
    >
      {/* Modal card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-[#1c1b18] rounded-3xl p-8 border border-[#e8e4dc] dark:border-[#2b2925] shadow-xl flex flex-col gap-5 transition-colors"
      >
        <div>
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-red-600 shrink-0"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            <h2 className="text-xl font-bold text-[#1f1f1d] dark:text-[#f3efe8]">
              {hasActiveVideo ? "Change video" : "Add video to watch"}
            </h2>
          </div>
          <p className="text-sm text-[#6b6b66] dark:text-[#a8a49c] mt-1.5">
            Paste a YouTube link or video ID to play in sync with the room.
          </p>
        </div>

        <form onSubmit={handleSubmitYouTube} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="youtube-url-input"
              className="text-xs font-semibold text-[#1f1f1d] dark:text-[#f3efe8]"
            >
              YouTube URL or Video ID
            </label>
            <input
              id="youtube-url-input"
              type="text"
              autoFocus
              value={youtubeUrl}
              onChange={(e) => {
                setYoutubeUrl(e.target.value);
                setErrorMessage("");
              }}
              placeholder="e.g. https://www.youtube.com/watch?v=..."
              className="w-full px-4 py-3 text-base md:text-sm rounded-xl border border-[#d6d2c9] dark:border-[#33312b] bg-white dark:bg-[#242320] text-[#1f1f1d] dark:text-[#f3efe8] placeholder-[#8e8c85] dark:placeholder-[#737069] focus:border-[#1f1f1d] dark:focus:border-[#f59e0b] outline-none transition-colors"
            />
            {errorMessage && (
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                {errorMessage}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1">
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 bg-[#262624] hover:bg-black dark:bg-[#f5f2eb] dark:hover:bg-white dark:text-[#141312] text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer shadow-xs"
            >
              {hasActiveVideo ? "Change Video" : "Load Video"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="py-2.5 px-4 border border-[#d6d2c9] dark:border-[#33312b] bg-white dark:bg-[#242320] hover:bg-[#faf8f5] dark:hover:bg-[#2c2b27] text-[#1f1f1d] dark:text-[#f3efe8] rounded-xl text-sm font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
