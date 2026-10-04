"use client";

import React, { useEffect } from "react";

interface ScreenShareNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddVideo: () => void;
}

export default function ScreenShareNoticeModal({
  isOpen,
  onClose,
  onAddVideo,
}: ScreenShareNoticeModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#1c1b18] rounded-3xl p-6 sm:p-7 border border-[#e8e4dc] dark:border-[#2b2925] shadow-2xl flex flex-col gap-5 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Icon */}
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1f1f1d] dark:text-[#f3efe8]">
              Screen Sharing on Mobile
            </h2>
            <p className="text-xs text-[#6b6b66] dark:text-[#a8a49c] mt-0.5">
              Mobile browsers restrict screen capture
            </p>
          </div>
        </div>

        {/* Explanation & Alternatives */}
        <div className="space-y-3 text-xs sm:text-sm text-[#4a4944] dark:text-[#c4c0b6] leading-relaxed">
          <p>
            Mobile browsers (including iOS Safari and mobile webviews) do not allow web pages to capture your phone screen due to mobile OS security restrictions.
          </p>

          <div className="bg-[#f5f2eb] dark:bg-[#242320] border border-[#e8e4dc] dark:border-[#2b2925] rounded-2xl p-3.5 space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <span className="shrink-0 text-amber-600 dark:text-amber-400 font-bold">💻</span>
              <span>
                <strong className="text-[#1f1f1d] dark:text-[#f3efe8]">Use a PC or Laptop:</strong> Share screens, browser tabs, or apps from desktop Chrome, Edge, Brave, or Firefox.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="shrink-0 text-emerald-600 dark:text-emerald-400 font-bold">📱</span>
              <span>
                <strong className="text-[#1f1f1d] dark:text-[#f3efe8]">Viewers supported:</strong> You can watch screens shared by other friends on your phone without restrictions.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="shrink-0 text-blue-600 dark:text-blue-400 font-bold">🎬</span>
              <span>
                <strong className="text-[#1f1f1d] dark:text-[#f3efe8]">Add a YouTube video:</strong> Perfect real-time video sync across all phones and PCs.
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => {
              onClose();
              onAddVideo();
            }}
            className="w-full sm:flex-1 py-2.5 px-4 bg-[#1f1f1d] hover:bg-black dark:bg-[#f3efe8] dark:hover:bg-white text-white dark:text-[#141312] text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>+ Add Video Instead</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto py-2.5 px-4 bg-transparent hover:bg-[#f5f2eb] dark:hover:bg-[#242320] text-[#6b6b66] dark:text-[#a8a49c] hover:text-[#1f1f1d] dark:hover:text-[#f3efe8] text-xs sm:text-sm font-medium rounded-xl transition-colors cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
