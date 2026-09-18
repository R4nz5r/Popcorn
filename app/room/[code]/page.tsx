"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getOrCreateAnonymousUser, updateUserName, AnonymousUser } from "@/lib/identity";
import { PlayerAdapter, ActiveVideoSource } from "@/lib/player/types";
import {
  getSocket,
  SyncStatePayload,
  CorrectionPayload,
  ChatMessagePayload,
  ChatHistoryPayload,
  RoomParticipantsPayload,
  PeerUser,
  HostStatusPayload,
  ScreenSharer,
  ScreenShareStartedPayload,
  WebRTCSignalPayload,
} from "@/lib/socket";
import YouTubePlayer from "@/components/player/YouTubePlayer";
import PlaybackControls from "@/components/player/PlaybackControls";
import ScreenSharePlayer from "@/components/player/ScreenSharePlayer";
import { WebRTCManager } from "@/lib/webrtc/WebRTCManager";
import ChatPanel, { ChatMessage } from "@/components/chat/ChatPanel";
import ParticipantList, { getInitials } from "@/components/room/ParticipantList";
import AddSourceModal from "@/components/room/AddSourceModal";
import UserNameModal from "@/components/room/UserNameModal";
import { sanitizeRoomCode } from "@/lib/code-generator";

interface RoomData {
  code: string;
  hostId: string;
  status: string;
  participants?: string[];
  participantIds?: string[];
  activeVideo?: ActiveVideoSource;
  createdAt: string;
}

