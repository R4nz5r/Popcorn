# Implementation Prompt: Fix Host Heartbeat and Native Seek Desynchronization

## 1. Goal
Fix the issue where clicking the Guest's sync button does not sync to the host, and where host seeks are only synchronized when the host happens to click Play/Pause.

---

## 2. Root Cause Analysis
1. **Heartbeat Timer Cancellation Trap (`page.tsx`)**:
   - The periodic heartbeat `useEffect` has `currentTime` in its dependency array: `[isPlaying, code, currentTime]`.
   - `currentTime` is updated every 250ms by `onTimeUpdate`.
   - Because `currentTime` changes every 250ms, the cleanup function `clearInterval(interval)` runs every 250ms, destroying the 2000ms timer before it can ever fire.
   - Consequently, the host never sent regular position updates to the server during playback.

2. **Silent Native YouTube Player Seeks**:
   - The host has `controls: 1` enabled, allowing them to scrub directly on YouTube's red progress bar.
   - YouTube's IFrame API does not provide a native `onSeek` event.
   - When the host jumped from 2:30 to 3:26 on YouTube's player, `onTimeUpdate` updated local React state `currentTime`, but never emitted a `seek` event to the realtime server.
   - Because heartbeats were also dead (Root Cause 1), the server remained stuck at 2:30.

3. **Why Guest Sync Button Failed (Picture 1)**:
   - When the guest clicked "Synced" (`request_sync`), the server responded with its recorded position (~2:30).
   - The guest was already at 2:30, computed 0 drift, and stayed at 2:30. The guest could not sync to 3:26 because the server did not know the host was at 3:26.

4. **Why Host Play/Pause Succeeded (Picture 2)**:
   - Clicking Play/Pause on the host calls `handlePlayPause()`, which explicitly reads `playerAdapter.getCurrentTime()` (3:27:04) and emits `pause` or `play` with the new timestamp to the server.
   - The server updated its state to 3:27:04 and broadcast `sync_state`, forcing the guest to jump to 3:27.

---

## 3. Proposed Fixes
1. **Fix Heartbeat Loop in `app/room/[code]/page.tsx`**:
   - Remove `currentTime` from the dependency array of the heartbeat `useEffect`: `[isPlaying, code, isHost]`.
   - Read `playerAdapterRef.current?.getCurrentTime()` directly inside the timer callback.
   - Ensure the host emits a heartbeat every 2 seconds without interruption.

2. **Detect Native YouTube Seeks in `app/room/[code]/page.tsx`**:
   - In `onTimeUpdate(curr, dur)`, track `lastTimeRef.current`.
   - If `isHost` and the delta between `curr` and expected progress exceeds 1.5 seconds (and is not a programmatic sync):
     - Emit `seek` with `roomId` and `curr` to the realtime server.
     - Broadcasts `sync_state` to all peers immediately, keeping all viewers in lockstep even when the host scrubs via YouTube's native controls.

3. **Ensure Server Updates `room.mediaTime` on Host Heartbeat**:
   - In `server/index.ts`, confirm that host heartbeats update `room.mediaTime` and `room.lastUpdated`.
   - When a guest calls `request_sync`, the server will always return the real-time position of the host.

---

## 4. Verification Plan
1. **Type Check**: `npx tsc --noEmit`
2. **Lint**: `npm run lint`
3. **Automated Multi-Client Test**:
   - Run multi-client sync script testing that host heartbeats update room position.
   - Test that `request_sync` returns the updated heartbeat position.
4. **Manual Verification**:
   - Open Host and Guest tabs.
   - Seek on Host using YouTube scrubber: observe Guest immediately seeks to match Host.
   - Click "Sync to Host" on Guest: observe Guest snaps to Host's exact position.
