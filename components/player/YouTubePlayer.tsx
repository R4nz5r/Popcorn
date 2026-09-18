"use client";

import { useEffect, useRef, useState, useCallback, useId } from "react";
import { PlayerAdapter, PlayerCallbacks } from "@/lib/player/types";

// YouTube IFrame API global type declaration
declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        config: {
          videoId: string;
          width?: string | number;
          height?: string | number;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  cueVideoById: (videoId: string) => void;
  loadVideoById: (videoId: string) => void;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setPlaybackRate: (suggestedRate: number) => void;
  getPlaybackRate: () => number;
  destroy: () => void;
}

interface YouTubePlayerProps {
  videoId: string;
  callbacks?: PlayerCallbacks;
  onAdapterReady?: (adapter: PlayerAdapter) => void;
  isHost?: boolean;
  className?: string;
  onVideoClick?: () => void;
}

// Track whether script loading is initiated
let ytScriptLoadingPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.YT && window.YT.Player) {
    return Promise.resolve();
  }

  if (!ytScriptLoadingPromise) {
    ytScriptLoadingPromise = new Promise((resolve) => {
      const existingScript = document.getElementById("yt-iframe-api-script");
      if (existingScript && window.YT) {
        resolve();
        return;
      }

      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        resolve();
      };

      const tag = document.createElement("script");
      tag.id = "yt-iframe-api-script";
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      } else {
        document.head.appendChild(tag);
      }
    });
  }

  return ytScriptLoadingPromise;
}

