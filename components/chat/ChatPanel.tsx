"use client";

import React, { useState, useRef, useEffect } from "react";
import { soundFx } from "@/lib/sound";

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  emoji?: string;
  timestamp: Date;
}

export interface TypingUser {
  userId: string;
  displayName: string;
}

interface ChatPanelProps {
  currentUserName?: string;
  participantContent?: React.ReactNode;
  messages?: ChatMessage[];
  onSendMessage?: (text: string) => void;
  onSeekToTimestamp?: (seconds: number) => void;
  currentTime?: number;
  typingUsers?: TypingUser[];
  onTyping?: (isTyping: boolean) => void;
  onSendReaction?: (emoji: string) => void;
  areReactionsEnabled?: boolean;
  onToggleReactionsEnabled?: () => void;
  className?: string;
}

const EMOJI_OPTIONS = ["🍿", "❤️", "😂", "😮", "🔥", "👏"];

export function formatSecondsToTimestamp(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds < 0) return "0:00";
  const s = Math.floor(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

export function parseTimestampToSeconds(ts: string): number | null {
  const parts = ts.trim().split(":").map(Number);
  if (parts.some((p) => isNaN(p) || p < 0)) return null;
  if (parts.length === 2) {
    const [m, s] = parts;
    if (s >= 60) return null;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (m >= 60 || s >= 60) return null;
    return h * 3600 + m * 60 + s;
  }
  return null;
}

export function renderMessageContent(
  text: string,
  onSeek?: (seconds: number) => void
): React.ReactNode {
  const regex = /\b(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)\b/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = regex.lastIndex;
    const matchedString = match[0];
    const seconds = parseTimestampToSeconds(matchedString);

    if (seconds !== null) {
      if (matchStart > lastIndex) {
        parts.push(text.substring(lastIndex, matchStart));
      }
      parts.push(
        <button
          key={`ts-${matchStart}-${seconds}`}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSeek?.(seconds);
          }}
          className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded-md font-mono text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 transition-all cursor-pointer align-baseline select-none"
          title={`Jump to ${matchedString}`}
        >
          <svg className="w-2.5 h-2.5 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          <span>{matchedString}</span>
        </button>
      );
      lastIndex = matchEnd;
    }
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

