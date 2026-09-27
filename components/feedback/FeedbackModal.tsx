"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FeedbackCategory } from "@/lib/models/Feedback";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode?: string;
  videoId?: string;
}

const CATEGORIES: { id: FeedbackCategory; label: string; icon: string }[] = [
  { id: "bug", label: "Bug / Glitch", icon: "🐞" },
  { id: "sync", label: "Playback / Sync", icon: "⏱️" },
  { id: "audio", label: "Voice / Audio", icon: "🎙️" },
  { id: "feature", label: "Idea / Feature", icon: "💡" },
  { id: "other", label: "Other", icon: "💬" },
];

export default function FeedbackModal({
  isOpen,
  onClose,
  roomCode,
  videoId,
}: FeedbackModalProps) {
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const resetForm = useCallback(() => {
    setMessage("");
    setEmail("");
    setCategory("bug");
    setIsSubmitting(false);
    setIsSuccess(false);
    setErrorMessage("");
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  // Handle Escape key
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const trimmed = message.trim();
    if (!trimmed || trimmed.length < 3) {
      setErrorMessage("Please write a brief description of the issue or feedback.");
      return;
    }

    setIsSubmitting(true);

    try {
      const screenResolution =
        typeof window !== "undefined"
          ? `${window.innerWidth}x${window.innerHeight} (screen ${window.screen.width}x${window.screen.height})`
          : undefined;

      const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : undefined;

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message: trimmed,
          email: email.trim() || undefined,
          roomCode,
          videoId,
          screenResolution,
          userAgent,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit feedback.");
      }

      setIsSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 1800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-[#1c1b18] rounded-3xl p-6 sm:p-8 border border-[#e8e4dc] dark:border-[#2b2925] shadow-2xl flex flex-col gap-5 transition-colors"
      >
        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-8 text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-xs">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-[#1f1f1d] dark:text-[#f3efe8]">
              Thank you!
            </h3>
            <p className="text-sm text-[#6b6b66] dark:text-[#a8a49c] mt-1.5 max-w-xs">
              Your feedback has been sent directly to the developer on Discord. We appreciate your help!
            </p>
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl" role="img" aria-label="bug">
                    🐞
                  </span>
                  <h2 className="text-xl font-bold text-[#1f1f1d] dark:text-[#f3efe8]">
                    Report an issue / Feedback
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-[#8e8c85] hover:text-[#1f1f1d] dark:text-[#737069] dark:hover:text-[#f3efe8] transition-colors p-1 rounded-lg cursor-pointer"
                  aria-label="Close feedback modal"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-xs sm:text-sm text-[#6b6b66] dark:text-[#a8a49c] mt-1.5">
                Notice a bug, sync problem, or have an idea? Let us know so we can fix it.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Category selector */}
              <div>
                <label className="block text-xs font-semibold text-[#1f1f1d] dark:text-[#f3efe8] mb-2">
                  What kind of issue or feedback is this?
                </label>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                        category === cat.id
                          ? "border-[#1f1f1d] dark:border-[#f59e0b] bg-[#262624] text-white dark:bg-[#f59e0b] dark:text-[#141312] shadow-xs"
                          : "border-[#d6d2c9] dark:border-[#33312b] bg-white dark:bg-[#242320] text-[#6b6b66] dark:text-[#a8a49c] hover:border-[#8e8c85] dark:hover:border-[#524e46]"
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Message textarea */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="feedback-message-input"
                  className="text-xs font-semibold text-[#1f1f1d] dark:text-[#f3efe8]"
                >
                  Describe what happened
                </label>
                <textarea
                  id="feedback-message-input"
                  autoFocus
                  rows={3}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    setErrorMessage("");
                  }}
                  placeholder="e.g. The video paused on my screen but kept playing for my friend, or here is an idea..."
                  className="w-full px-4 py-3 text-sm rounded-xl border border-[#d6d2c9] dark:border-[#33312b] bg-white dark:bg-[#242320] text-[#1f1f1d] dark:text-[#f3efe8] placeholder-[#8e8c85] dark:placeholder-[#737069] focus:border-[#1f1f1d] dark:focus:border-[#f59e0b] outline-none transition-colors resize-none"
                  maxLength={2000}
                />
              </div>

              {/* Contact info (optional) */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="feedback-email-input"
                  className="text-xs font-semibold text-[#1f1f1d] dark:text-[#f3efe8]"
                >
                  Email or Discord username <span className="text-[#8e8c85] font-normal">(optional)</span>
                </label>
                <input
                  id="feedback-email-input"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. you@example.com or Discord username"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d6d2c9] dark:border-[#33312b] bg-white dark:bg-[#242320] text-[#1f1f1d] dark:text-[#f3efe8] placeholder-[#8e8c85] dark:placeholder-[#737069] focus:border-[#1f1f1d] dark:focus:border-[#f59e0b] outline-none transition-colors"
                  maxLength={200}
                />
              </div>

              {/* Auto-attached diagnostic banner */}
              {(roomCode || videoId) && (
                <div className="p-2.5 rounded-xl bg-[#f7f5f0] dark:bg-[#242320] border border-[#e5e2db] dark:border-[#33312b] text-[11px] text-[#6b6b66] dark:text-[#a8a49c] flex items-center justify-between">
                  <span>
                    Auto-attached info:{" "}
                    {roomCode && (
                      <strong className="text-[#1f1f1d] dark:text-[#f3efe8] font-mono">
                        Room {roomCode}
                      </strong>
                    )}
                    {roomCode && videoId && " • "}
                    {videoId && <span>Video attached</span>}
                  </span>
                  <span className="text-[10px] text-[#8e8c85] dark:text-[#737069]">
                    helps us debug faster
                  </span>
                </div>
              )}

              {errorMessage && (
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                  {errorMessage}
                </p>
              )}

              {/* Buttons */}
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 px-4 bg-[#262624] hover:bg-black dark:bg-[#f5f2eb] dark:hover:bg-white dark:text-[#141312] text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white dark:border-black/30 dark:border-t-black rounded-full animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <span>Send Report</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="py-2.5 px-4 border border-[#d6d2c9] dark:border-[#33312b] bg-white dark:bg-[#242320] hover:bg-[#faf8f5] dark:hover:bg-[#2c2b27] text-[#1f1f1d] dark:text-[#f3efe8] rounded-xl text-sm font-medium transition-colors cursor-pointer disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
