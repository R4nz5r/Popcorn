import { Socket } from "socket.io-client";
import { getRTCConfiguration } from "@/lib/webrtc/iceConfig";

export interface WebRTCManagerCallbacks {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onStreamEnded?: () => void;
  onError?: (error: Error) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}

export class WebRTCManager {
  private socket: Socket;
  private roomId: string;
  private callbacks: WebRTCManagerCallbacks;

  // Presenter state
  private localStream: MediaStream | null = null;
  private presenterPeerConnections: Map<string, RTCPeerConnection> = new Map(); // viewerSocketId -> RTCPeerConnection

  // Viewer state
  private viewerPeerConnection: RTCPeerConnection | null = null;
  private remoteStream: MediaStream | null = null;
  private currentSharerSocketId: string | null = null;

  // Candidate queues keyed by remote peer socket ID to prevent race conditions across high latency / CGNAT
  private candidateQueues: Map<string, RTCIceCandidateInit[]> = new Map();

  constructor(socket: Socket, roomId: string, callbacks: WebRTCManagerCallbacks) {
    this.socket = socket;
    this.roomId = roomId;
    this.callbacks = callbacks;
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  public isSharing(): boolean {
    return this.localStream !== null;
  }

  /**
   * Start capturing screen and initiate WebRTC connections to all current peers in the room.
   */
  public async startScreenShare(targetSocketIds: string[]): Promise<MediaStream | null> {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      const err = new Error("Screen sharing is not supported on this browser/device.");
      this.callbacks.onError?.(err);
      throw err;
    }

    try {
      // Capture screen with high-fidelity stereo audio, disabling VoIP voice suppression
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: "browser",
          } as MediaTrackConstraints,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 2,
          } as MediaTrackConstraints,
        });
      } catch {
        // Fallback for browser engines that do not accept advanced audio constraints
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: "browser",
          } as MediaTrackConstraints,
          audio: true,
        });
      }

      this.localStream = stream;
      this.callbacks.onLocalStream?.(stream);

      // Handle user clicking the native browser "Stop sharing" button
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.stopScreenShare();
        };
      }

      // Notify the server and room that screen share started
      this.socket.emit("screen_share_start", { roomId: this.roomId });

      // Create peer connections and send offers to each target peer
      for (const socketId of targetSocketIds) {
        if (socketId && socketId !== this.socket.id) {
          await this.createPresenterConnection(socketId, stream);
        }
      }

      return stream;
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "NotAllowedError") {
        this.callbacks.onError?.(err);
      }
      return null;
    }
  }

  /**
   * Add a new peer (e.g. late joiner) if we are currently sharing screen.
   */
  public async addPeer(targetSocketId: string): Promise<void> {
    if (!this.localStream || !targetSocketId || targetSocketId === this.socket.id) return;
    if (this.presenterPeerConnections.has(targetSocketId)) return;

    await this.createPresenterConnection(targetSocketId, this.localStream);
  }

  /**
   * Stop sharing screen, notify server, and close all peer connections.
   */
  public stopScreenShare(): void {
    if (!this.localStream) return;

    // Stop all media tracks
    this.localStream.getTracks().forEach((track) => track.stop());
    this.localStream = null;

    // Close all presenter peer connections
    for (const pc of this.presenterPeerConnections.values()) {
      pc.close();
    }
    this.presenterPeerConnections.clear();
    this.candidateQueues.clear();

    // Emit stop event to server
    this.socket.emit("screen_share_stop", { roomId: this.roomId });
    this.callbacks.onStreamEnded?.();
  }

  /**
   * Handle incoming WebRTC signals relayed from the Socket.io server.
   */
  public async handleSignal(
    fromSocketId: string,
    signal: RTCSessionDescriptionInit | RTCIceCandidateInit | Record<string, unknown>
  ): Promise<void> {
    if (!fromSocketId || !signal) return;

    const sig = signal as {
      type?: string;
      sdp?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
    };

    if (sig.type === "offer") {
      // We are a viewer receiving an offer from a presenter
      await this.handleIncomingOffer(fromSocketId, (sig.sdp || sig) as RTCSessionDescriptionInit);
    } else if (sig.type === "answer") {
      // We are a presenter receiving an answer from a viewer
      await this.handleIncomingAnswer(fromSocketId, (sig.sdp || sig) as RTCSessionDescriptionInit);
    } else if (sig.type === "candidate" || sig.candidate) {
      // Incoming ICE candidate
      const candidateInit = (sig.candidate || sig) as RTCIceCandidateInit;
      await this.handleIncomingCandidate(fromSocketId, candidateInit);
    }
  }

  /**
   * Presenter helper: Create peer connection, add tracks, configure video bandwidth, and send offer.
   */
  private async createPresenterConnection(targetSocketId: string, stream: MediaStream): Promise<void> {
    const pc = new RTCPeerConnection(getRTCConfiguration());
    this.presenterPeerConnections.set(targetSocketId, pc);

    // Initialize candidate queue for this viewer
    if (!this.candidateQueues.has(targetSocketId)) {
      this.candidateQueues.set(targetSocketId, []);
    }

    // Add screen video & audio tracks to peer connection
    stream.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, stream);
      // For video tracks, optimize bitrate and degradation preference for smooth international streaming
      if (track.kind === "video") {
        try {
          const params = sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          // Cap maximum bitrate to ~3.5 Mbps so high-latency international links don't drop frames
          params.encodings[0].maxBitrate = 3500000;
          params.degradationPreference = "balanced";
          sender.setParameters(params).catch(() => {});
        } catch {}
      }
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit("webrtc_signal", {
          toSocketId: targetSocketId,
          signal: {
            type: "candidate",
            candidate: event.candidate.toJSON(),
          },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "failed" || state === "closed") {
        pc.close();
        this.presenterPeerConnections.delete(targetSocketId);
        this.candidateQueues.delete(targetSocketId);
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.socket.emit("webrtc_signal", {
        toSocketId: targetSocketId,
        signal: {
          type: "offer",
          sdp: offer,
        },
      });
    } catch (err) {
      console.error(`[WebRTC] Failed to create offer for ${targetSocketId}:`, err);
    }
  }

  /**
   * Presenter helper: Process received answer from viewer.
   */
  private async handleIncomingAnswer(fromSocketId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.presenterPeerConnections.get(fromSocketId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      // Flush any queued candidates that arrived before or during answer handling
      const queue = this.candidateQueues.get(fromSocketId) || [];
      while (queue.length > 0) {
        const cand = queue.shift();
        if (cand) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
      }
    } catch (err) {
      console.error(`[WebRTC] Failed to set remote answer from ${fromSocketId}:`, err);
    }
  }

  /**
   * Viewer helper: Process incoming offer from presenter.
   */
  private async handleIncomingOffer(fromSocketId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    // If viewer already has a connection from a previous presenter, close it
    if (this.viewerPeerConnection) {
      this.viewerPeerConnection.close();
      this.viewerPeerConnection = null;
    }

    this.currentSharerSocketId = fromSocketId;

    const pc = new RTCPeerConnection(getRTCConfiguration());
    this.viewerPeerConnection = pc;

    pc.ontrack = (event) => {
      let stream = event.streams && event.streams[0] ? event.streams[0] : null;
      if (!stream) {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        this.remoteStream.addTrack(event.track);
        stream = this.remoteStream;
      } else {
        this.remoteStream = stream;
      }
      this.callbacks.onRemoteStream?.(stream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit("webrtc_signal", {
          toSocketId: fromSocketId,
          signal: {
            type: "candidate",
            candidate: event.candidate.toJSON(),
          },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      this.callbacks.onConnectionStateChange?.(state);
      if (state === "failed" || state === "closed") {
        this.cleanupViewer();
      }
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      // Flush queued ICE candidates that arrived before or during offer processing
      const queue = this.candidateQueues.get(fromSocketId) || [];
      while (queue.length > 0) {
        const cand = queue.shift();
        if (cand) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.socket.emit("webrtc_signal", {
        toSocketId: fromSocketId,
        signal: {
          type: "answer",
          sdp: answer,
        },
      });
    } catch (err) {
      console.error(`[WebRTC] Failed to handle offer from ${fromSocketId}:`, err);
    }
  }

  /**
   * Handle incoming ICE candidate for either Presenter or Viewer.
   */
  private async handleIncomingCandidate(fromSocketId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.isSharing()
      ? this.presenterPeerConnections.get(fromSocketId)
      : (this.currentSharerSocketId === fromSocketId ? this.viewerPeerConnection : null);

    if (!pc || !pc.remoteDescription) {
      // Remote description not ready yet; buffer candidate in queue
      if (!this.candidateQueues.has(fromSocketId)) {
        this.candidateQueues.set(fromSocketId, []);
      }
      this.candidateQueues.get(fromSocketId)!.push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn(`[WebRTC] Error adding ice candidate from ${fromSocketId}:`, err);
    }
  }

  /**
   * Reset viewer state when screen share stops.
   */
  public cleanupViewer(): void {
    if (this.viewerPeerConnection) {
      this.viewerPeerConnection.close();
      this.viewerPeerConnection = null;
    }
    if (this.currentSharerSocketId) {
      this.candidateQueues.delete(this.currentSharerSocketId);
    }
    this.remoteStream = null;
    this.currentSharerSocketId = null;
    this.callbacks.onStreamEnded?.();
  }

  /**
   * Complete cleanup on unmount or room leave.
   */
  public destroy(): void {
    this.stopScreenShare();
    this.cleanupViewer();
  }
}
