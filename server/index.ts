import http from "http";
import { Server, Socket } from "socket.io";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

interface Peer {
  socketId: string;
  userId: string;
  displayName: string;
  avatarColor: string;
  lastReportedTime: number;
  lastPing: number;
  isBuffering: boolean;
}

interface RoomSyncState {
  roomId: string;
  hostId: string;
  isPlaying: boolean;
  mediaTime: number;
  lastUpdated: number; // server timestamp
  activeVideo?: {
    type: "youtube";
    videoId: string;
    duration?: number;
  };
  peers: Map<string, Peer>; // socketId -> Peer
  messages?: Array<{
    id: string;
    sender: string;
    text: string;
    timestamp: string | Date;
  }>;
  pausedByBuffering?: boolean;
  bufferStallTimeout?: NodeJS.Timeout | null;
  hostDisconnectTimeout?: NodeJS.Timeout | null;
  screenSharer?: {
    userId: string;
    socketId: string;
    displayName: string;
  } | null;
}

const rooms = new Map<string, RoomSyncState>();

function isHostOnline(room: RoomSyncState): boolean {
  for (const peer of room.peers.values()) {
    if (peer.userId === room.hostId) return true;
  }
  return false;
}

function getComputedMediaTime(room: RoomSyncState): number {
  if (!room.isPlaying) {
    return room.mediaTime;
  }
  const elapsedSeconds = (Date.now() - room.lastUpdated) / 1000;
  return room.mediaTime + Math.max(0, elapsedSeconds);
}

function broadcastParticipants(io: Server, roomId: string, room: RoomSyncState) {
  const participants = Array.from(room.peers.values()).map((p) => ({
    socketId: p.socketId,
    userId: p.userId,
    displayName: p.displayName,
    avatarColor: p.avatarColor,
  }));

  io.to(roomId).emit("room_participants", {
    participants,
    hostId: room.hostId,
  });
}

function handlePeerLeave(io: Server, socket: Socket, roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  const departingPeer = room.peers.get(socket.id);
  if (!departingPeer) return;

  room.peers.delete(socket.id);
  socket.leave(roomId);

  console.log(`[Leave] User ${departingPeer.userId} (${departingPeer.displayName}) left room ${roomId}`);

  // 1. Broadcast departure notice in chat and save to session history
  const departureNotice = {
    id: `msg-sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sender: "System",
    text: `${departingPeer.displayName} left the room`,
    timestamp: new Date().toISOString(),
  };
  if (!room.messages) room.messages = [];
  room.messages.push(departureNotice);
  if (room.messages.length > 100) room.messages.shift();
  io.to(roomId).emit("chat_message", departureNotice);

  // 1b. If the departing peer was sharing their screen, stop screen share
  if (room.screenSharer && room.screenSharer.socketId === socket.id) {
    const sharerName = room.screenSharer.displayName;
    room.screenSharer = null;
    const stopNotice = {
      id: `msg-sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: "System",
      text: `${sharerName} stopped screen sharing`,
      timestamp: new Date().toISOString(),
    };
    room.messages.push(stopNotice);
    if (room.messages.length > 100) room.messages.shift();
    io.to(roomId).emit("chat_message", stopNotice);
    io.to(roomId).emit("screen_share_stopped", {});
  }

  // 2. Immediately broadcast updated participants to remaining peers in the room
  broadcastParticipants(io, roomId, room);

  // 3. If host departed, trigger failover after grace period
  if (departingPeer.userId === room.hostId) {
    const stillConnected = isHostOnline(room);
    if (!stillConnected && room.peers.size > 0 && !room.hostDisconnectTimeout) {
      // Immediately inform clients that host is offline so controls unlock without delay
      io.to(roomId).emit("host_status", {
        isHostOnline: false,
        hostId: room.hostId,
      });

      room.hostDisconnectTimeout = setTimeout(() => {
        room.hostDisconnectTimeout = null;
        if (!isHostOnline(room)) {
          const remainingPeers = Array.from(room.peers.values());
          if (remainingPeers.length > 0) {
            const newHost = remainingPeers[0];
            room.hostId = newHost.userId;
            console.log(
              `[Host Failover] Promoted user ${newHost.userId} (${newHost.displayName}) to Host for room ${roomId}`
            );

            io.to(roomId).emit("host_status", {
              isHostOnline: true,
              hostId: room.hostId,
            });
            io.to(roomId).emit("sync_state", {
              mediaTime: getComputedMediaTime(room),
              isPlaying: room.isPlaying,
              serverTime: Date.now(),
              videoId: room.activeVideo?.videoId,
              hostId: room.hostId,
              isHostOnline: true,
            });
            broadcastParticipants(io, roomId, room);
          } else {
            io.to(roomId).emit("host_status", {
              isHostOnline: false,
              hostId: room.hostId,
            });
            console.log(`[Host Left] Host ${room.hostId} is offline for room ${roomId}`);
          }
        }
      }, 1500);
    }
  }

  // 4. Clear buffering stall if departed peer was buffering
  const anyStillBuffering = Array.from(room.peers.values()).some((p) => p.isBuffering);
  if (!anyStillBuffering) {
    if (room.bufferStallTimeout) {
      clearTimeout(room.bufferStallTimeout);
      room.bufferStallTimeout = null;
    }
    io.to(roomId).emit("buffering_state", { isBuffering: false });
    if (room.pausedByBuffering) {
      room.pausedByBuffering = false;
      room.isPlaying = true;
      room.lastUpdated = Date.now();
      io.to(roomId).emit("sync_state", {
        mediaTime: room.mediaTime,
        isPlaying: true,
        serverTime: Date.now(),
        videoId: room.activeVideo?.videoId,
        hostId: room.hostId,
        isHostOnline: isHostOnline(room),
      });
    }
  }

  // 5. If room is empty, schedule cleanup after 5 minutes
  if (room.peers.size === 0) {
    if (room.hostDisconnectTimeout) {
      clearTimeout(room.hostDisconnectTimeout);
      room.hostDisconnectTimeout = null;
    }
    setTimeout(() => {
      const checkRoom = rooms.get(roomId);
      if (checkRoom && checkRoom.peers.size === 0) {
        rooms.delete(roomId);
        console.log(`[Cleanup] Room ${roomId} removed`);
      }
    }, 5 * 60 * 1000);
  }
}

