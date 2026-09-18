"use client";

import React, { useState } from "react";
import { ActiveVideoSource } from "@/lib/player/types";

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSource: (source: ActiveVideoSource) => void;
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
}: AddSourceModalProps) {
  const [isPastingYouTube, setIsPastingYouTube] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

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
    onClose();
  };

  const handleSelectSampleYouTube = (sampleId: string) => {
    onSelectSource({
      type: "youtube",
      videoId: sampleId,
      title: "Sample Video",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      {/* Modal card matching design/3-add-source-modal.jpg */}
      <div className="w-full max-w-md bg-white dark:bg-[#1c1b18] rounded-3xl p-8 border border-[#e8e4dc] dark:border-[#2b2925] shadow-xl flex flex-col gap-4 transition-colors">
        <div>
          <h2 className="text-xl font-bold text-[#1f1f1d] dark:text-[#f3efe8]">Add something to watch</h2>
          <p className="text-sm text-[#6b6b66] dark:text-[#a8a49c] mt-1">Choose a source for this room.</p>
        </div>

        {!isPastingYouTube ? (
          <div className="flex flex-col gap-3 my-1">
            {/* Paste a YouTube link option */}
            <button
              type="button"
              onClick={() => setIsPastingYouTube(true)}
              className="w-full text-left p-4 rounded-2xl border border-[#d6d2c9] dark:border-[#33312b] bg-white dark:bg-[#242320] hover:border-[#1f1f1d] dark:hover:border-[#f59e0b] hover:bg-[#faf8f5] dark:hover:bg-[#2c2b27] transition-all cursor-pointer group shadow-xs"
            >
              <div className="flex items-center gap-2 font-bold text-base text-[#1f1f1d] dark:text-[#f3efe8]">
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 4.5v15a1 1 0 0 0 1.524.852l12-7.5a1 1 0 0 0 0-1.704l-12-7.5A1 1 0 0 0 6 4.5z" />
                </svg>
                <span>Paste a YouTube link</span>
              </div>
              <p className="text-xs text-[#8e8c85] dark:text-[#95928a] mt-0.5">Starts playing instantly</p>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitYouTube} className="flex flex-col gap-3 my-1">
            <label className="text-xs font-semibold text-[#1f1f1d] dark:text-[#f3efe8]">YouTube URL or ID:</label>
            <input
              type="text"
              autoFocus
              value={youtubeUrl}
              onChange={(e) => {
                setYoutubeUrl(e.target.value);
                setErrorMessage("");
              }}
              placeholder="e.g. https://www.youtube.com/watch?v=..."
              className="w-full px-4 py-3 text-base md:text-sm rounded-xl border border-[#d6d2c9] dark:border-[#33312b] bg-white dark:bg-[#242320] text-[#1f1f1d] dark:text-[#f3efe8] placeholder-[#8e8c85] dark:placeholder-[#737069] focus:border-[#1f1f1d] dark:focus:border-[#f59e0b] outline-none"
            />
            {errorMessage && (
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">{errorMessage}</p>
            )}

            <div className="flex items-center gap-2 mt-1">
              <button
                type="submit"
                className="flex-1 py-2.5 px-4 bg-[#262624] hover:bg-black dark:bg-[#f5f2eb] dark:hover:bg-white dark:text-[#141312] text-white rounded-xl text-sm font-medium transition-colors cursor-pointer shadow-xs"
              >
                Load Video
              </button>
              <button
                type="button"
                onClick={() => setIsPastingYouTube(false)}
                className="py-2.5 px-4 border border-[#d6d2c9] dark:border-[#33312b] bg-white dark:bg-[#242320] hover:bg-[#faf8f5] dark:hover:bg-[#2c2b27] text-[#1f1f1d] dark:text-[#f3efe8] rounded-xl text-sm font-medium transition-colors cursor-pointer"
              >
                Back
              </button>
            </div>

            {/* Quick test presets */}
            <div className="pt-2 border-t border-[#f0ece4] dark:border-[#2b2925] text-xs text-[#8e8c85] dark:text-[#95928a]">
              <span>Quick demo: </span>
              <button
                type="button"
                onClick={() => handleSelectSampleYouTube("L_LUpnjgPso")}
                className="underline text-[#1f1f1d] dark:text-[#f3efe8] hover:text-black dark:hover:text-white cursor-pointer mr-2"
              >
                Trailer
              </button>
              <button
                type="button"
                onClick={() => handleSelectSampleYouTube("dQw4w9WgXcQ")}
                className="underline text-[#1f1f1d] dark:text-[#f3efe8] hover:text-black dark:hover:text-white cursor-pointer"
              >
                Rick Astley
              </button>
            </div>
          </form>
        )}

        {/* Cancel button matching design/3 */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl border border-[#d6d2c9] dark:border-[#33312b] bg-white dark:bg-[#242320] hover:bg-[#faf8f5] dark:hover:bg-[#2c2b27] text-sm font-medium text-[#1f1f1d] dark:text-[#f3efe8] transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>

  );
}
