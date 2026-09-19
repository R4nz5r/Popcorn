import { Socket } from "socket.io-client";

const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
};

export interface VoiceCallManagerCallbacks {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (socketId: string, stream: MediaStream) => void;
  onSpeakingChange?: (isSpeaking: boolean) => void;
  onError?: (error: Error) => void;
}

export class VoiceCallManager {
  private socket: Socket;
  private roomId: string;
  private callbacks: VoiceCallManagerCallbacks;

  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private candidateQueues: Map<string, RTCIceCandidateInit[]> = new Map();
  private audioElements: Map<string, HTMLAudioElement> = new Map();

  private isMuted: boolean = false;
  private isDeafened: boolean = false;

  // Audio analysis for speaking detection
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private speakingCheckInterval: NodeJS.Timeout | null = null;
  private isSpeaking: boolean = false;
  private silenceTimer: NodeJS.Timeout | null = null;

  constructor(socket: Socket, roomId: string, callbacks: VoiceCallManagerCallbacks) {
    this.socket = socket;
    this.roomId = roomId;
    this.callbacks = callbacks;
  }

  public isInVoice(): boolean {
    return this.localStream !== null;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsDeafened(): boolean {
    return this.isDeafened;
  }

  /**
   * Start local mic and initiate voice mesh connections to existing voice peers
   */
  public async joinVoice(existingVoiceSocketIds: string[]): Promise<MediaStream> {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const isHttp =
        typeof window !== "undefined" &&
        window.location.protocol === "http:" &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1";

      const message = isHttp
        ? "Microphone access requires a secure connection (HTTPS) when accessed over a local network on mobile. In production (HTTPS), this works automatically."
        : "Microphone access is not supported or was blocked by this browser/device.";

      const err = new Error(message);
      this.callbacks.onError?.(err);
      throw err;
    }

    try {
      // Pre-unlock audio on user gesture for iOS Safari
      try {
        const dummyAudio = new Audio();
        dummyAudio.play().catch(() => {});
      } catch {}

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.localStream = stream;
      this.callbacks.onLocalStream?.(stream);

      // Start local speaking energy detector
      this.setupSpeakingDetector(stream);

      // Tell the server we joined voice
      this.socket.emit("voice_join", { roomId: this.roomId });

      // Connect to each existing peer deterministically
      const targetPeers = existingVoiceSocketIds.filter((id) => id !== this.socket.id);
      for (const targetSocketId of targetPeers) {
        await this.connectToPeer(targetSocketId);
      }

      return stream;
    } catch (err: unknown) {
      console.error("[VoiceCallManager] Failed to access microphone:", err);
      const error = err instanceof Error ? err : new Error("Could not access microphone");
      this.callbacks.onError?.(error);
      throw error;
    }
  }