export default function YouTubePlayer({
  videoId,
  callbacks,
  onAdapterReady,
  isHost = true,
  className = "",
  onVideoClick,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const isReadyRef = useRef<boolean>(false);
  const tickerRef = useRef<NodeJS.Timeout | null>(null);
  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const [isMutedByPolicy, setIsMutedByPolicy] = useState(!isHost);
  const reactId = useId();
  const playerId = `yt-player-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // Callbacks ref to avoid recreating player when callbacks change
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  // Adapter ready callback ref to prevent re-instantiating player on parent re-renders
  const onAdapterReadyRef = useRef(onAdapterReady);
  useEffect(() => {
    onAdapterReadyRef.current = onAdapterReady;
  }, [onAdapterReady]);

  const currentVideoIdRef = useRef<string | null>(null);

  // Stop polling ticker
  const stopTicker = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  // Start polling ticker during playback
  const startTicker = useCallback(() => {
    stopTicker();
    tickerRef.current = setInterval(() => {
      if (playerRef.current && isReadyRef.current) {
        try {
          const current = playerRef.current.getCurrentTime() || 0;
          const total = playerRef.current.getDuration() || 0;
          callbacksRef.current?.onTimeUpdate?.(current, total);
        } catch {
          // Player might be re-buffering
        }
      }
    }, 250);
  }, [stopTicker]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopTicker();
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // Ignore destroy errors
        }
        playerRef.current = null;
      }
    };
  }, [stopTicker]);

  // Auto-unmute when promoted to host
  useEffect(() => {
    if (isHost && isMutedByPolicy) {
      if (playerRef.current && isReadyRef.current) {
        try {
          playerRef.current.unMute();
          playerRef.current.setVolume(100);
        } catch {
          // ignore
        }
      }
      setTimeout(() => {
        setIsMutedByPolicy(false);
      }, 0);
    }
  }, [isHost, isMutedByPolicy]);

  // Load API script
  useEffect(() => {
    loadYouTubeIframeApi().then(() => {
      setIsApiLoaded(true);
    });
  }, []);

  // Initialize YT player once API is loaded
  useEffect(() => {
    if (!isApiLoaded || !videoId || typeof window === "undefined" || !window.YT) {
      return;
    }

    // If player already exists and is ready:
    if (playerRef.current && isReadyRef.current) {
      if (currentVideoIdRef.current === videoId) {
        // Same video already loaded, do not touch or re-instantiate player!
        return;
      }
      // Different video, load new video without tearing down iframe
      currentVideoIdRef.current = videoId;
      try {
        playerRef.current.loadVideoById(videoId);
        if (!isHost) {
          try {
            playerRef.current.mute();
          } catch {
            // Ignore
          }
        }
      } catch {
        try {
          playerRef.current.cueVideoById(videoId);
        } catch {
          // Fallback
        }
      }
      return;
    }

    isReadyRef.current = false;
    currentVideoIdRef.current = videoId;

    const player = new window.YT.Player(playerId, {
      width: "100%",
      height: "100%",
      videoId,
      playerVars: {
        autoplay: 1,
        mute: isHost ? 0 : 1,
        controls: 1,
        disablekb: 0,
        enablejsapi: 1,
        fs: 1,
        cc_load_policy: 1,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: (event) => {
          playerRef.current = event.target;
          isReadyRef.current = true;
          const dur = event.target.getDuration() || 0;
          callbacksRef.current?.onReady?.(dur);

          // Create and register adapter
          const adapter: PlayerAdapter = {
            play: () => {
              if (playerRef.current && isReadyRef.current) {
                try {
                  playerRef.current.playVideo();
                } catch {
                  try {
                    playerRef.current.mute();
                    playerRef.current.playVideo();
                  } catch {
                    // Ignore
                  }
                }
              }
            },
            pause: () => {
              if (playerRef.current && isReadyRef.current) {
                playerRef.current.pauseVideo();
              }
            },
            seekTo: (seconds: number, keepPlaying?: boolean) => {
              if (playerRef.current && isReadyRef.current) {
                playerRef.current.seekTo(seconds, true);
                if (keepPlaying) {
                  try {
                    playerRef.current.playVideo();
                  } catch {
                    // Ignore
                  }
                } else if (keepPlaying === false) {
                  try {
                    playerRef.current.pauseVideo();
                  } catch {
                    // Ignore
                  }
                }
                callbacksRef.current?.onTimeUpdate?.(
                  seconds,
                  playerRef.current.getDuration() || 0
                );
              }
            },
            getCurrentTime: () => {
              if (playerRef.current && isReadyRef.current) {
                return playerRef.current.getCurrentTime() || 0;
              }
              return 0;
            },
            getDuration: () => {
              if (playerRef.current && isReadyRef.current) {
                return playerRef.current.getDuration() || 0;
              }
              return 0;
            },
            isReady: () => isReadyRef.current,
            setVolume: (v: number) => {
              if (playerRef.current && isReadyRef.current) {
                playerRef.current.setVolume(v);
              }
            },
            getVolume: () => {
              if (playerRef.current && isReadyRef.current) {
                return playerRef.current.getVolume() || 100;
              }
              return 100;
            },
            mute: () => {
              if (playerRef.current && isReadyRef.current) {
                playerRef.current.mute();
              }
            },
            unMute: () => {
              if (playerRef.current && isReadyRef.current) {
                playerRef.current.unMute();
                setIsMutedByPolicy(false);
              }
            },
            isMuted: () => {
              if (playerRef.current && isReadyRef.current) {
                return playerRef.current.isMuted() || false;
              }
              return false;
            },
            setPlaybackRate: (rate: number) => {
              if (playerRef.current && isReadyRef.current) {
                playerRef.current.setPlaybackRate(rate);
              }
            },
            getPlaybackRate: () => {
              if (playerRef.current && isReadyRef.current) {
                return playerRef.current.getPlaybackRate() || 1;
              }
              return 1;
            },
          };

          onAdapterReadyRef.current?.(adapter);
        },
        onStateChange: (event) => {
          if (!window.YT) return;

          try {
            const curr = playerRef.current?.getCurrentTime() || 0;
            const dur = playerRef.current?.getDuration() || 0;
            callbacksRef.current?.onTimeUpdate?.(curr, dur);
          } catch {
            // Ignore time fetch errors
          }

          const state = event.data;
          if (state === window.YT.PlayerState.PLAYING) {
            callbacksRef.current?.onBuffering?.(false);
            callbacksRef.current?.onStateChange?.(true);
            startTicker();
          } else if (state === window.YT.PlayerState.PAUSED) {
            callbacksRef.current?.onBuffering?.(false);
            callbacksRef.current?.onStateChange?.(false);
            stopTicker();
          } else if (state === window.YT.PlayerState.BUFFERING) {
            callbacksRef.current?.onBuffering?.(true);
          } else if (state === window.YT.PlayerState.ENDED) {
            callbacksRef.current?.onBuffering?.(false);
            callbacksRef.current?.onStateChange?.(false);
            stopTicker();
          }
        },
        onError: (event) => {
          stopTicker();
          const code = event.data;
          let message = `YouTube player error (code ${code})`;
          if (code === 101 || code === 150) {
            message = "This video can't be played here — the owner has disabled embedding. Try a different link.";
          } else if (code === 100) {
            message = "This video could not be found or has been removed.";
          } else if (code === 2) {
            message = "Invalid YouTube video link or ID.";
          }
          callbacksRef.current?.onError?.(message, code);
        },
      },
    });

    playerRef.current = player;
  }, [isApiLoaded, videoId, playerId, isHost, startTicker, stopTicker]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full aspect-video overflow-hidden rounded-2xl bg-black [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:absolute [&>iframe]:inset-0 ${className}`}
    >
      <div id={playerId} className="w-full h-full" />
      {isMutedByPolicy && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
          <button
            type="button"
            onClick={() => {
              if (playerRef.current && isReadyRef.current) {
                try {
                  playerRef.current.unMute();
                  playerRef.current.setVolume(100);
                  setIsMutedByPolicy(false);
                } catch {
                  // ignore
                }
              }
            }}
            className="pointer-events-auto bg-black/80 backdrop-blur-sm text-white text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-2 shadow-lg border border-white/20 transition-transform hover:scale-105 active:scale-95 cursor-pointer animate-pulse"
          >
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M11 5L6 9H2v6h4l5 4V5z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 19L5 5" />
            </svg>
            <span>Click to unmute</span>
          </button>
        </div>
      )}
    </div>
  );
}
