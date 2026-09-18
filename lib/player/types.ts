export interface PlayerAdapter {
  play(): void;
  pause(): void;
  seekTo(seconds: number, keepPlaying?: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  isReady(): boolean;
  setVolume?(volume: number): void;
  getVolume?(): number;
  mute?(): void;
  unMute?(): void;
  isMuted?(): boolean;
  setPlaybackRate?(rate: number): void;
  getPlaybackRate?(): number;
}

export interface PlayerCallbacks {
  onReady?: (duration: number) => void;
  onStateChange?: (isPlaying: boolean) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onBuffering?: (isBuffering: boolean) => void;
  onError?: (error: string, code?: number) => void;
}

export type VideoSourceType = "youtube";

export interface ActiveVideoSource {
  type: VideoSourceType;
  videoId?: string; // YouTube video ID
  title?: string;
  duration?: number;
}