export default function ChatPanel({
  currentUserName = "You",
  participantContent,
  messages: externalMessages,
  onSendMessage,
  onSeekToTimestamp,
  currentTime,
  typingUsers = [],
  onTyping,
  onSendReaction,
  areReactionsEnabled = true,
  onToggleReactionsEnabled,
  className = "",
}: ChatPanelProps) {
  const [internalMessages, setInternalMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isMobileExpanded, setIsMobileExpanded] = useState(true);
  const [isReactionMenuOpen, setIsReactionMenuOpen] = useState(false);

  const desktopFeedRef = useRef<HTMLDivElement>(null);
  const mobileFeedRef = useRef<HTMLDivElement>(null);
  const desktopInputRef = useRef<HTMLTextAreaElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const desktopReactionMenuRef = useRef<HTMLDivElement>(null);
  const mobileReactionMenuRef = useRef<HTMLDivElement>(null);
  const desktopReactionBtnRef = useRef<HTMLButtonElement>(null);
  const mobileReactionBtnRef = useRef<HTMLButtonElement>(null);

  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingActiveRef = useRef<boolean>(false);

  const activeMessages = externalMessages ?? internalMessages;

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (desktopFeedRef.current) {
      desktopFeedRef.current.scrollTo({
        top: desktopFeedRef.current.scrollHeight,
        behavior,
      });
    }
    if (mobileFeedRef.current) {
      mobileFeedRef.current.scrollTo({
        top: mobileFeedRef.current.scrollHeight,
        behavior,
      });
    }
  };

  useEffect(() => {
    scrollToBottom("smooth");
    const frame = requestAnimationFrame(() => scrollToBottom("smooth"));
    const timer = setTimeout(() => scrollToBottom("smooth"), 80);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [activeMessages, typingUsers]);

  // Click outside listener for reaction menu
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const isInsideDesktop = desktopReactionMenuRef.current?.contains(target);
      const isInsideMobile = mobileReactionMenuRef.current?.contains(target);
      const isDesktopBtn = desktopReactionBtnRef.current?.contains(target);
      const isMobileBtn = mobileReactionBtnRef.current?.contains(target);

      if (!isInsideDesktop && !isInsideMobile && !isDesktopBtn && !isMobileBtn) {
        setIsReactionMenuOpen(false);
      }
    }
    if (isReactionMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isReactionMenuOpen]);

  // Clean up typing state on unmount
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (isTypingActiveRef.current) onTyping?.(false);
    };
  }, [onTyping]);

  const handleInputChange = (val: string) => {
    setInputText(val);

    if (onTyping) {
      if (!isTypingActiveRef.current && val.trim().length > 0) {
        isTypingActiveRef.current = true;
        onTyping(true);
      }

      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }

      if (val.trim().length > 0) {
        typingTimerRef.current = setTimeout(() => {
          isTypingActiveRef.current = false;
          onTyping(false);
        }, 2200);
      } else {
        isTypingActiveRef.current = false;
        onTyping(false);
      }
    }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    if (isTypingActiveRef.current) {
      isTypingActiveRef.current = false;
      onTyping?.(false);
    }

    if (onSendMessage) {
      onSendMessage(trimmed);
    } else {
      const newMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        sender: currentUserName,
        text: trimmed,
        timestamp: new Date(),
      };
      setInternalMessages((prev) => [...prev, newMessage]);
    }
    setInputText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInsertTimestamp = () => {
    if (currentTime === undefined || currentTime < 0) return;
    const ts = formatSecondsToTimestamp(currentTime);
    const prefix = inputText.length > 0 && !inputText.endsWith(" ") ? " " : "";
    const updated = `${inputText}${prefix}${ts} `;
    handleInputChange(updated);

    if (desktopInputRef.current) {
      desktopInputRef.current.focus();
    } else if (mobileInputRef.current) {
      mobileInputRef.current.focus();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    onSendReaction?.(emoji);
    soundFx.playReactionPop();
  };

  const getTypingLabel = () => {
    if (!typingUsers || typingUsers.length === 0) return "";
    if (typingUsers.length === 1) {
      return `${typingUsers[0].displayName} is typing`;
    }
    if (typingUsers.length === 2) {
      return `${typingUsers[0].displayName} and ${typingUsers[1].displayName} are typing`;
    }
    return `${typingUsers[0].displayName}, ${typingUsers[1].displayName} and ${typingUsers.length - 2} others are typing`;
  };

  return (
    <>
      {/* DESKTOP VIEW (md: and up) */}
      <div
        className={`hidden md:flex flex-col w-full bg-white dark:bg-[#1c1b18] rounded-3xl border border-[#d6d2c9] dark:border-[#2b2925] p-6 shadow-xs transition-colors ${className}`}
      >
        {/* Participant list at the top */}
        {participantContent && <div className="mb-4">{participantContent}</div>}

        {/* Message Feed */}
        <div
          ref={desktopFeedRef}
          className="flex flex-col gap-2.5 mb-2 max-h-[220px] overflow-y-auto pr-2"
        >
          {activeMessages.map((msg) =>
            msg.sender === "System" ? (
              <div key={msg.id} className="text-xs text-[#8e8c85] dark:text-[#95928a] italic py-0.5">
                {msg.text}
              </div>
            ) : (
              <div key={msg.id} className="text-sm leading-relaxed text-[#1f1f1d] dark:text-[#f3efe8]">
                <span className="font-bold text-[#1f1f1d] dark:text-[#f3efe8] mr-2">{msg.sender}</span>
                <span className="text-[#2e2e2c] dark:text-[#d6d2c9]">
                  {renderMessageContent(msg.text, onSeekToTimestamp)}
                </span>
              </div>
            )
          )}
        </div>

        {/* Realtime Desktop Typing Indicator */}
        <div className="h-6 flex items-center mb-1">
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-[#8e8c85] dark:text-[#95928a] italic px-1 animate-in fade-in duration-200">
              <div className="flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" />
              </div>
              <span>{getTypingLabel()}...</span>
            </div>
          )}
        </div>

        {/* Input box */}
        <form onSubmit={handleSendMessage} className="w-full relative">
          {/* Reaction Popover */}
          {isReactionMenuOpen && (
            <div
              ref={desktopReactionMenuRef}
              onMouseDown={(e) => e.stopPropagation()}
              className="absolute left-3 bottom-14 z-30 flex flex-col gap-2 bg-white/95 dark:bg-[#1a1917]/95 backdrop-blur-md p-2 rounded-2xl border border-[#d6d2c9] dark:border-[#33312b] shadow-xl animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center gap-1">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleEmojiSelect(emoji)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 hover:scale-125 active:scale-95 transition-transform cursor-pointer text-lg select-none"
                    title={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Floating Reaction Video Visibility Toggle */}
              {onToggleReactionsEnabled && (
                <div className="pt-1.5 border-t border-[#e5e0d4] dark:border-[#2b2925] flex items-center justify-between px-1 text-[11px]">
                  <span className="text-[#8e8c85] dark:text-[#95928a]">Video reactions</span>
                  <button
                    type="button"
                    onClick={onToggleReactionsEnabled}
                    className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                      areReactionsEnabled
                        ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/30"
                        : "bg-black/10 dark:bg-white/10 text-[#8e8c85] dark:text-[#95928a]"
                    }`}
                  >
                    {areReactionsEnabled ? "Visible" : "Hidden"}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="relative rounded-2xl border border-[#d6d2c9] dark:border-[#33312b] bg-white dark:bg-[#242320] transition-all focus-within:border-[#1f1f1d] dark:focus-within:border-[#f59e0b] focus-within:ring-1 focus-within:ring-[#1f1f1d] dark:focus-within:ring-[#f59e0b]">
            <textarea
              ref={desktopInputRef}
              rows={3}
              value={inputText}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message (e.g. '01:23 amazing scene!')"
              className="w-full resize-none p-3.5 pb-10 text-base md:text-sm text-[#1f1f1d] dark:text-[#f3efe8] placeholder-[#8e8c85] dark:placeholder-[#737069] bg-transparent outline-none rounded-2xl"
            />

            {/* Desktop Action Buttons (Left) */}
            <div className="absolute left-3 bottom-2.5 flex items-center gap-1.5">
              {/* Quick Timestamp Button */}
              {currentTime !== undefined && currentTime >= 0 && (
                <button
                  type="button"
                  onClick={handleInsertTimestamp}
                  className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium text-[#8e8c85] hover:text-amber-600 dark:text-[#95928a] dark:hover:text-amber-400 bg-[#f4f1ea] hover:bg-amber-500/15 dark:bg-[#1a1917] dark:hover:bg-amber-500/20 px-2 py-1 rounded-lg border border-[#e5e0d4] dark:border-[#33312b] cursor-pointer transition-colors"
                  title="Insert current video timestamp into message"
                >
                  <svg className="w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="12" cy="12" r="9" strokeWidth="2" />
                    <path strokeWidth="2" strokeLinecap="round" d="M12 7v5l3 3" />
                  </svg>
                  <span>+ {formatSecondsToTimestamp(currentTime)}</span>
                </button>
              )}

              {/* Reaction Trigger Button */}
              <button
                ref={desktopReactionBtnRef}
                type="button"
                onClick={() => setIsReactionMenuOpen((prev) => !prev)}
                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all cursor-pointer select-none ${
                  isReactionMenuOpen
                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-400/50"
                    : "bg-[#f4f1ea] hover:bg-[#eae5da] dark:bg-[#1a1917] dark:hover:bg-[#282622] text-[#1f1f1d] dark:text-[#f3efe8] border-[#e5e0d4] dark:border-[#33312b]"
                }`}
                title="Send quick reaction"
              >
                <span>🍿</span>
                <span className="text-[11px] font-medium hidden sm:inline">React</span>
              </button>
            </div>

            {inputText.trim() && (
              <button
                type="submit"
                className="absolute right-3 bottom-2.5 px-3 py-1 bg-[#262624] hover:bg-black dark:bg-[#f5f2eb] dark:hover:bg-white dark:text-[#141312] text-white rounded-lg text-xs font-medium cursor-pointer transition-colors shadow-xs"
              >
                Send
              </button>
            )}
          </div>
        </form>
      </div>

      {/* MOBILE VIEW (< md) */}
      <div
        className={`flex md:hidden flex-col w-full bg-white dark:bg-[#1c1b18] rounded-3xl border border-[#d6d2c9] dark:border-[#2b2925] p-5 shadow-sm transition-all duration-300 ${
          isMobileExpanded ? "max-h-[380px]" : "max-h-[70px] overflow-hidden"
        } ${className}`}
      >
        {/* Drawer drag handle bar */}
        <button
          type="button"
          onClick={() => setIsMobileExpanded((prev) => !prev)}
          className="w-full flex justify-center pb-2 cursor-pointer focus:outline-none"
          aria-label="Toggle chat drawer"
        >
          <div className="w-12 h-1 bg-[#d6d2c9] dark:bg-[#33312b] rounded-full hover:bg-[#b5b0a6] dark:hover:bg-[#4d4a43] transition-colors" />
        </button>

        {isMobileExpanded && (
          <>
            {participantContent && <div className="mb-3">{participantContent}</div>}

            {/* Mobile Messages list */}
            <div
              ref={mobileFeedRef}
              className="flex-1 flex flex-col gap-2 overflow-y-auto mb-1 max-h-[160px] pr-1"
            >
              {activeMessages.map((msg) =>
                msg.sender === "System" ? (
                  <div key={msg.id} className="text-xs text-[#8e8c85] dark:text-[#95928a] italic py-0.5">
                    {msg.text}
                  </div>
                ) : (
                  <div key={msg.id} className="text-sm flex flex-wrap items-center gap-1.5 text-[#1f1f1d] dark:text-[#f3efe8]">
                    {msg.emoji && <span className="text-base">{msg.emoji}</span>}
                    <span className="font-bold text-[#1f1f1d] dark:text-[#f3efe8]">{msg.sender}</span>
                    <span className="text-[#2e2e2c] dark:text-[#d6d2c9]">
                      {renderMessageContent(msg.text, onSeekToTimestamp)}
                    </span>
                  </div>
                )
              )}
            </div>

            {/* Realtime Mobile Typing Indicator */}
            <div className="h-5 flex items-center mb-1">
              {typingUsers.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-[#8e8c85] dark:text-[#95928a] italic px-1 animate-in fade-in duration-150">
                  <div className="flex items-center gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce" />
                  </div>
                  <span>{getTypingLabel()}...</span>
                </div>
              )}
            </div>

            {/* Mobile Reaction Menu */}
            {isReactionMenuOpen && (
              <div
                ref={mobileReactionMenuRef}
                onMouseDown={(e) => e.stopPropagation()}
                className="mb-2 flex flex-col gap-2 bg-white/95 dark:bg-[#1a1917]/95 backdrop-blur-md p-2 rounded-2xl border border-[#d6d2c9] dark:border-[#33312b] shadow-lg animate-in fade-in duration-150"
              >
                <div className="flex items-center justify-around">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleEmojiSelect(emoji)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:scale-125 active:scale-95 transition-transform text-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                {onToggleReactionsEnabled && (
                  <div className="pt-1.5 border-t border-[#e5e0d4] dark:border-[#2b2925] flex items-center justify-between px-1 text-[11px]">
                    <span className="text-[#8e8c85] dark:text-[#95928a]">Video reactions</span>
                    <button
                      type="button"
                      onClick={onToggleReactionsEnabled}
                      className={`px-2 py-0.5 rounded font-medium ${
                        areReactionsEnabled
                          ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                          : "bg-black/10 dark:bg-white/10 text-[#8e8c85] dark:text-[#95928a]"
                      }`}
                    >
                      {areReactionsEnabled ? "Visible" : "Hidden"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Input box */}
            <form onSubmit={handleSendMessage} className="w-full">
              <div className="relative flex items-center rounded-xl border border-[#d6d2c9] dark:border-[#33312b] bg-white dark:bg-[#242320] focus-within:border-[#1f1f1d] dark:focus-within:border-[#f59e0b] pr-2">
                <input
                  ref={mobileInputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Message"
                  className="flex-1 px-3.5 py-2 text-base md:text-sm text-[#1f1f1d] dark:text-[#f3efe8] placeholder-[#8e8c85] dark:placeholder-[#737069] bg-transparent outline-none rounded-xl"
                />

                {/* Mobile Reaction Button */}
                <button
                  ref={mobileReactionBtnRef}
                  type="button"
                  onClick={() => setIsReactionMenuOpen((prev) => !prev)}
                  className="shrink-0 p-1.5 rounded text-base hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                  title="React with emoji"
                >
                  🍿
                </button>

                {/* Mobile quick timestamp button */}
                {currentTime !== undefined && currentTime >= 0 && (
                  <button
                    type="button"
                    onClick={handleInsertTimestamp}
                    className="shrink-0 p-1.5 rounded text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer transition-colors"
                    title="Insert current timestamp"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <circle cx="12" cy="12" r="9" strokeWidth="2" />
                      <path strokeWidth="2" strokeLinecap="round" d="M12 7v5l3 3" />
                    </svg>
                  </button>
                )}

                {inputText.trim() && (
                  <button
                    type="submit"
                    className="shrink-0 ml-1 px-2.5 py-1 bg-[#262624] dark:bg-[#f5f2eb] text-white dark:text-[#141312] text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Send
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </>
  );
}