  /**
   * Disconnect from voice channel and stop microphone
   */
  public leaveVoice(): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit("voice_leave", { roomId: this.roomId });
    }

    this.cleanupLocalStream();
    this.cleanupConnections();
  }

  /**
   * Toggle or set microphone mute state
   */
  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }

    if (muted && this.isSpeaking) {
      this.isSpeaking = false;
      this.callbacks.onSpeakingChange?.(false);
    }

    if (this.socket && this.socket.connected) {
      this.socket.emit("voice_state_update", {
        roomId: this.roomId,
        isMuted: this.isMuted,
        isSpeaking: false,
      });
    }
  }

  /**
   * Toggle or set deafened state (mutes incoming audio, and also mutes mic)
   */
  public setDeafened(deafened: boolean): void {
    this.isDeafened = deafened;

    // Mute/unmute all remote audio elements
    this.audioElements.forEach((audio) => {
      audio.muted = deafened;
    });

    // If deafened, automatically mute local microphone as well
    if (deafened && !this.isMuted) {
      this.setMuted(true);
    }
  }

  /**
   * Handle incoming WebRTC signaling message for voice
   */
  public async handleVoiceSignal(
    fromSocketId: string,
    signal: unknown
  ): Promise<void> {
    if (!this.localStream || !signal) return;

    const sig = signal as Record<string, any>;

    // 1. Process SDP Offer / Answer
    const sdp = (sig.sdp || (sig.type === "offer" || sig.type === "answer" ? sig : null)) as RTCSessionDescriptionInit | null;
    if (sdp && sdp.type) {
      if (sdp.type === "offer") {
        await this.handleOffer(fromSocketId, sdp);
      } else if (sdp.type === "answer") {
        await this.handleAnswer(fromSocketId, sdp);
      }
      return;
    }

    // 2. Process ICE Candidate
    const rawCandidate = sig.candidate || (sig.type === "candidate" ? sig : null);
    if (rawCandidate) {
      const candidateInit: RTCIceCandidateInit =
        typeof rawCandidate === "object" && "candidate" in rawCandidate
          ? (rawCandidate as RTCIceCandidateInit)
          : (sig as RTCIceCandidateInit);

      if (candidateInit && candidateInit.candidate !== undefined) {
        await this.handleCandidate(fromSocketId, candidateInit);
      }
    }
  }

  /**
   * Connect to a peer deterministically to prevent WebRTC glare / simultaneous offer collisions.
   * Between peer A and peer B, only the peer with the lexicographically smaller socket ID creates the offer.
   */
  public async connectToPeer(targetSocketId: string): Promise<void> {
    if (!this.localStream || targetSocketId === this.socket.id) return;
    if (this.peerConnections.has(targetSocketId)) return;

    const myId = this.socket.id || "";
    const isOfferer = myId < targetSocketId;
    if (isOfferer) {
      await this.initiateOffer(targetSocketId);
    } else {
      // Pre-create RTCPeerConnection so it's ready when the offer arrives
      this.createPeerConnection(targetSocketId);
    }
  }

  /**
   * Called when a new peer joins voice while we are already in voice
   */
  public async addPeer(targetSocketId: string): Promise<void> {
    await this.connectToPeer(targetSocketId);
  }

  /**
   * Remove a peer connection when they leave voice or disconnect
   */
  public removePeer(socketId: string): void {
    const pc = this.peerConnections.get(socketId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(socketId);
    }

    this.candidateQueues.delete(socketId);

    const audio = this.audioElements.get(socketId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      this.audioElements.delete(socketId);
    }
  }

  // ---------------------------------------------------------------------------
  // Internal WebRTC Handshake Helpers
  // ---------------------------------------------------------------------------

  private createPeerConnection(targetSocketId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection(RTC_CONFIGURATION);
    this.peerConnections.set(targetSocketId, pc);

    // Add local mic tracks
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
        pc.addTrack(track, this.localStream!);
      });
    }

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket.connected) {
        this.socket.emit("voice_signal", {
          toSocketId: targetSocketId,
          signal: {
            type: "candidate",
            candidate: event.candidate.toJSON(),
          },
        });
      }
    };

    // Remote audio track received
    pc.ontrack = (event) => {
      console.log(`[VoiceCallManager] Track received from ${targetSocketId}`);
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      this.playRemoteStream(targetSocketId, remoteStream);
      this.callbacks.onRemoteStream?.(targetSocketId, remoteStream);
    };

    pc.onconnectionstatechange = () => {
      console.log(`[VoiceCallManager] Connection to ${targetSocketId} state: ${pc.connectionState}`);
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.removePeer(targetSocketId);
      }
    };

    return pc;
  }

  private async initiateOffer(targetSocketId: string): Promise<void> {
    try {
      const pc = this.peerConnections.get(targetSocketId) || this.createPeerConnection(targetSocketId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);

      this.socket.emit("voice_signal", {
        toSocketId: targetSocketId,
        signal: {
          type: "offer",
          sdp: offer,
        },
      });
    } catch (err) {
      console.error(`[VoiceCallManager] Failed to create offer to ${targetSocketId}:`, err);
    }
  }

  private async handleOffer(fromSocketId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      let pc = this.peerConnections.get(fromSocketId);
      if (!pc || pc.signalingState === "closed") {
        pc = this.createPeerConnection(fromSocketId);
      }

      // Handle glare: if we also made an offer, rollback our local offer to accept the incoming offer
      if (pc.signalingState !== "stable") {
        try {
          await pc.setLocalDescription({ type: "rollback" });
        } catch {}
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Flush queued candidates
      const queue = this.candidateQueues.get(fromSocketId) || [];
      while (queue.length > 0) {
        const c = queue.shift();
        if (c) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.socket.emit("voice_signal", {
        toSocketId: fromSocketId,
        signal: {
          type: "answer",
          sdp: answer,
        },
      });
    } catch (err) {
      console.error(`[VoiceCallManager] Failed to handle offer from ${fromSocketId}:`, err);
    }
  }

  private async handleAnswer(fromSocketId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    try {
      const pc = this.peerConnections.get(fromSocketId);
      if (!pc || pc.signalingState === "closed") return;

      await pc.setRemoteDescription(new RTCSessionDescription(answer));

      const queue = this.candidateQueues.get(fromSocketId) || [];
      while (queue.length > 0) {
        const c = queue.shift();
        if (c) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
    } catch (err) {
      console.error(`[VoiceCallManager] Failed to handle answer from ${fromSocketId}:`, err);
    }
  }

  private async handleCandidate(fromSocketId: string, candidateInit: RTCIceCandidateInit): Promise<void> {
    const pc = this.peerConnections.get(fromSocketId);
    if (!pc || !pc.remoteDescription) {
      if (!this.candidateQueues.has(fromSocketId)) {
        this.candidateQueues.set(fromSocketId, []);
      }
      this.candidateQueues.get(fromSocketId)!.push(candidateInit);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
    } catch (err) {
      console.warn(`[VoiceCallManager] Failed to add ICE candidate from ${fromSocketId}:`, err);
    }
  }

  private playRemoteStream(socketId: string, stream: MediaStream): void {
    let audio = this.audioElements.get(socketId);
    if (!audio) {
      audio = document.createElement("audio");
      audio.autoplay = true;
      audio.setAttribute("playsinline", "true");
      audio.muted = this.isDeafened;
      audio.style.display = "none";
      // Crucial for iOS Safari & WebKit: detached audio elements are muted by Safari policy
      document.body.appendChild(audio);
      this.audioElements.set(socketId, audio);
    }

    audio.srcObject = stream;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn(`[VoiceCallManager] Autoplay prevented for peer ${socketId}:`, err);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Speaking Energy Detector
  // ---------------------------------------------------------------------------

  private setupSpeakingDetector(stream: MediaStream): void {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.2;

      this.micSource = this.audioContext.createMediaStreamSource(stream);
      this.micSource.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!this.analyser || this.isMuted) {
          if (this.isSpeaking) {
            this.setSpeakingState(false);
          }
          return;
        }

        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        // Energy threshold for speech detection
        const SPEAKING_THRESHOLD = 18;

        if (average > SPEAKING_THRESHOLD) {
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
          if (!this.isSpeaking) {
            this.setSpeakingState(true);
          }
        } else if (this.isSpeaking && !this.silenceTimer) {
          // Debounce silence for 350ms to prevent flickering
          this.silenceTimer = setTimeout(() => {
            this.silenceTimer = null;
            this.setSpeakingState(false);
          }, 350);
        }
      };

      this.speakingCheckInterval = setInterval(checkVolume, 100);
    } catch (e) {
      console.warn("[VoiceCallManager] Could not initialize speaking detector:", e);
    }
  }

  private setSpeakingState(speaking: boolean): void {
    this.isSpeaking = speaking;
    this.callbacks.onSpeakingChange?.(speaking);

    if (this.socket && this.socket.connected) {
      this.socket.emit("voice_state_update", {
        roomId: this.roomId,
        isSpeaking: speaking,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  private cleanupLocalStream(): void {
    if (this.speakingCheckInterval) {
      clearInterval(this.speakingCheckInterval);
      this.speakingCheckInterval = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {}
      this.micSource = null;
    }

    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {}
      this.analyser = null;
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.isSpeaking = false;
    this.isMuted = false;
    this.isDeafened = false;
  }

  private cleanupConnections(): void {
    this.peerConnections.forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });
    this.peerConnections.clear();
    this.candidateQueues.clear();

    this.audioElements.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });
    this.audioElements.clear();
  }

  public destroy(): void {
    this.leaveVoice();
  }
}