const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", activeRooms: rooms.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const rawAllowedOrigins = process.env.ALLOWED_ORIGIN || process.env.ALLOWED_ORIGINS;
const corsOrigin = rawAllowedOrigins
  ? rawAllowedOrigins.includes(",")
    ? rawAllowedOrigins.split(",").map((o) => o.trim())
    : rawAllowedOrigins.trim()
  : "*";

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
});


io.on("connection", (socket: Socket) => {
  let currentRoomId: string | null = null;

  socket.on(
    "join_room",
    (data: {
      roomId: string;
      userId: string;
      roomHostId?: string;
      user?: { displayName: string; avatarColor: string };
      activeVideo?: {
        type: "youtube";
        videoId: string;
        duration?: number;
      };
      mediaTime?: number;
    }) => {
      const { roomId, userId, roomHostId, user } = data;
      if (!roomId || !userId) return;

      if (currentRoomId && currentRoomId !== roomId) {
        handlePeerLeave(io, socket, currentRoomId);
      }

      currentRoomId = roomId;
      socket.join(roomId);

      let room = rooms.get(roomId);
      if (!room) {
        room = {
          roomId,
          hostId: roomHostId || userId,
          isPlaying: false,
          mediaTime: 0,
          lastUpdated: Date.now(),
          peers: new Map(),
          messages: [],
        };
        rooms.set(roomId, room);
      } else if (!room.hostId || !isHostOnline(room)) {
        if (roomHostId) {
          room.hostId = roomHostId;
        } else if (room.peers.size === 0) {
          room.hostId = userId;
        }
      }

      if (data.activeVideo && !room.activeVideo) {
        room.activeVideo = data.activeVideo;
      }
      if (data.userId === room.hostId && typeof data.mediaTime === "number") {
        room.mediaTime = data.mediaTime;
        room.lastUpdated = Date.now();
        io.to(roomId).emit("sync_state", {
          mediaTime: room.mediaTime,
          isPlaying: room.isPlaying,
          serverTime: Date.now(),
          videoId: room.activeVideo?.videoId,
          hostId: room.hostId,
        });
      }

      const isNewPeer = !room.peers.has(socket.id);

      const peer: Peer = {
        socketId: socket.id,
        userId,
        displayName: user?.displayName || "Anonymous",
        avatarColor: user?.avatarColor || "#93c5fd",
        lastReportedTime: 0,
        lastPing: Date.now(),
        isBuffering: false,
      };

      room.peers.set(socket.id, peer);

      if (isNewPeer) {
        const joinNotice = {
          id: `msg-sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sender: "System",
          text: `${peer.displayName} joined the room`,
          timestamp: new Date().toISOString(),
        };
        if (!room.messages) room.messages = [];
        room.messages.push(joinNotice);
        if (room.messages.length > 100) room.messages.shift();
        io.to(roomId).emit("chat_message", joinNotice);
      }

      if (userId === room.hostId) {
        if (room.hostDisconnectTimeout) {
          clearTimeout(room.hostDisconnectTimeout);
          room.hostDisconnectTimeout = null;
        }
        io.to(roomId).emit("host_status", {
          isHostOnline: true,
          hostId: room.hostId,
        });
      }

      // Send initial sync state to the new joiner
      socket.emit("sync_state", {
        mediaTime: getComputedMediaTime(room),
        isPlaying: room.isPlaying,
        serverTime: Date.now(),
        videoId: room.activeVideo?.videoId,
        hostId: room.hostId,
        isHostOnline: isHostOnline(room),
      });

      // Send recent chat messages from active session
      if (room.messages && room.messages.length > 0) {
        socket.emit("chat_history", {
          messages: room.messages,
        });
      }

      // If screen share is active, inform the new joiner
      if (room.screenSharer) {
        socket.emit("screen_share_started", {
          sharer: room.screenSharer,
        });
      }

      // Broadcast participants list
      broadcastParticipants(io, roomId, room);
      console.log(`[Join] User ${userId} (${peer.displayName}) joined room ${roomId}`);
    }
  );

  socket.on(
    "play",
    (data: { roomId: string; timestamp: number; mediaTime: number }) => {
      const { roomId, mediaTime } = data;
      const room = rooms.get(roomId);
      if (!room) return;

      const peer = room.peers.get(socket.id);
      if (!peer || peer.userId !== room.hostId) {
        console.log(`[Play Ignored] Non-host user ${peer?.userId} attempted room play in ${roomId}`);
        return;
      }

      room.isPlaying = true;
      room.pausedByBuffering = false;
      if (room.bufferStallTimeout) {
        clearTimeout(room.bufferStallTimeout);
        room.bufferStallTimeout = null;
      }
      io.to(roomId).emit("buffering_state", { isBuffering: false });
      room.mediaTime = typeof mediaTime === "number" ? Math.max(0, mediaTime) : getComputedMediaTime(room);
      room.lastUpdated = Date.now();

      io.to(roomId).emit("sync_state", {
        mediaTime: room.mediaTime,
        isPlaying: true,
        serverTime: Date.now(),
        videoId: room.activeVideo?.videoId,
        hostId: room.hostId,
      });

      console.log(`[Play] Room ${roomId} by Host at ${room.mediaTime.toFixed(2)}s`);
    }
  );

  socket.on(
    "pause",
    (data: { roomId: string; timestamp: number; mediaTime: number }) => {
      const { roomId, mediaTime } = data;
      const room = rooms.get(roomId);
      if (!room) return;

      const peer = room.peers.get(socket.id);
      if (!peer || peer.userId !== room.hostId) {
        console.log(`[Pause Ignored] Non-host user ${peer?.userId} attempted room pause in ${roomId}`);
        return;
      }

      room.isPlaying = false;
      room.pausedByBuffering = false;
      if (room.bufferStallTimeout) {
        clearTimeout(room.bufferStallTimeout);
        room.bufferStallTimeout = null;
      }
      io.to(roomId).emit("buffering_state", { isBuffering: false });
      room.mediaTime = typeof mediaTime === "number" ? Math.max(0, mediaTime) : getComputedMediaTime(room);
      room.lastUpdated = Date.now();

      io.to(roomId).emit("sync_state", {
        mediaTime: room.mediaTime,
        isPlaying: false,
        serverTime: Date.now(),
        videoId: room.activeVideo?.videoId,
        hostId: room.hostId,
      });

      console.log(`[Pause] Room ${roomId} by Host at ${room.mediaTime.toFixed(2)}s`);
    }
  );

  socket.on(
    "seek",
    (data: { roomId: string; timestamp: number; mediaTime: number }) => {
      const { roomId, mediaTime } = data;
      const room = rooms.get(roomId);
      if (!room || typeof mediaTime !== "number") return;

      const peer = room.peers.get(socket.id);
      if (!peer || peer.userId !== room.hostId) {
        console.log(`[Seek Rejected] Non-host user ${peer?.userId} attempted seek in ${roomId}`);
        return;
      }

      room.mediaTime = Math.max(0, mediaTime);
      room.lastUpdated = Date.now();

      io.to(roomId).emit("sync_state", {
        mediaTime: room.mediaTime,
        isPlaying: room.isPlaying,
        serverTime: Date.now(),
        videoId: room.activeVideo?.videoId,
        hostId: room.hostId,
      });

      console.log(`[Seek] Room ${roomId} by Host to ${room.mediaTime.toFixed(2)}s`);
    }
  );

  socket.on(
    "set_video",
    (data: {
      roomId: string;
      video: { type: "youtube"; videoId: string; title?: string };
    }) => {
      const { roomId, video } = data;
      const room = rooms.get(roomId);
      if (!room || !video?.videoId) return;

      const peer = room.peers.get(socket.id);
      if (!peer) {
        console.log(`[Set Video Rejected] Unknown socket ${socket.id} attempted video change in ${roomId}`);
        return;
      }

      // Auto-stop screen sharing if active so YouTube player takes over
      if (room.screenSharer) {
        const sharerName = room.screenSharer.displayName;
        room.screenSharer = null;
        io.to(roomId).emit("screen_share_stopped", {});
        console.log(`[Screen Share Stopped via Set Video] ${sharerName} in ${roomId}`);
      }

      room.activeVideo = video;
      room.mediaTime = 0;
      room.isPlaying = false;
      room.lastUpdated = Date.now();

      io.to(roomId).emit("sync_state", {
        mediaTime: 0,
        isPlaying: false,
        serverTime: Date.now(),
        videoId: video.videoId,
        hostId: room.hostId,
      });

      // System notification in chat
      const videoNotice = {
        id: `msg-sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: "System",
        text: `${peer.displayName} queued a new video`,
        timestamp: new Date().toISOString(),
      };
      if (!room.messages) room.messages = [];
      room.messages.push(videoNotice);
      if (room.messages.length > 100) room.messages.shift();
      io.to(roomId).emit("chat_message", videoNotice);

      console.log(`[Video Changed] Room ${roomId} set to ${video.videoId} by ${peer.displayName}`);
    }
  );

  socket.on("transfer_host", (data: { roomId: string; newHostId: string }) => {
    const { roomId, newHostId } = data;
    const room = rooms.get(roomId);
    if (!room) return;

    const peer = room.peers.get(socket.id);
    if (!peer || peer.userId !== room.hostId) return;

    room.hostId = newHostId;
    io.to(roomId).emit("sync_state", {
      mediaTime: getComputedMediaTime(room),
      isPlaying: room.isPlaying,
      serverTime: Date.now(),
      videoId: room.activeVideo?.videoId,
      hostId: room.hostId,
    });
    broadcastParticipants(io, roomId, room);
    console.log(`[Host Transfer] Room ${roomId} host manually transferred to ${newHostId}`);
  });

  socket.on("request_sync", (data: { roomId: string }) => {
    const { roomId } = data;
    const room = rooms.get(roomId);
    if (!room) return;

    socket.emit("sync_state", {
      mediaTime: getComputedMediaTime(room),
      isPlaying: room.isPlaying,
      serverTime: Date.now(),
      videoId: room.activeVideo?.videoId,
      hostId: room.hostId,
    });
    console.log(`[Request Sync] Socket ${socket.id} resynced with room ${roomId}`);
  });

  socket.on(
    "heartbeat",
    (data: { roomId: string; timestamp: number; mediaTime: number }) => {
      const { roomId, mediaTime } = data;
      const room = rooms.get(roomId);
      if (!room || typeof mediaTime !== "number") return;

      const peer = room.peers.get(socket.id);
      if (peer) {
        peer.lastReportedTime = mediaTime;
        peer.lastPing = Date.now();
      }

      // If heartbeat is from host, update authoritative room position
      if (peer && peer.userId === room.hostId) {
        room.mediaTime = mediaTime;
        room.lastUpdated = Date.now();

        // Drift corrections only apply when actively playing! When paused, room is static.
        if (!room.isPlaying) {
          return;
        }

        // Check drift only for other peers who have reported a position
        const expectedTime = getComputedMediaTime(room);
        room.peers.forEach((otherPeer) => {
          if (
            otherPeer.userId !== room.hostId &&
            !otherPeer.isBuffering &&
            typeof otherPeer.lastReportedTime === "number" &&
            otherPeer.lastReportedTime >= 0
          ) {
            const peerDrift = Math.abs(expectedTime - otherPeer.lastReportedTime);
            // Send correction if drift exceeds 300ms
            if (peerDrift >= 0.3) {
              io.to(otherPeer.socketId).emit("correction", {
                mediaTime: expectedTime,
                serverTime: Date.now(),
              });
            }
          }
        });
      }
    }
  );

  socket.on(
    "buffering",
    (data: { roomId: string; isBuffering: boolean; mediaTime?: number }) => {
      const { roomId, isBuffering, mediaTime } = data;
      const room = rooms.get(roomId);
      if (!room) return;

      const peer = room.peers.get(socket.id);
      if (peer) {
        peer.isBuffering = isBuffering;
        if (typeof mediaTime === "number") {
          peer.lastReportedTime = mediaTime;
        }
      }

      if (isBuffering) {
        // Debounce: Only broadcast buffering state and pause the room if buffering persists for > 1500ms (sustained network stall)
        if (room.isPlaying && !room.bufferStallTimeout) {
          room.bufferStallTimeout = setTimeout(() => {
            room.bufferStallTimeout = null;
            const anyStillBuffering = Array.from(room.peers.values()).some((p) => p.isBuffering);
            if (room.isPlaying && anyStillBuffering) {
              room.isPlaying = false;
              room.pausedByBuffering = true;
              room.mediaTime = typeof mediaTime === "number" ? mediaTime : getComputedMediaTime(room);
              room.lastUpdated = Date.now();

              io.to(roomId).emit("buffering_state", {
                isBuffering: true,
                bufferingUserId: peer?.userId,
                bufferingUserName: peer?.displayName,
              });

              io.to(roomId).emit("sync_state", {
                mediaTime: room.mediaTime,
                isPlaying: false,
                serverTime: Date.now(),
                videoId: room.activeVideo?.videoId,
                hostId: room.hostId,
              });

              console.log(`[Stall Paused] Room ${roomId} paused due to sustained buffer stall`);
            }
          }, 1500);
        }
      } else {
        // Peer is done buffering
        if (room.bufferStallTimeout) {
          clearTimeout(room.bufferStallTimeout);
          room.bufferStallTimeout = null;
        }

        const anyBuffering = Array.from(room.peers.values()).some((p) => p.isBuffering);
        if (!anyBuffering) {
          io.to(roomId).emit("buffering_state", {
            isBuffering: false,
          });

          // Auto-resume playback if room was paused because of a buffer stall
          if (room.pausedByBuffering) {
            room.pausedByBuffering = false;
            room.isPlaying = true;
            room.lastUpdated = Date.now();

            io.to(roomId).emit("sync_state", {
              mediaTime: room.mediaTime,
              isPlaying: true,
              serverTime: Date.now(),
              videoId: room.activeVideo?.videoId,
              hostId: room.hostId,
            });

            console.log(`[Stall Resumed] Room ${roomId} auto-resumed after buffer recovery`);
          }
        }
      }
    }
  );

  socket.on(
    "chat_message",
    (data: {
      roomId: string;
      message: {
        id: string;
        sender: string;
        text: string;
        timestamp: string | Date;
      };
    }) => {
      const { roomId, message } = data;
      if (!roomId || !message || !message.text?.trim()) return;

      const room = rooms.get(roomId);

      const sanitizedMessage = {
        id: message.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: message.sender || "Anonymous",
        text: message.text.slice(0, 500),
        timestamp: message.timestamp || new Date().toISOString(),
      };

      if (room) {
        if (!room.messages) room.messages = [];
        room.messages.push(sanitizedMessage);
        if (room.messages.length > 100) {
          room.messages.shift();
        }
      }

      io.to(roomId).emit("chat_message", sanitizedMessage);
    }
  );

    socket.on("update_user", (data: { roomId: string; displayName: string }) => {
      const { roomId, displayName } = data;
      if (!roomId || !displayName?.trim()) return;

      const room = rooms.get(roomId);
      if (!room) return;

      const peer = room.peers.get(socket.id);
      if (!peer) return;

      const oldName = peer.displayName;
      const newName = displayName.trim().slice(0, 30);
      if (oldName === newName) return;

      peer.displayName = newName;

      const renameNotice = {
        id: `msg-sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: "System",
        text: `${oldName} changed their name to ${newName}`,
        timestamp: new Date().toISOString(),
      };
      if (!room.messages) room.messages = [];
      room.messages.push(renameNotice);
      if (room.messages.length > 100) room.messages.shift();
      io.to(roomId).emit("chat_message", renameNotice);

      broadcastParticipants(io, roomId, room);
      console.log(`[Rename] User ${peer.userId} in room ${roomId}: "${oldName}" -> "${newName}"`);
    });

    socket.on("screen_share_start", (data: { roomId: string }) => {
      const { roomId } = data;
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      const peer = room.peers.get(socket.id);
      if (!peer) return;

      if (room.screenSharer && room.screenSharer.socketId !== socket.id) {
        socket.emit("screen_share_error", {
          message: `${room.screenSharer.displayName} is already sharing their screen.`,
        });
        return;
      }

      room.screenSharer = {
        userId: peer.userId,
        socketId: socket.id,
        displayName: peer.displayName,
      };

      // Automatically pause active video playback when screen share starts
      if (room.isPlaying) {
        room.isPlaying = false;
        room.lastUpdated = Date.now();
        io.to(roomId).emit("sync_state", {
          mediaTime: room.mediaTime,
          isPlaying: false,
          serverTime: Date.now(),
          videoId: room.activeVideo?.videoId,
          hostId: room.hostId,
        });
      }

      const shareNotice = {
        id: `msg-sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: "System",
        text: `${peer.displayName} started screen sharing`,
        timestamp: new Date().toISOString(),
      };
      if (!room.messages) room.messages = [];
      room.messages.push(shareNotice);
      if (room.messages.length > 100) room.messages.shift();
      io.to(roomId).emit("chat_message", shareNotice);

      io.to(roomId).emit("screen_share_started", {
        sharer: room.screenSharer,
      });

      console.log(`[Screen Share Started] ${peer.displayName} (${socket.id}) in ${roomId}`);
    });

    socket.on("screen_share_stop", (data: { roomId: string }) => {
      const { roomId } = data;
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || !room.screenSharer) return;

      if (room.screenSharer.socketId !== socket.id) return;

      const sharerName = room.screenSharer.displayName;
      room.screenSharer = null;

      const stopNotice = {
        id: `msg-sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: "System",
        text: `${sharerName} stopped screen sharing`,
        timestamp: new Date().toISOString(),
      };
      if (!room.messages) room.messages = [];
      room.messages.push(stopNotice);
      if (room.messages.length > 100) room.messages.shift();
      io.to(roomId).emit("chat_message", stopNotice);

      io.to(roomId).emit("screen_share_stopped", {});
      console.log(`[Screen Share Stopped] ${sharerName} in ${roomId}`);
    });

    socket.on(
      "webrtc_signal",
      (data: {
        toSocketId: string;
        signal: unknown;
      }) => {
        const { toSocketId, signal } = data;
        if (!toSocketId || !signal) return;

        io.to(toSocketId).emit("webrtc_signal", {
          fromSocketId: socket.id,
          signal,
        });
      }
    );

    socket.on("leave_room", (data: { roomId: string; userId?: string }) => {
      const targetRoomId = data?.roomId || currentRoomId;
      if (targetRoomId) {
        handlePeerLeave(io, socket, targetRoomId);
        if (currentRoomId === targetRoomId) {
          currentRoomId = null;
        }
      }
    });

    socket.on("disconnect", () => {
      for (const [rId, r] of rooms.entries()) {
        if (r.peers.has(socket.id)) {
          handlePeerLeave(io, socket, rId);
        }
      }
      currentRoomId = null;
    });
  });

server.listen(PORT, () => {
  console.log(`🚀 Popcorn Realtime Sync Server running on port ${PORT}`);
});
