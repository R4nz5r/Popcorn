# Implementation Prompt: Fix Playback Sync Stall & Remote Play Propagation

## 1. Goal
Fix the playback synchronization issue where remote peers (e.g. the left browser tab) fail to play video when the host plays in the right tab, yet update their video frame when the host pauses:
1. Fix the execution order of `seekTo` and `play`: ensure seek operations do not cancel pending `playVideo()` calls on YouTube's player.
2. Ensure `handleAdapterReady` applies pending playback state and seeks to current room time when a YouTube player finishes mounting after room sync state has already arrived.
3. Replace the race-prone 300ms `isRemoteUpdateRef` timer with intent-based tracking (`desiredPlayStateRef`), preventing peer state bounce and recursive pause/play emission loops.
4. Handle browser autoplay restrictions gracefully: if unmuted autoplay is blocked by browser policy before first interaction, fall back to muted playback or sync on user document click so video never stalls.
5. Ensure video switching in `YouTubePlayer.tsx` plays automatically when the room is in playing state (`loadVideoById` / `playVideo` after cue).

---

## 2. Skills & References Read
- `AGENTS.md`:
  - Section 1: "Everyone who joins sees the same video, at the same playback position, at the same time — play, pause, and seek by any participant apply to everyone."
  - Section 7: Host-authoritative synchronization, graduated drift correction.
  - Section 9: Sync protocol and player abstraction.
- YouTube IFrame Player API Documentation:
  - `seekTo(seconds, allowSeekAhead)`: "If the player is paused when the function is called, it remains paused."
  - `playVideo()`: Asynchronous operation requiring user activation for unmuted playback.
  - `loadVideoById(videoId, startSeconds)` vs `cueVideoById(videoId, startSeconds)`.

---

## 3. Code Inspected
- `app/room/[code]/page.tsx`:
  - `handleSyncState`: called `play()` and immediately called `applyGraduatedCorrection(targetTime)` which called `seekTo()`. Because the player was paused, calling `seekTo` cancelled playback and kept the player paused.
  - `handleAdapterReady`: only set `playerAdapterRef.current = adapter` without checking if the room was already playing or had a pending seek position.
  - `onStateChange`: used arbitrary `setTimeout(..., 300)` for `isRemoteUpdateRef` which expired before YouTube finished buffering, causing peers to emit counter-events.
- `components/player/YouTubePlayer.tsx`:
  - `adapter.seekTo`: called `playerRef.current.seekTo(seconds, true)` without checking if the player was supposed to continue playing.
  - `adapter.play`: lacked fallback handling if browser autoplay restrictions blocked unmuted playback.
  - Video change branch used `cueVideoById` unconditionally, pausing playback during source transitions.

---

## 4. Decisions and Assumptions
1. **Seek-Before-Play Execution in `handleSyncState`**:
   - Calculate target media time first.
   - If drift > 2.0s, seek to `targetTime` first.
   - Then, if `state.isPlaying` is true, invoke `play()`.
   - In `YouTubePlayer.tsx`, if `adapter.seekTo(time)` is called while `isPlaying` is true, ensure `playVideo()` is called so YouTube does not stay frozen in paused state.
2. **Pending Sync State for Late-Mounted Players**:
   - Store `pendingSyncRef = useRef<{ isPlaying: boolean; targetTime: number } | null>(null)`.
   - In `handleAdapterReady`, if `pendingSyncRef.current` exists (or if `isPlaying` is true):
     - Seek to `targetTime` or `currentTime`.
     - If playing, start playback immediately.
     - Clear `pendingSyncRef.current`.
3. **Intent-Based Echo Prevention (`desiredPlayStateRef`)**:
   - Maintain `desiredPlayStateRef = useRef<boolean>(false)`.
   - When receiving remote `sync_state`, update `desiredPlayStateRef.current = state.isPlaying`.
   - In `onStateChange(playing)`:
     - If `playing === desiredPlayStateRef.current`, this is the confirmation of a remote sync state. Do not emit socket events.
     - If `playing !== desiredPlayStateRef.current`, this is a local user interaction (e.g. user clicked directly on YouTube's player). Update `desiredPlayStateRef.current = playing` and emit `play` or `pause` to the socket.
4. **Browser Autoplay & Audio Fallback**:
   - When `play()` is called remotely, if Chrome blocks unmuted playback due to autoplay policy:
     - Fall back to muted playback (`player.mute(); player.playVideo()`) so video stays synced visually.
     - Add document-level interaction listener (`window.addEventListener('click', ...)`) to unmute once the user clicks anywhere in the tab.
5. **Video Source Switching (`loadVideoById`)**:
   - In `YouTubePlayer.tsx`, if the player is ready and a new video is cued while playing, call `loadVideoById` or call `playVideo()` after cueing.

---

## 5. Files Expected to Touch
- `components/player/YouTubePlayer.tsx` (MODIFY: enhance adapter `seekTo` and `play` to handle autoplay and maintain playback)
- `app/room/[code]/page.tsx` (MODIFY: correct sync order, handle pending sync on adapter ready, replace timer with intent tracking)

---

## 6. Requirements
- When Host clicks Play in one tab, all connected peer tabs immediately start playing the video.
- When Host clicks Pause in one tab, all connected peer tabs pause at the same media time.
- When Host seeks, peer tabs seek and continue playing if the room is playing.
- Late-joining peers or newly mounted players immediately catch up to the current room time and play state.
- Zero TypeScript errors (`npx tsc --noEmit`).
- Zero ESLint errors (`npm run lint`).
- Successful build (`npm run build`).

---

## 7. Security Considerations
- Validate timestamps and state payloads before applying to player.
- Sanitize video IDs to valid alphanumeric strings.

---

## 8. Acceptance Criteria
- [ ] Left tab automatically plays when right tab plays.
- [ ] Left tab pauses when right tab pauses.
- [ ] Left tab seeks and updates video frame when right tab seeks.
- [ ] Peer joining an already playing room catches up and begins playing automatically.
- [ ] `npx tsc --noEmit` passes with 0 errors.
- [ ] `npm run lint` passes with 0 errors.
- [ ] `npm run build` succeeds without errors.

---

## 9. Checks to Run
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- Manual two-tab test verifying play, pause, and seek synchronization.

---

## 10. Exact Manual Test Steps
1. Keep the realtime server running (`npm run server:dev`).
2. Open Tab 1 at `http://localhost:3000/room/[code]`.
3. Open Tab 2 in Incognito mode at the same URL `http://localhost:3000/room/[code]`.
4. In Tab 1, select or paste a YouTube video and click Play.
5. Observe Tab 2: video starts playing automatically, and timer advances in sync with Tab 1.
6. In Tab 1, click Pause: observe Tab 2 pauses immediately at the matching timestamp.
7. In Tab 1, drag scrubber to seek: observe Tab 2 seeks to the new timestamp.
8. In Tab 1, click Play again: observe Tab 2 resumes playback seamlessly.
