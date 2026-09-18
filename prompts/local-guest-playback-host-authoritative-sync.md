# Implementation Prompt: Local Guest Playback with Host-Authoritative Room Sync

## 1. Goal
Ensure that when a Guest pauses or plays their video, it applies **locally only** to that guest (the Host's video and the rest of the room continue playing undisturbed). When a Guest pauses, their status badge displays **"Sync to Host"**, allowing them to instantly catch up to the Host whenever they are ready.

---

## 2. Skills and Documentation Referenced
- `AGENTS.md` (Section 1, Section 7: "Sync is host-authoritative, not consensus-based. One client per room is the clock source; everyone else's player is corrected against it.")
- Socket.io room and sync protocol patterns (`sync_state`, `heartbeat`, `request_sync`).

---

## 3. Code Inspected
- `app/room/[code]/page.tsx`:
  - `handlePlayPause()` currently emits `play`/`pause` to the socket for all users.
  - `onStateChange` callback in `YouTubePlayer` emits `play`/`pause` to the socket for all users.
  - `handleSyncState()` forces incoming sync states on all clients, which would prematurely unpause a locally paused guest on the next host heartbeat.
  - `handleSyncToHost()` requests sync from the server and performs an instant snap to the host's position.
- `server/index.ts`:
  - `socket.on("play")` and `socket.on("pause")` currently broadcast room-wide for any participant.
  - `socket.on("heartbeat")` accurately tracks host position.
  - `socket.on("request_sync")` returns computed media time.

---

## 4. Decisions and Assumptions
1. **Host-Authoritative Room Sync**:
   - Only the Host's `play`, `pause`, `seek`, and `set_video` events mutate room-wide state.
   - The server rejects or ignores `play` and `pause` events from non-hosts.
2. **Local Guest Play/Pause**:
   - When a guest clicks Play/Pause (or clicks the video overlay to pause/unpause), it toggles ONLY their local video player.
   - It sets `isLocallyPausedRef.current = true` when paused.
   - It marks `syncStatus = "syncing"`, rendering the interactive **"Sync to Host"** button.
3. **Preserving Local Pause State**:
   - While `isLocallyPausedRef.current` is true, incoming routine host heartbeats / drift corrections do not forcibly unpause the guest.
   - If the host loads a new video (`set_video`), the guest loads the new video and resets local pause.
4. **Catching Up ("Sync to Host")**:
   - When the guest clicks "Sync to Host", `isLocallyPausedRef.current` is cleared, `isManualSyncRequestRef.current` is set, and `request_sync` is emitted.
   - The guest's player immediately seeks to the Host's current timestamp and adopts the room's playback state.

---

## 5. Files to Touch
1. `app/room/[code]/page.tsx`:
   - Split `handlePlayPause`: host emits to socket; guest toggles local playback only and sets `isLocallyPausedRef`.
   - Update `onStateChange` in `YouTubePlayer` callbacks: host emits to socket; guest updates local state without socket broadcast.
   - In `handleSyncState`: if `!isHost && isLocallyPausedRef.current && state.isPlaying`, do not forcibly play the guest's player, but keep updating duration/video metadata.
   - In `handleSyncToHost`: clear `isLocallyPausedRef.current` and request sync.
2. `server/index.ts`:
   - Restore host-only guard on `play` and `pause` socket handlers so only the room host can alter room-wide playback.

---

## 6. Acceptance Criteria
- [x] Host clicking Pause pauses both Host and Guest.
- [x] Host clicking Play resumes both Host and Guest.
- [x] Guest clicking Pause pauses **only** the Guest's screen; Host keeps playing.
- [x] When Guest is paused, the badge shows "Sync to Host" in amber.
- [x] Clicking "Sync to Host" on the Guest screen immediately snaps the video to the Host's current time and resumes playing.
- [x] Host seeking on timeline or YouTube player seeks the entire room.
- [x] Fullscreen toggle works for both Host and Guest.

---

## 7. Checks to Run
- `npx tsc --noEmit` (TypeScript type check)
- `npm run lint` (ESLint)
- `npm run build` (Next.js production build)
- Automated multi-client test script verifying host authority and guest local behavior.

---

## 8. Manual Test Steps
1. Open room in two tabs: Left = Guest, Right = Host.
2. Start playback on Host. Observe both Host and Guest play in sync.
3. On Guest, click Pause.
4. Verify Host continues playing uninterrupted.
5. Verify Guest screen is paused and displays the "Sync to Host" button.
6. Wait 5-10 seconds while Host continues playing ahead.
7. On Guest, click "Sync to Host".
8. Verify Guest instantly seeks to Host's current timestamp and resumes synchronized playback.
