# Implementation Prompt: Fix Host Pause Desync, 4-Second Loop, and Buffering Pop-up

## 1. Goal
Fix the issue where pausing playback on the Host screen leaves the Guest/Viewer screen playing in a continuous 4-second loop, and eliminate the recurring "Catching up to the group" buffering pop-up caused by this desync:
1. When the Host pauses, all viewers must immediately pause and stay paused at the exact timestamp.
2. Viewers must never play ahead or loop back in 4-second intervals while the host is paused.
3. The server must not issue drift corrections when the room is paused (`room.isPlaying === false`).
4. The viewer click-to-unmute action must only unmute audio, never toggle or start playback when the host is paused.
5. In `YouTubePlayer.tsx`, `seekTo` must respect `keepPlaying === false` by guaranteeing `pauseVideo()` is called.

---

## 2. Skills & References Read
- `AGENTS.md`:
  - Section 7: "Sync is host-authoritative, not consensus-based. One client per room is the clock source; everyone else's player is corrected against it."
  - Section 7: "Buffering pauses the room, not just the buffering client."
  - Section 9: Sync protocol — `play`, `pause`, `seek`, `heartbeat` message types and drift correction.
- YouTube IFrame Player API:
  - `seekTo(seconds, allowSeekAhead)` behavior when player is actively playing. Calling `seekTo` on a playing player leaves it in `PLAYING` state after buffering unless `pauseVideo()` is explicitly invoked.

---

## 3. Code Inspected
- `server/index.ts`:
  - Lines 497–515: In `socket.on("heartbeat")`, the server computes drift and emits `correction` every time the host heartbeat fires (every 4000ms when paused), even when `room.isPlaying === false`.
- `app/room/[code]/page.tsx`:
  - Line 465: `const intervalTime = isPlaying ? 2000 : 4000;` — Host emits a heartbeat every 4 seconds when paused.
  - Lines 233–259: `handleSyncState` calls `adapter.seekTo()` and then `adapter.pause()`. When YouTube seeks while playing, it enters `BUFFERING` and auto-resumes to `PLAYING`, ignoring the subsequent `pause()`.
  - Lines 295–303: `handleCorrection` hard seeks on drift > 2.0s and only calls `adapter.play()` if `desiredPlayStateRef.current` is true, but never calls `adapter.pause()` if false. Because YouTube's `seekTo()` does not pause, the player stays playing.
  - Lines 860–866: In `onStateChange`, when a viewer pauses, `isLocallyPausedRef.current` is set to `true` and is never cleared when the host pauses the room.
- `components/player/YouTubePlayer.tsx`:
  - Lines 247–262: `adapter.seekTo` only calls `playVideo()` if `keepPlaying` is true, but does nothing to ensure the player is paused if `keepPlaying` is false.
  - Lines 376–394: Viewer overlay `onClick` toggles play/pause on the video (`pauseVideo()` / `playVideo()`) instead of solely un-muting.

---

## 4. Decisions and Assumptions
1. **Server: Silence Drift Corrections When Room is Paused**:
   - In `server/index.ts`, if `!room.isPlaying`, the server must update `room.mediaTime` from host heartbeat but **skip** sending `correction` messages to peers. Drift correction is only valid during active playback.
   - When the host emits `pause`, clear any pending buffering stall timeout on the server and broadcast `buffering_state: { isBuffering: false }`.
2. **Client: Guaranteed Pause on `sync_state` (`page.tsx`)**:
   - When `state.isPlaying === false` in `handleSyncState`:
     - Immediately call `adapter.pause()` first.
     - If drift > 0.5s, seek to `targetTime` with `keepPlaying = false`.
     - Explicitly call `adapter.pause()` again after seekTo to prevent YouTube from resuming playback after the seek buffer.
     - Reset `isLocallyPausedRef.current = false` so the viewer is aligned with host state.
3. **Client: Pause Enforcement in `handleCorrection`**:
   - If `desiredPlayStateRef.current === false`, do not adjust playback rates. If a seek occurs, explicitly invoke `adapter.pause()`.
4. **Player: Safe Click-to-Unmute (`YouTubePlayer.tsx`)**:
   - When the viewer clicks the overlay to unmute, only unmute audio (`unMute()` + `setVolume(100)`). Do not toggle playback. Let sync state dictate whether video plays or stays paused.
   - In `adapter.seekTo(seconds, keepPlaying)`: If `keepPlaying === false`, explicitly call `playerRef.current.pauseVideo()`.

---

## 5. Files Expected to Touch
- `server/index.ts` (MODIFY: do not send corrections while `!room.isPlaying`, clear buffering state on pause)
- `app/room/[code]/page.tsx` (MODIFY: enforce pause before and after seeking on paused sync_state, reset isLocallyPaused on host pause)
- `components/player/YouTubePlayer.tsx` (MODIFY: viewer overlay only unmutes without toggling playback, adapter.seekTo enforces pause when keepPlaying is false)

---

## 6. Requirements
- When Host pauses playback, all Viewer windows immediately pause and remain paused.
- No 4-second playback loops or repeated seeking while paused.
- No "Catching up to the group" banner appears when the host is paused.
- Un-muting as a viewer does not accidentally start playback while the host is paused.
- Zero TypeScript errors (`npx tsc --noEmit`).
- Zero ESLint errors (`npm run lint`).
- Successful Next.js build (`npm run build`).

---

## 7. Security Considerations
- Ensure viewers cannot broadcast play/pause/seek to the room. Host authority is maintained.

---

## 8. Acceptance Criteria
- [ ] Host clicking Pause immediately stops playback on both Host and Viewer screens.
- [ ] Viewer screen stays completely paused at the exact timestamp (no 4-second loop).
- [ ] No buffering or catching-up pop-up appears on either screen during pause.
- [ ] Viewer clicking to unmute does not start playback if Host is paused.
- [ ] `npx tsc --noEmit` passes with 0 errors.
- [ ] `npm run lint` passes with 0 errors.
- [ ] `npm run build` succeeds without errors.

---

## 9. Checks to Run
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- Multi-client automated pause and sync test.

---

## 10. Exact Manual Test Steps
1. Open Host tab at `http://localhost:3000/room/[code]`.
2. Open Viewer tab (Incognito) at the same room URL.
3. On Host tab, start playback. Verify both tabs play in sync.
4. On Host tab, click Pause:
   - Verify Host video pauses immediately.
   - Verify Viewer video pauses immediately.
   - Wait 10 seconds: verify Viewer does NOT play or loop back every 4 seconds.
   - Verify no buffering pop-up appears on either screen.
5. On Host tab, click Play: verify both tabs resume playing together.
