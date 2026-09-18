"use client";

import React, { useState, useRef, useEffect } from "react";

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  emoji?: string;
  timestamp: Date;
}

interface ChatPanelProps {
  currentUserName?: string;
  participantContent?: React.ReactNode;
  messages?: ChatMessage[];
  onSendMessage?: (text: string) => void;
  className?: string;
}

export default function ChatPanel({
  currentUserName = "You",
  participantContent,
  messages: externalMessages,
  onSendMessage,
  className = "",
}: ChatPanelProps) {
  const [internalMessages, setInternalMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isMobileExpanded, setIsMobileExpanded] = useState(true);
  const desktopFeedRef = useRef<HTMLDivElement>(null);
  const mobileFeedRef = useRef<HTMLDivElement>(null);

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
  }, [activeMessages]);

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

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

  return (
    <>
      {/* DESKTOP VIEW (md: and up) - Matches design/2-watch-room.jpg exactly */}
      <div
        className={`hidden md:flex flex-col w-full bg-white dark:bg-[#1c1b18] rounded-3xl border border-[#d6d2c9] dark:border-[#2b2925] p-6 shadow-xs transition-colors ${className}`}
      >
        {/* Participant list at the top */}
        {participantContent && <div className="mb-4">{participantContent}</div>}

        {/* Message Feed */}
        <div
          ref={desktopFeedRef}
          className="flex flex-col gap-2.5 mb-5 max-h-[220px] overflow-y-auto pr-2"
        >
          {activeMessages.map((msg) =>
            msg.sender === "System" ? (
              <div key={msg.id} className="text-xs text-[#8e8c85] dark:text-[#95928a] italic py-0.5">
                {msg.text}
              </div>
            ) : (
              <div key={msg.id} className="text-sm leading-relaxed text-[#1f1f1d] dark:text-[#f3efe8]">
                <span className="font-bold text-[#1f1f1d] dark:text-[#f3efe8] mr-2">{msg.sender}</span>
                <span className="text-[#2e2e2c] dark:text-[#d6d2c9]">{msg.text}</span>
              </div>
            )
          )}
        </div>

        {/* Input box matching design/2-watch-room.jpg */}
        <form onSubmit={handleSendMessage} className="w-full">
          <div className="relative rounded-2xl border border-[#d6d2c9] dark:border-[#33312b] bg-white dark:bg-[#242320] transition-all focus-within:border-[#1f1f1d] dark:focus-within:border-[#f59e0b] focus-within:ring-1 focus-within:ring-[#1f1f1d] dark:focus-within:ring-[#f59e0b]">
            <textarea
              rows={3}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message"
              className="w-full resize-none p-3.5 text-base md:text-sm text-[#1f1f1d] dark:text-[#f3efe8] placeholder-[#8e8c85] dark:placeholder-[#737069] bg-transparent outline-none rounded-2xl"
            />
            {inputText.trim() && (
              <button
                type="submit"
                className="absolute right-3 bottom-3 px-3 py-1 bg-[#262624] hover:bg-black dark:bg-[#f5f2eb] dark:hover:bg-white dark:text-[#141312] text-white rounded-lg text-xs font-medium cursor-pointer transition-colors shadow-xs"
              >
                Send
              </button>
            )}
          </div>
        </form>
      </div>

      {/* MOBILE VIEW (< md) - Matches design/5-mobile-watch-room.jpg (Swipe-up Drawer) */}
      <div
        className={`flex md:hidden flex-col w-full bg-white dark:bg-[#1c1b18] rounded-3xl border border-[#d6d2c9] dark:border-[#2b2925] p-5 shadow-sm transition-all duration-300 ${
          isMobileExpanded ? "max-h-[360px]" : "max-h-[70px] overflow-hidden"
        } ${className}`}
      >
        {/* Drawer drag handle bar matching design/5-mobile-watch-room.jpg */}
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
            {/* Optional mini participant count */}
            {participantContent && <div className="mb-3">{participantContent}</div>}

            {/* Mobile Messages list */}
            <div
              ref={mobileFeedRef}
              className="flex-1 flex flex-col gap-2 overflow-y-auto mb-3 max-h-[160px] pr-1"
            >
              {activeMessages.map((msg) =>
                msg.sender === "System" ? (
                  <div key={msg.id} className="text-xs text-[#8e8c85] dark:text-[#95928a] italic py-0.5">
                    {msg.text}
                  </div>
                ) : (
                  <div key={msg.id} className="text-sm flex items-center gap-1.5 text-[#1f1f1d] dark:text-[#f3efe8]">
                    {msg.emoji && <span className="text-base">{msg.emoji}</span>}
                    <span className="font-bold text-[#1f1f1d] dark:text-[#f3efe8]">{msg.sender}</span>
                    <span className="text-[#2e2e2c] dark:text-[#d6d2c9]">{msg.text}</span>
                  </div>
                )
              )}
            </div>

            {/* Mobile Input box matching design/5 */}
            <form onSubmit={handleSendMessage} className="w-full">
              <div className="relative rounded-xl border border-[#d6d2c9] dark:border-[#33312b] bg-white dark:bg-[#242320] focus-within:border-[#1f1f1d] dark:focus-within:border-[#f59e0b]">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Message"
                  className="w-full px-3.5 py-2 text-base md:text-sm text-[#1f1f1d] dark:text-[#f3efe8] placeholder-[#8e8c85] dark:placeholder-[#737069] bg-transparent outline-none rounded-xl"
                />
              </div>
            </form>
          </>
        )}
      </div>

    </>
  );
}
