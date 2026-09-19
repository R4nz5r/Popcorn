import { io, Socket } from "socket.io-client";

export interface SyncStatePayload {
  mediaTime: number;
  isPlaying: boolean;
  serverTime: number;
  videoId?: string;
  hostId?: string;
  isHostOnline?: boolean;
}

export interface HostStatusPayload {
  isHostOnline: boolean;
  hostId?: string;
}

export interface CorrectionPayload {
  mediaTime: number;
  serverTime?: number;
}

export interface PeerUser {
  socketId?: string;
  userId: string;
  displayName: string;
  avatarColor: string;
}

export interface ScreenSharer {
  userId: string;
  socketId: string;
  displayName: string;
}

export interface ScreenShareStartedPayload {
  sharer: ScreenSharer;
}

export interface WebRTCSignalPayload {
  fromSocketId: string;
  toSocketId?: string;
  signal: RTCSessionDescriptionInit | RTCIceCandidateInit | Record<string, unknown>;
}

export interface VoicePeerUser {
  socketId: string;
  userId: string;
  displayName: string;
  avatarColor: string;
  isMuted: boolean;
  isSpeaking: boolean;
}

export interface VoiceSignalPayload {
  fromSocketId: string;
  toSocketId?: string;
  signal: RTCSessionDescriptionInit | RTCIceCandidateInit | Record<string, unknown>;
}

export interface ChatMessagePayload {
  id: string;
  sender: string;
  text: string;
  timestamp: Date | string;
}

export interface ChatHistoryPayload {
  messages: ChatMessagePayload[];
}

export interface RoomParticipantsPayload {
  participants: PeerUser[];
  hostId: string;
}

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    let socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

    // If running in browser and accessing via LAN IP or non-localhost host, adapt localhost URL
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (
        hostname &&
        hostname !== "localhost" &&
        hostname !== "127.0.0.1" &&
        (socketUrl.includes("localhost") || socketUrl.includes("127.0.0.1"))
      ) {
        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
        socketUrl = `${protocol}//${hostname}:3001`;
      }
    }

    socketInstance = io(socketUrl, {
      transports: ["websocket", "polling"],
      autoConnect: false,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
  }

  return socketInstance;
}
