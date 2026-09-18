"use client";

import React from "react";
import { useTheme } from "@/lib/theme";

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md";
}

export default function ThemeToggle({ className = "", size = "md" }: ThemeToggleProps) {
  const { isDark, toggleTheme, isMounted } = useTheme();

  // Skeleton placeholder to prevent layout shift before hydration
  if (!isMounted) {
    return (
      <div
        className={`${
          size === "sm" ? "w-7 h-7" : "w-8 h-8"
        } rounded-xl bg-transparent ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer select-none active:scale-95 border ${
        isDark
          ? "bg-[#1c1b18] hover:bg-[#252420] text-[#fbbf24] border-[#2b2925] shadow-xs"
          : "bg-white hover:bg-[#f5f2eb] text-[#1f1f1d] border-[#e8e4dc] shadow-xs"
      } ${size === "sm" ? "w-7 h-7 p-1" : "w-8 h-8 p-1.5"} ${className}`}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <svg
          className={`${size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} transition-transform duration-300 rotate-0 hover:rotate-45 text-[#fbbf24]`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg
          className={`${size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} transition-transform duration-300 -rotate-12 hover:rotate-0 text-[#686762] hover:text-[#1f1f1d]`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
}