export default function RoomPage() {
  const routeParams = useParams<{ code: string }>();
  const code = sanitizeRoomCode((routeParams?.code as string) || "");
  const [room, setRoom] = useState<RoomData | null>(null);
  const [currentUser, setCurrentUser] = useState<AnonymousUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Video and Playback State
  const [activeVideo, setActiveVideo] = useState<ActiveVideoSource | null>(null);
  const [videoError, setVideoError] = useState<{ message: string; code?: number } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(872); // Matches design/2-watch-room.jpg when idle
  const [duration, setDuration] = useState(6480); // Matches design/2-watch-room.jpg when idle
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [isInitialNamePrompt, setIsInitialNamePrompt] = useState(false);

  // Realtime Connection & Sync State
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "disconnected" | "host-left">("syncing");
  const [isHostOnline, setIsHostOnline] = useState<boolean>(true);
  const [liveHostId, setLiveHostId] = useState<string | null>(null);
  const [liveParticipants, setLiveParticipants] = useState<PeerUser[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [bufferingPeerInfo, setBufferingPeerInfo] = useState<{
    isBuffering: boolean;
    bufferingUserId?: string;
    bufferingUserName?: string;
  } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCssFullscreen, setIsCssFullscreen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Screen Sharing State
  const [screenSharer, setScreenSharer] = useState<ScreenSharer | null>(null);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  const [isStartingScreenShare, setIsStartingScreenShare] = useState(false);
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);

  // Player adapter and sync lifecycle references
  const playerAdapterRef = useRef<PlayerAdapter | null>(null);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
  const desiredPlayStateRef = useRef<boolean>(false);
  const pendingSyncRef = useRef<{ isPlaying: boolean; targetTime: number } | null>(null);
  const rateResetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isProgrammaticActionRef = useRef<boolean>(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const isManualSyncRequestRef = useRef<boolean>(false);
  const lastReportedTimeRef = useRef<number | null>(null);
  const isLocallyPausedRef = useRef<boolean>(false);
  const liveHostIdRef = useRef<string | null>(null);
  useEffect(() => {
    liveHostIdRef.current = liveHostId;
  }, [liveHostId]);

  const roomHostIdRef = useRef<string | undefined>(room?.hostId);
  useEffect(() => {
    roomHostIdRef.current = room?.hostId;
  }, [room?.hostId]);

  const hasLeftRef = useRef<boolean>(false);

  // Listen to fullscreen changes across browsers and Escape key
  useEffect(() => {
    function onFullscreenChange() {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      const isNativeFs = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
      if (!isNativeFs && !isCssFullscreen) {
        setIsFullscreen(false);
      } else {
        setIsFullscreen(true);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isCssFullscreen) {
        setIsCssFullscreen(false);
        setIsFullscreen(false);
      }
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isCssFullscreen]);

  // Close mobile menu on click outside or Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target as Node)
      ) {
        setIsMobileMenuOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    }

    if (isMobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  // 1. Initial Room & Anonymous Identity Fetch
  useEffect(() => {
    if (!code) return;

    async function fetchRoom() {
      const user = getOrCreateAnonymousUser();
      setCurrentUser(user);
      if (!user.hasCustomName) {
        setIsInitialNamePrompt(true);
        setIsNameModalOpen(true);
      }

      try {
        const res = await fetch(`/api/rooms/${code}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Room not found");
        }

        setRoom(data.room);
        if (data.room?.hostId) {
          setLiveHostId(data.room.hostId);
        }

        if (data.room?.activeVideo) {
          setActiveVideo(data.room.activeVideo);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Room not found";
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRoom();
  }, [code]);

  // 2. Realtime Socket Lifecycle & Event Listeners
  useEffect(() => {
    if (!currentUser || !code) return;

    const socket = getSocket();
    socketRef.current = socket;
    hasLeftRef.current = false;

    // Initialize WebRTC Manager with signaling callbacks
    const webrtc = new WebRTCManager(socket, code, {
      onLocalStream: (stream) => {
        setScreenShareStream(stream);
      },
      onRemoteStream: (stream) => {
        setScreenShareStream(stream);
      },
      onStreamEnded: () => {
        setScreenShareStream(null);
        setScreenSharer(null);
      },
      onError: (err) => {
        console.error("[WebRTC] Error:", err);
      },
    });
    webrtcManagerRef.current = webrtc;

    function handleConnect() {
      setSyncStatus("synced");
      const currentMediaTime = playerAdapterRef.current?.getCurrentTime() ?? currentTime;
      socket.emit("join_room", {
        roomId: code,
        userId: currentUser!.userId,
        roomHostId: roomHostIdRef.current || room?.hostId,
        user: {
          displayName: currentUser!.displayName,
          avatarColor: currentUser!.avatarColor,
        },
        activeVideo: activeVideo || room?.activeVideo,
        mediaTime: currentMediaTime,
      });
    }

    function handleDisconnect() {
      setSyncStatus("disconnected");
    }

    function handleConnectError() {
      setSyncStatus("disconnected");
    }

    function handleSyncState(state: SyncStatePayload) {
      if (state.hostId) {
        setLiveHostId(state.hostId);
      }

      if (typeof state.isHostOnline === "boolean") {
        setIsHostOnline(state.isHostOnline);
        if (!state.isHostOnline) {
          setSyncStatus("host-left");
        }
      }

      // Synchronize video ID if server has an active video
      if (state.videoId) {
        setScreenSharer(null);
        setActiveVideo((prev) => {
          if (prev?.videoId === state.videoId) return prev;
          isLocallyPausedRef.current = false;
          return {
            type: "youtube",
            videoId: state.videoId,
          };
        });
      }

      // Compute target media position adjusting for elapsed server transmission time
      const elapsedSeconds = state.isPlaying
        ? Math.max(0, (Date.now() - state.serverTime) / 1000)
        : 0;
      const targetTime = state.mediaTime + elapsedSeconds;

      const isManual = isManualSyncRequestRef.current;
      isManualSyncRequestRef.current = false;

      // If host explicitly pauses the room, align all viewers and reset local pause flag
      if (!state.isPlaying) {
        isLocallyPausedRef.current = false;
      }

      // If guest is locally paused and host is still playing, do not forcibly unpause the guest
      const isViewer = currentUser && currentUser.userId !== (state.hostId || liveHostIdRef.current || room?.hostId);
      if (isViewer && isLocallyPausedRef.current && state.isPlaying && !isManual) {
        setSyncStatus("syncing");
        return;
      }

      desiredPlayStateRef.current = state.isPlaying;
      setIsPlaying(state.isPlaying);

      const adapter = playerAdapterRef.current;
      if (!adapter || !adapter.isReady()) {
        // Player not mounted or ready yet, queue it so handleAdapterReady executes it immediately
        pendingSyncRef.current = {
          isPlaying: state.isPlaying,
          targetTime,
        };
        setCurrentTime(targetTime);
        return;
      }

      // If room is PAUSED by host: guarantee immediate pause and position sync
      if (!state.isPlaying) {
        if (rateResetTimerRef.current) {
          clearTimeout(rateResetTimerRef.current);
          rateResetTimerRef.current = null;
        }
        adapter.setPlaybackRate?.(1.0);

        // Pause first to halt playback immediately
        isProgrammaticActionRef.current = true;
        adapter.pause();

        const currentPos = adapter.getCurrentTime();
        const drift = Math.abs(targetTime - currentPos);
        if (drift > 0.5 || isManual) {
          adapter.seekTo(targetTime, false);
          setCurrentTime(targetTime);
          // Reinforce pause after seekTo to prevent YouTube auto-resuming from seek buffer
          isProgrammaticActionRef.current = true;
          adapter.pause();
        }
        setSyncStatus("synced");
        return;
      }

      // If room is PLAYING: apply graduated correction or seek
      const currentPos = adapter.getCurrentTime();
      const delta = targetTime - currentPos;
      const drift = Math.abs(delta);

      if (drift > 2.0 || isManual) {
        setSyncStatus("syncing");
        isProgrammaticActionRef.current = true;
        adapter.seekTo(targetTime, true);
        setCurrentTime(targetTime);
        setTimeout(() => setSyncStatus("synced"), 300);
      } else if (drift >= 0.3) {
        setSyncStatus("syncing");
        const rate = delta > 0 ? 1.1 : 0.9;
        adapter.setPlaybackRate?.(rate);
        if (rateResetTimerRef.current) clearTimeout(rateResetTimerRef.current);
        rateResetTimerRef.current = setTimeout(() => {
          playerAdapterRef.current?.setPlaybackRate?.(1.0);
          setSyncStatus("synced");
          rateResetTimerRef.current = null;
        }, 2500);
      } else {
        setSyncStatus("synced");
      }

      // Trigger play
      isProgrammaticActionRef.current = true;
      adapter.play();
    }

    function handleCorrection(payload: CorrectionPayload) {
      if (isLocallyPausedRef.current) return;
      if (!desiredPlayStateRef.current) return; // Do not apply drift corrections if room is paused

      const elapsedSeconds = payload.serverTime
        ? Math.max(0, (Date.now() - payload.serverTime) / 1000)
        : 0;
      const targetTime = payload.mediaTime + elapsedSeconds;

      const adapter = playerAdapterRef.current;
      if (!adapter || !adapter.isReady()) return;

      const currentPos = adapter.getCurrentTime();
      const delta = targetTime - currentPos;
      const drift = Math.abs(delta);

      if (drift < 0.3) {
        setSyncStatus("synced");
        return;
      }

      if (drift <= 2.0) {
        setSyncStatus("syncing");
        const rate = delta > 0 ? 1.1 : 0.9;
        adapter.setPlaybackRate?.(rate);
        if (rateResetTimerRef.current) clearTimeout(rateResetTimerRef.current);
        rateResetTimerRef.current = setTimeout(() => {
          playerAdapterRef.current?.setPlaybackRate?.(1.0);
          setSyncStatus("synced");
          rateResetTimerRef.current = null;
        }, 2500);
        return;
      }

      // Above 2.0s: hard seek and keep playing if desired
      setSyncStatus("syncing");
      isProgrammaticActionRef.current = true;
      adapter.seekTo(targetTime, desiredPlayStateRef.current);
      setCurrentTime(targetTime);
      if (desiredPlayStateRef.current) {
        adapter.play();
      } else {
        adapter.pause();
      }
      setTimeout(() => setSyncStatus("synced"), 300);
    }

    function handleChatMessage(incomingMsg: ChatMessagePayload) {
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === incomingMsg.id)) return prev;
        return [
          ...prev,
          {
            ...incomingMsg,
            timestamp: new Date(incomingMsg.timestamp),
          },
        ];
      });
    }

    function handleChatHistory(payload: ChatHistoryPayload) {
      if (Array.isArray(payload?.messages)) {
        setChatMessages(
          payload.messages.map((m) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          }))
        );
      }
    }

    function handleRoomParticipants(payload: RoomParticipantsPayload) {
      setLiveParticipants(payload.participants);
      if (payload.hostId) {
        setLiveHostId(payload.hostId);
      }
      // If we are currently sharing screen, connect to any newly joined peer
      if (webrtcManagerRef.current?.isSharing()) {
        for (const p of payload.participants) {
          if (p.socketId) {
            webrtcManagerRef.current.addPeer(p.socketId);
          }
        }
      }
    }

    interface BufferingStatePayload {
      isBuffering: boolean;
      bufferingUserId?: string;
      bufferingUserName?: string;
    }

    function handleBufferingState(payload: BufferingStatePayload) {
      if (payload.isBuffering) {
        setBufferingPeerInfo(payload);
      } else {
        setBufferingPeerInfo(null);
      }
    }

    function handleHostStatus(payload: HostStatusPayload) {
      setIsHostOnline(payload.isHostOnline);
      if (payload.hostId) {
        setLiveHostId(payload.hostId);
      }
      if (!payload.isHostOnline) {
        setSyncStatus("host-left");
      } else {
        setSyncStatus("synced");
      }

      // If current user was promoted to host, persist new host in MongoDB
      if (payload.hostId && currentUser && payload.hostId === currentUser.userId) {
        fetch(`/api/rooms/${code}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newHostId: currentUser.userId,
            userId: currentUser.userId,
          }),
        }).catch((err) => console.error("Failed to persist promoted host:", err));
      }
    }

    function handleScreenShareStarted(payload: ScreenShareStartedPayload) {
      setScreenSharer(payload.sharer);
      // If video was playing locally, pause it
      if (playerAdapterRef.current?.isReady()) {
        isProgrammaticActionRef.current = true;
        playerAdapterRef.current.pause();
        setIsPlaying(false);
        desiredPlayStateRef.current = false;
      }
    }

    function handleScreenShareStopped() {
      setScreenSharer(null);
      setScreenShareStream(null);
      webrtcManagerRef.current?.cleanupViewer();
    }

    function handleWebRTCSignal(payload: WebRTCSignalPayload) {
      webrtcManagerRef.current?.handleSignal(payload.fromSocketId, payload.signal);
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("sync_state", handleSyncState);
    socket.on("correction", handleCorrection);
    socket.on("chat_message", handleChatMessage);
    socket.on("chat_history", handleChatHistory);
    socket.on("room_participants", handleRoomParticipants);
    socket.on("buffering_state", handleBufferingState);
    socket.on("host_status", handleHostStatus);
    socket.on("screen_share_started", handleScreenShareStarted);
    socket.on("screen_share_stopped", handleScreenShareStopped);
    socket.on("webrtc_signal", handleWebRTCSignal);

    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    function handleVisibilityOrFocus() {
      if (socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    }

    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("visibilitychange", handleVisibilityOrFocus);

    function handleLeaveRoom() {
      if (hasLeftRef.current) return;
      hasLeftRef.current = true;
      if (socketRef.current?.connected && currentUser) {
        socketRef.current.emit("leave_room", {
          roomId: code,
          userId: currentUser.userId,
        });
      }
    }

    window.addEventListener("pagehide", handleLeaveRoom);
    window.addEventListener("beforeunload", handleLeaveRoom);

    return () => {
      handleLeaveRoom();
      window.removeEventListener("pagehide", handleLeaveRoom);
      window.removeEventListener("beforeunload", handleLeaveRoom);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("sync_state", handleSyncState);
      socket.off("correction", handleCorrection);
      socket.off("chat_message", handleChatMessage);
      socket.off("chat_history", handleChatHistory);
      socket.off("room_participants", handleRoomParticipants);
      socket.off("buffering_state", handleBufferingState);
      socket.off("host_status", handleHostStatus);
      socket.off("screen_share_started", handleScreenShareStarted);
      socket.off("screen_share_stopped", handleScreenShareStopped);
      socket.off("webrtc_signal", handleWebRTCSignal);
      webrtc.destroy();
      webrtcManagerRef.current = null;
      if (rateResetTimerRef.current) {
        clearTimeout(rateResetTimerRef.current);
      }
    };
  }, [currentUser?.userId, code]);

  // 3. User Gesture Unlock: Ensure audio/video play and unmute on first interaction
  useEffect(() => {
    function onUserInteraction() {
      if (playerAdapterRef.current?.isReady()) {
        isProgrammaticActionRef.current = true;
        playerAdapterRef.current.unMute?.();
        playerAdapterRef.current.setVolume?.(volume || 100);
        if (desiredPlayStateRef.current) {
          playerAdapterRef.current.play();
        }
      }
    }
    window.addEventListener("pointerdown", onUserInteraction, { once: true });
    window.addEventListener("keydown", onUserInteraction, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onUserInteraction);
      window.removeEventListener("keydown", onUserInteraction);
    };
  }, [volume]);

  // 4. Periodic Heartbeat: Host and peers report position every ~2s when playing, host reports every ~4s when paused
  const effectiveHostId = liveHostId || room?.hostId;
  const isHost = Boolean(currentUser && currentUser.userId === effectiveHostId);

  useEffect(() => {
    if (!code) return;
    if (!isPlaying && !isHost) return;

    const intervalTime = isPlaying ? 2000 : 4000;
    const interval = setInterval(() => {
      if (socketRef.current?.connected && playerAdapterRef.current?.isReady()) {
        const mediaTime = playerAdapterRef.current.getCurrentTime();

        socketRef.current.emit("heartbeat", {
          roomId: code,
          mediaTime,
          timestamp: Date.now(),
        });
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, [isPlaying, code, isHost]);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Fullscreen Toggle Action (Cross-platform for PC and Mobile)
  const handleToggleFullscreen = () => {
    if (!videoContainerRef.current) return;
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const container = videoContainerRef.current as HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    const isNativeFs = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
    const isCurrentlyFs = isNativeFs || isCssFullscreen;

    if (!isCurrentlyFs) {
      // Attempt native HTML5 fullscreen first (standard on PC and Android)
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(() => {
          // Fallback to CSS Viewport Fullscreen (iOS Safari or permission blocked)
          setIsCssFullscreen(true);
          setIsFullscreen(true);
        });
      } else if (container.webkitRequestFullscreen) {
        try {
          container.webkitRequestFullscreen();
        } catch {
          setIsCssFullscreen(true);
          setIsFullscreen(true);
        }
      } else {
        // Direct CSS Viewport Fullscreen fallback (e.g. iOS Safari / iPhone)
        setIsCssFullscreen(true);
        setIsFullscreen(true);
      }
    } else {
      if (isCssFullscreen) {
        setIsCssFullscreen(false);
      }
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  // Play / Pause Action: Host controls room sync; Guests control local playback
  const handlePlayPause = () => {
    if (!playerAdapterRef.current?.isReady()) return;

    if (isHost) {
      const targetTime = playerAdapterRef.current.getCurrentTime();
      isProgrammaticActionRef.current = true;
      if (isPlaying) {
        desiredPlayStateRef.current = false;
        setIsPlaying(false);
        playerAdapterRef.current.pause();

        if (socketRef.current?.connected) {
          socketRef.current.emit("pause", {
            roomId: code,
            mediaTime: targetTime,
            timestamp: Date.now(),
          });
        }
      } else {
        desiredPlayStateRef.current = true;
        setIsPlaying(true);
        playerAdapterRef.current.play();

        if (socketRef.current?.connected) {
          socketRef.current.emit("play", {
            roomId: code,
            mediaTime: targetTime,
            timestamp: Date.now(),
          });
        }
      }
    } else {
      // Guest toggles local playback only (does not interrupt Host)
      if (isPlaying) {
        setIsPlaying(false);
        isLocallyPausedRef.current = true;
        setSyncStatus("syncing");
        playerAdapterRef.current.pause();
      } else {
        setIsPlaying(true);
        isLocallyPausedRef.current = false;
        playerAdapterRef.current.play();
      }
    }
  };

  // Seek Action wired to Socket (Host Only unless Host has left)
  const handleSeek = (time: number) => {
    if (!isHost && isHostOnline) return;

    isProgrammaticActionRef.current = true;
    setCurrentTime(time);
    playerAdapterRef.current?.seekTo(time, isPlaying);
    if (isHost && socketRef.current?.connected) {
      socketRef.current.emit("seek", {
        roomId: code,
        mediaTime: time,
        timestamp: Date.now(),
      });
    }
  };

  const handleAdapterReady = useCallback((adapter: PlayerAdapter) => {
    playerAdapterRef.current = adapter;

    const pending = pendingSyncRef.current;
    if (pending) {
      isProgrammaticActionRef.current = true;
      if (pending.targetTime > 0) {
        adapter.seekTo(pending.targetTime, pending.isPlaying);
      }
      if (pending.isPlaying) {
        adapter.play();
      }
      pendingSyncRef.current = null;
    } else if (desiredPlayStateRef.current) {
      isProgrammaticActionRef.current = true;
      adapter.play();
    }
  }, []);

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
      playerAdapterRef.current?.unMute?.();
    }
    playerAdapterRef.current?.setVolume?.(newVol);
  };

  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      playerAdapterRef.current?.unMute?.();
      playerAdapterRef.current?.setVolume?.(volume || 50);
    } else {
      setIsMuted(true);
      playerAdapterRef.current?.mute?.();
    }
  };

  const handleSelectSource = async (source: ActiveVideoSource) => {
    setVideoError(null);
    setActiveVideo(source);
    setIsPlaying(false);
    desiredPlayStateRef.current = false;
    setCurrentTime(0);

    // Auto-stop screen sharing if active so YouTube player takes over
    if (screenSharer) {
      setScreenSharer(null);
      if (screenSharer.userId === currentUser?.userId) {
        if (screenShareStream) {
          screenShareStream.getTracks().forEach((t) => t.stop());
          setScreenShareStream(null);
        }
        if (socketRef.current?.connected) {
          socketRef.current.emit("screen_share_stop", { roomId: code });
        }
      }
    }

    // 1. Emit to realtime server immediately
    if (socketRef.current?.connected && source.videoId) {
      socketRef.current.emit("set_video", {
        roomId: code,
        video: source,
      });
    }

    // 2. Persist active video to MongoDB for late joiners and page refreshes
    try {
      await fetch(`/api/rooms/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video: source,
          userId: currentUser?.userId,
        }),
      });
    } catch (err) {
      console.error("Failed to persist active video:", err);
    }
  };

  const handleSyncToHost = () => {
    setSyncStatus("syncing");
    isLocallyPausedRef.current = false;
    isManualSyncRequestRef.current = true;
    if (socketRef.current?.connected) {
      socketRef.current.emit("request_sync", { roomId: code });
    }
  };

  // Chat message sending routed through Socket
  const handleSendChatMessage = (text: string) => {
    if (!currentUser) return;
    const msg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: currentUser.displayName,
      text,
      timestamp: new Date(),
    };

    if (socketRef.current?.connected) {
      socketRef.current.emit("chat_message", {
        roomId: code,
        message: msg,
      });
    } else {
      setChatMessages((prev) => [...prev, msg]);
    }
  };

  const handleToggleScreenShare = async () => {
    if (!currentUser || !socketRef.current?.connected) return;

    // If local user is currently sharing: stop
    if (screenSharer?.userId === currentUser.userId) {
      webrtcManagerRef.current?.stopScreenShare();
      setScreenSharer(null);
      setScreenShareStream(null);
      return;
    }

    // If someone else is sharing: do not initiate
    if (screenSharer) {
      return;
    }

    // Start sharing
    setIsStartingScreenShare(true);
    try {
      const otherPeerSocketIds = liveParticipants
        .filter((p) => p.userId !== currentUser.userId && p.socketId)
        .map((p) => p.socketId as string);

      const stream = await webrtcManagerRef.current?.startScreenShare(otherPeerSocketIds);
      if (stream) {
        setScreenSharer({
          userId: currentUser.userId,
          socketId: socketRef.current.id || "",
          displayName: currentUser.displayName,
        });
        setScreenShareStream(stream);

        // Pause local YouTube player if playing
        if (playerAdapterRef.current?.isReady()) {
          isProgrammaticActionRef.current = true;
          playerAdapterRef.current.pause();
          setIsPlaying(false);
          desiredPlayStateRef.current = false;
        }
      }
    } catch (err) {
      console.error("Failed to start screen share:", err);
    } finally {
      setIsStartingScreenShare(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#f3efe8] p-4">
        <div className="flex items-center gap-3 text-[#686762] text-sm">
          <svg
            className="animate-spin h-5 w-5 text-[#262624]"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          <span>Loading room {code}...</span>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#f3efe8] p-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-[#e8e4dc] shadow-xs text-center">
          <h2 className="text-xl font-bold text-[#1f1f1d]">Room Not Found</h2>
          <p className="text-sm text-[#686762] mt-2">
            The room code <span className="font-mono font-bold text-[#1f1f1d]">{code}</span> could not be found or has expired.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-block py-2.5 px-6 bg-[#262624] hover:bg-[#1a1a18] text-white text-sm font-medium rounded-xl transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const participantIds =
    liveParticipants.length > 0
      ? liveParticipants.map((p) => p.userId)
      : room.participantIds || room.participants || [];

  return (
    <div className="min-h-screen w-full bg-[#f3efe8] flex flex-col">
      {/* Top navigation / room bar */}
      <header className="border-b border-[#e5e2db] bg-white/80 backdrop-blur-sm px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Link
            href="/"
            className="text-sm sm:text-base font-bold tracking-tight text-[#1f1f1d] hover:opacity-80 shrink-0"
          >
            Popcorn
          </Link>

          {/* Desktop Room pill */}
          <div className="hidden md:flex items-center gap-2 bg-[#f3efe8] px-2.5 py-1 rounded-lg border border-[#e5e2db]">
            <span className="text-xs text-[#8e8c85]">Room:</span>
            <span className="font-mono font-bold text-xs sm:text-sm text-[#1f1f1d] tracking-wider">
              {room.code}
            </span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="ml-1 text-xs text-[#686762] hover:text-[#1f1f1d] transition-colors cursor-pointer"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>

          {/* Mobile compact room badge (tap to copy) */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex md:hidden items-center gap-1.5 bg-[#f3efe8] hover:bg-[#eae5dc] px-2 py-1 rounded-lg border border-[#e5e2db] transition-colors cursor-pointer"
            title="Tap to copy room link"
          >
            <span className="font-mono font-bold text-xs text-[#1f1f1d] tracking-wider">
              {room.code}
            </span>
            {copied ? (
              <span className="text-[10px] font-semibold text-emerald-600">Copied!</span>
            ) : (
              <svg className="w-3 h-3 text-[#8e8c85]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>

        {/* Desktop Navigation Actions (100% faithful to reference mockup) */}
        <div className="hidden md:flex items-center gap-2 sm:gap-3">
          {/* Share Screen Button */}
          <button
            type="button"
            onClick={handleToggleScreenShare}
            disabled={Boolean(screenSharer && screenSharer.userId !== currentUser?.userId) || isStartingScreenShare}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs ${
              screenSharer?.userId === currentUser?.userId
                ? "bg-red-600 hover:bg-red-700 text-white"
                : screenSharer
                ? "bg-[#e8e4dc] text-[#8e8c85] cursor-not-allowed"
                : "bg-white border border-[#d6d2c9] hover:bg-[#f5f2eb] text-[#1f1f1d]"
            }`}
            title={
              screenSharer && screenSharer.userId !== currentUser?.userId
                ? `${screenSharer.displayName} is currently sharing their screen`
                : screenSharer?.userId === currentUser?.userId
                ? "Stop sharing your screen"
                : "Share your screen with the room"
            }
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <span>
              {screenSharer?.userId === currentUser?.userId
                ? "Stop sharing"
                : screenSharer
                ? `${screenSharer.displayName} sharing`
                : isStartingScreenShare
                ? "Connecting..."
                : "Share screen"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="text-xs font-semibold px-3 py-1.5 bg-[#262624] hover:bg-black text-white rounded-lg transition-colors cursor-pointer"
          >
            + Add video
          </button>

          {currentUser && (
            <button
              type="button"
              onClick={() => {
                setIsInitialNamePrompt(false);
                setIsNameModalOpen(true);
              }}
              className="flex items-center gap-2 py-1 px-2.5 rounded-xl border border-[#e5e2db] bg-[#fbf9f5] hover:bg-[#f3efe8] transition-all cursor-pointer group"
              title="Click to change your name"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shadow-xs select-none"
                style={{ backgroundColor: currentUser.avatarColor }}
              >
                {currentUser.displayName ? getInitials(currentUser.displayName) : "U"}
              </div>
              <span className="hidden sm:inline text-xs font-semibold text-[#1f1f1d]">
                {currentUser.displayName}
              </span>
              <svg className="w-3 h-3 text-[#8e8c85] group-hover:text-[#1f1f1d] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              {isHost && (
                <span className="hidden sm:inline px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]">
                  Host
                </span>
              )}
            </button>
          )}
        </div>

        {/* Mobile Navigation Actions (< md:) */}
        <div className="flex md:hidden items-center gap-2 relative" ref={mobileMenuRef}>
          {/* Primary Action: + Add Video */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="text-xs font-semibold px-2.5 py-1.5 bg-[#262624] hover:bg-black text-white rounded-lg transition-colors cursor-pointer shrink-0 shadow-2xs"
          >
            + Add video
          </button>

          {/* Mobile Kebab / Menu Trigger */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 py-1 px-1.5 rounded-xl border transition-all cursor-pointer ${
              isMobileMenuOpen
                ? "border-[#262624] bg-[#f3efe8]"
                : "border-[#e5e2db] bg-[#fbf9f5] hover:bg-[#f3efe8]"
            }`}
            aria-label="Room options menu"
            aria-expanded={isMobileMenuOpen}
          >
            {currentUser ? (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shadow-xs select-none shrink-0"
                style={{ backgroundColor: currentUser.avatarColor }}
              >
                {currentUser.displayName ? getInitials(currentUser.displayName) : "U"}
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-[#e5e2db] flex items-center justify-center text-[11px] font-bold text-[#686762]">
                ?
              </div>
            )}
            <svg className="w-3.5 h-3.5 text-[#686762]" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {/* Mobile Action Dropdown Menu */}
          {isMobileMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white/95 backdrop-blur-md border border-[#e5e2db] rounded-2xl shadow-xl z-50 p-2.5 flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
              {/* User Profile / Name Row */}
              {currentUser && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-[#fbf9f5] border border-[#f0ece4]">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-xs shrink-0 select-none"
                      style={{ backgroundColor: currentUser.avatarColor }}
                    >
                      {currentUser.displayName ? getInitials(currentUser.displayName) : "U"}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-[#1f1f1d] truncate">
                        {currentUser.displayName}
                      </span>
                      {isHost ? (
                        <span className="text-[10px] font-semibold text-[#0369a1]">
                          Room Host
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#8e8c85]">
                          Participant
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsInitialNamePrompt(false);
                      setIsNameModalOpen(true);
                    }}
                    className="p-1 text-[#8e8c85] hover:text-[#1f1f1d] hover:bg-[#f3efe8] rounded-lg transition-colors cursor-pointer shrink-0"
                    title="Change name"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Share Screen Option */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleToggleScreenShare();
                }}
                disabled={Boolean(screenSharer && screenSharer.userId !== currentUser?.userId) || isStartingScreenShare}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  screenSharer?.userId === currentUser?.userId
                    ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                    : screenSharer
                    ? "bg-[#f5f2eb] text-[#8e8c85] cursor-not-allowed opacity-75"
                    : "hover:bg-[#f5f2eb] text-[#1f1f1d]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#8e8c85]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <span>
                    {screenSharer?.userId === currentUser?.userId
                      ? "Stop sharing"
                      : screenSharer
                      ? `${screenSharer.displayName} sharing`
                      : isStartingScreenShare
                      ? "Connecting..."
                      : "Share screen"}
                  </span>
                </div>
                {screenSharer?.userId === currentUser?.userId && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </button>

              {/* Copy Room Link Option */}
              <button
                type="button"
                onClick={() => {
                  handleCopyLink();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold hover:bg-[#f5f2eb] text-[#1f1f1d] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#8e8c85]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Copy room link</span>
                </div>
                {copied && (
                  <span className="text-[10px] font-bold text-emerald-600">Copied!</span>
                )}
              </button>

              {/* Room Stats Footer */}
              <div className="pt-1 mt-0.5 border-t border-[#f0ece4] px-2 flex items-center justify-between text-[11px] text-[#8e8c85]">
                <span>Room {room.code}</span>
                <span>{participantIds.length} {participantIds.length === 1 ? "peer" : "peers"}</span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Watch Room Container */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 flex flex-col gap-4">
        {/* Video & Controls Area */}
        <div
          ref={videoContainerRef}
          className={`w-full flex flex-col gap-4 transition-all duration-150 ${
            isCssFullscreen
              ? "fixed inset-0 z-50 bg-black flex flex-col justify-between p-3 sm:p-6 w-screen h-screen overflow-hidden"
              : "[&:fullscreen]:p-4 sm:[&:fullscreen]:p-6 [&:fullscreen]:bg-black [&:fullscreen]:justify-between [&:fullscreen]:h-screen [&:fullscreen]:w-screen"
          }`}
        >
          {/* Video Area */}
          <div className={`w-full ${
            isCssFullscreen
              ? "flex-1 flex items-center justify-center min-h-0"
              : "[&:fullscreen]:flex-1 [&:fullscreen]:flex [&:fullscreen]:items-center [&:fullscreen]:justify-center [&:fullscreen]:min-h-0"
          }`}>
          {screenSharer ? (
            <ScreenSharePlayer
              stream={screenShareStream}
              isPresenter={screenSharer.userId === currentUser?.userId}
              sharerName={screenSharer.displayName}
              onStopSharing={handleToggleScreenShare}
            />
          ) : videoError ? (
            <div className="w-full aspect-video rounded-2xl border border-[#d6d2c9] bg-white flex flex-col items-center justify-center p-6 text-center shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mb-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-base font-bold text-[#1f1f1d] mb-1">
                Video Unavailable
              </h3>
              <p className="text-xs sm:text-sm text-[#686762] max-w-md mb-4 leading-relaxed">
                {videoError.message}
              </p>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-[#262624] hover:bg-black text-white text-xs sm:text-sm font-medium rounded-xl transition-colors cursor-pointer"
              >
                Choose another video
              </button>
            </div>
          ) : activeVideo?.type === "youtube" && activeVideo.videoId ? (
            <YouTubePlayer
              videoId={activeVideo.videoId}
              isHost={isHost}
              onVideoClick={handlePlayPause}
              callbacks={{
                onReady: (dur) => {
                  setDuration(dur);
                },
                onStateChange: (playing) => {
                  // Guard against programmatic playback updates echoing back to server
                  if (isProgrammaticActionRef.current) {
                    isProgrammaticActionRef.current = false;
                    setIsPlaying(playing);
                    return;
                  }

                  if (isHost) {
                    // Host interaction: emit room sync to server
                    if (playing !== desiredPlayStateRef.current && socketRef.current?.connected) {
                      desiredPlayStateRef.current = playing;
                      const curr = playerAdapterRef.current?.getCurrentTime() ?? currentTime;
                      if (playing) {
                        socketRef.current.emit("play", {
                          roomId: code,
                          mediaTime: curr,
                          timestamp: Date.now(),
                        });
                      } else {
                        socketRef.current.emit("pause", {
                          roomId: code,
                          mediaTime: curr,
                          timestamp: Date.now(),
                        });
                      }
                    }
                  } else {
                    // Guest local interaction: track local pause state without socket broadcast
                    if (!playing) {
                      isLocallyPausedRef.current = true;
                      setSyncStatus("syncing");
                    } else {
                      isLocallyPausedRef.current = false;
                    }
                  }
                  setIsPlaying(playing);
                },
                onTimeUpdate: (curr, dur) => {
                  setCurrentTime(curr);
                  if (dur > 0) setDuration(dur);

                  // Host native scrubber detection (e.g. host scrubbed directly on YouTube's player)
                  if (isHost && !isProgrammaticActionRef.current && lastReportedTimeRef.current !== null) {
                    const jump = Math.abs(curr - lastReportedTimeRef.current);
                    if (jump > 1.5) {
                      if (socketRef.current?.connected) {
                        socketRef.current.emit("seek", {
                          roomId: code,
                          mediaTime: curr,
                          timestamp: Date.now(),
                        });
                      }
                    }
                  }
                  lastReportedTimeRef.current = curr;
                },
                onBuffering: (buffering) => {
                  // Only report buffering to the server if the room is actively playing
                  if (socketRef.current?.connected && desiredPlayStateRef.current) {
                    socketRef.current.emit("buffering", {
                      roomId: code,
                      isBuffering: buffering,
                      mediaTime: playerAdapterRef.current?.getCurrentTime() ?? currentTime,
                    });
                  }
                  if (buffering) {
                    setSyncStatus("syncing");
                  } else {
                    setSyncStatus("synced");
                  }
                },
                onError: (msg, code) => {
                  setVideoError({ message: msg, code });
                  setIsPlaying(false);
                },
              }}
              onAdapterReady={handleAdapterReady}
            />
          ) : (
            /* Exact match to design/2-watch-room.jpg placeholder state */
            <div
              onClick={() => setIsModalOpen(true)}
              className="w-full aspect-video rounded-2xl border border-[#d6d2c9] bg-white flex items-center justify-center cursor-pointer group hover:border-[#1f1f1d] transition-colors shadow-xs"
            >
              <div className="flex items-center gap-2 text-sm sm:text-base font-medium text-[#8e8c85] group-hover:text-[#1f1f1d] transition-colors">
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 4.5v15a1 1 0 0 0 1.524.852l12-7.5a1 1 0 0 0 0-1.704l-12-7.5A1 1 0 0 0 6 4.5z" />
                </svg>
                <span>video player</span>
              </div>
            </div>
          )}
        </div>

        {/* Peer Buffering Indicator (design/4-host-controls-buffering.jpg) */}
        {bufferingPeerInfo?.isBuffering && (
          <div className="w-full bg-[#f3f0e8] border border-[#e5e0d4] rounded-2xl p-4 flex items-center justify-center gap-3 text-center my-3 transition-opacity">
            <svg className="w-5 h-5 text-[#8e8c85] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <div>
              <div className="text-sm font-semibold text-[#1f1f1d]">
                {bufferingPeerInfo.bufferingUserId === currentUser?.userId
                  ? "Catching up to the group"
                  : `${bufferingPeerInfo.bufferingUserName || "A peer"} is catching up`}
              </div>
              <div className="text-xs text-[#8e8c85]">
                {bufferingPeerInfo.bufferingUserId === currentUser?.userId
                  ? "Others are paused for you"
                  : "Playback paused while they buffer"}
              </div>
            </div>
          </div>
        )}

        {/* Playback Controls Bar (active when not in screen share) */}
        {!screenSharer && (
          <PlaybackControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            volume={volume}
            isMuted={isMuted}
            onVolumeChange={handleVolumeChange}
            onToggleMute={handleToggleMute}
            syncStatus={syncStatus}
            isHost={isHost}
            onSyncToHost={handleSyncToHost}
            isFullscreen={isFullscreen || isCssFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
          />
        )}
        </div>

        {/* Bottom Area: Participants and Chat Panel */}
        <ChatPanel
          currentUserName={currentUser?.displayName || "You"}
          messages={chatMessages}
          onSendMessage={handleSendChatMessage}
          participantContent={
            <ParticipantList
              participants={
                liveParticipants.length > 0
                  ? liveParticipants
                  : currentUser
                  ? [
                      {
                        userId: currentUser.userId,
                        displayName: currentUser.displayName,
                        avatarColor: currentUser.avatarColor,
                      },
                    ]
                  : []
              }
              participantIds={participantIds}
              currentUserId={currentUser?.userId}
              currentUserName={currentUser?.displayName}
              currentUserColor={currentUser?.avatarColor}
            />
          }
        />
      </main>

      {/* Add Source Modal (design/3-add-source-modal.jpg) */}
      <AddSourceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelectSource={handleSelectSource}
      />

      {/* User Name Modal */}
      <UserNameModal
        isOpen={isNameModalOpen}
        initialName={currentUser?.displayName || ""}
        isInitialPrompt={isInitialNamePrompt}
        roomCode={code}
        onSave={(newName) => {
          const updated = updateUserName(newName);
          setCurrentUser({ ...updated });
          setIsNameModalOpen(false);
          setIsInitialNamePrompt(false);

          if (socketRef.current?.connected) {
            socketRef.current.emit("update_user", {
              roomId: code,
              displayName: updated.displayName,
            });
          }
        }}
        onClose={() => {
          if (!isInitialNamePrompt) {
            setIsNameModalOpen(false);
          }
        }}
      />
    </div>
  );
}
