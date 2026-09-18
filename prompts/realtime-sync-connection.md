# Implementation Prompt: Realtime Sync & Socket.io Integration

## 1. Goal
Connect the watch room UI in `app/room/[code]/page.tsx` to the realtime server using `socket.io-client`, and provide a standalone Socket.io realtime server in `server/index.ts` so users can watch in real-time sync:
1. Establish a resilient Socket.io connection on room load with lifecycle handling (connect, reconnect, disconnect).
2. On mount, emit `join_room` with room code, user ID, and anonymous profile data.
3. Wire the `PlayerAdapter`'s play, pause, and seek actions to emit socket events (`play`, `pause`, `seek`) instead of updating only local component state.
4. Host client periodically emits `heartbeat` (~2s) with current media time.
5. Listen for `sync_state` and `correction` events from the server and apply them to the player using graduated drift correction (below 300ms do nothing, 300ms–2s playback rate nudge, >2s hard seek).
6. Prevent event echo loops between local player updates and remote socket broadcasts.
7. Make the "Synced" badge in `PlaybackControls` dynamically reflect real connection and sync status (`Synced`, `Syncing...`, `Disconnected`).
8. Route chat messages through the socket's `chat_message` event so all participants in the room receive real-time chat broadcasts.
9. Implement a standalone Socket.io server in `server/index.ts` with host-authoritative room state management, broadcast synchronization, and graduated correction dispatch.

---

## 2. Skills & References Read
- `AGENTS.md`:
  - Section 1: "Everyone who joins sees the same video, at the same playback position, at the same time — play, pause, and seek by any participant apply to everyone. A chat panel sits alongside the video for real-time reactions."
  - Section 5: "The project is split into independently deployable pieces... Web (Next.js, App Router)... Realtime server (Socket.io, long-running process): owns room sync state, broadcasts play/pause/seek/heartbeat messages, and talks to Redis for cross-instance room state."
  - Section 7: "Sync is host-authoritative, not consensus-based. One client per room is the clock source; everyone else's player is corrected against it... Drift correction is graduated: below ~300ms do nothing; 300ms–2s nudge via playbackRate; above 2s hard seek... Buffering pauses the room, not just the buffering client."
  - Section 9: Sync protocol definition (`play`, `pause`, `seek`, `heartbeat`, `sync_state`, `correction`, `chat_message`).
  - Section 10: Checks to run (typecheck, lint, build, manual multi-tab sync test).
- `node_modules/next/dist/docs/`: Client component boundaries, React 19 hooks (`use`, `useRef`, `useEffect`).
- Socket.io v4 documentation for client & server event multiplexing and rooms.

---

## 3. Code Inspected
- `app/room/[code]/page.tsx`: Existing room page with local playback and chat state.
- `lib/player/types.ts`: `PlayerAdapter` interface (to be extended with `setPlaybackRate` / `getPlaybackRate`).
- `components/player/YouTubePlayer.tsx`: Player adapter implementation wrapping YT IFrame API.
- `components/player/PlaybackControls.tsx`: Playback bar with static "Synced" pill badge.
- `components/chat/ChatPanel.tsx`: Chat panel with local-only state array.
- `components/room/ParticipantList.tsx`: Participant avatar list.
- `lib/identity.ts`: Anonymous user identification helper.

---

## 4. Decisions and Assumptions
1. **Dependencies**:
   - Client: Install `socket.io-client`.
   - Server: Install `socket.io` and `tsx` (for running the standalone TypeScript server in development).
2. **Environment Variable Configuration**:
   - Define `NEXT_PUBLIC_SOCKET_URL` in `.env.example` and `.env.local` defaulting to `http://localhost:3001`.
3. **Player Adapter Enhancement (`lib/player/types.ts` & `YouTubePlayer.tsx`)**:
   - Add optional `setPlaybackRate?(rate: number): void` and `getPlaybackRate?(): number` to `PlayerAdapter`.
   - Implement them in `YouTubePlayer.tsx` using `playerRef.current.setPlaybackRate(rate)` and `playerRef.current.getPlaybackRate()`.
4. **Graduated Drift Correction Implementation**:
   - Calculate drift: `drift = Math.abs(targetMediaTime - currentLocalTime)`.
   - Below 300ms (`< 0.3s`): Considered in-sync; no player correction applied.
   - Between 300ms and 2s (`0.3s <= drift <= 2.0s`):
     - If client is behind (`targetMediaTime > currentLocalTime`), temporarily set playback rate to `1.1` (or `1.15`).
     - If client is ahead (`targetMediaTime < currentLocalTime`), temporarily set playback rate to `0.9` (or `0.85`).
     - Reset playback rate back to `1.0` after 2.5s.
     - Set status to "Syncing..." during the rate adjustment.
   - Above 2s (`drift > 2.0s`):
     - Hard seek via `playerAdapterRef.current.seekTo(targetMediaTime)`.
     - Update local scrubber and counter.
5. **Feedback Loop Prevention**:
   - Use `isRemoteUpdateRef = useRef(false)`.
   - When receiving `sync_state` or `correction`, set `isRemoteUpdateRef.current = true` before mutating player playback state, resetting it on the next tick so player event listeners don't re-emit the action to the socket.
6. **Host Authoritative Heartbeat**:
   - If `isHost` and `isPlaying`, emit `heartbeat` with `{ roomId: code, mediaTime: currentTime, timestamp: Date.now() }` every 2000ms.
7. **Connection & Sync Status**:
   - States: `"synced"` | `"syncing"` | `"disconnected"`.
   - `PlaybackControls.tsx` will accept `syncStatus: "synced" | "syncing" | "disconnected"` (while maintaining `isSynced?: boolean` compatibility).
   - "Synced": Green badge (`bg-[#cbf3bb] text-[#1b4317]`).
   - "Syncing...": Amber badge (`bg-amber-100 text-amber-800`).
   - "Disconnected": Neutral/gray badge (`bg-neutral-200 text-neutral-600`).
8. **Realtime Chat Routing**:
   - Extend `ChatPanel` to support `messages: ChatMessage[]` and `onSendMessage: (text: string) => void`.
   - Client emits `chat_message` with `{ roomId: code, message: { id, sender, text, timestamp } }`.
   - Server broadcasts `chat_message` to all clients in the room.
9. **Standalone Realtime Server (`server/index.ts`)**:
   - Long-running HTTP + Socket.io process listening on port 3001.
   - Handles `join_room`, `play`, `pause`, `seek`, `heartbeat`, `buffering`, `chat_message`, and `disconnect`.
   - Manages in-memory room playback state (`mediaTime`, `isPlaying`, `lastUpdated`, `hostId`, `peers`).
   - Computes peer drift and sends targeted `correction` events when non-host peers fall out of sync.
   - Adds script `"server:dev": "tsx server/index.ts"` to `package.json`.

---

## 5. Files Expected to Touch
- `package.json` (MODIFY: add `socket.io-client`, `socket.io`, `tsx` dependencies and `server:dev` script)
- `.env.example` (MODIFY: add `NEXT_PUBLIC_SOCKET_URL`)
- `.env.local` (MODIFY: add `NEXT_PUBLIC_SOCKET_URL=http://localhost:3001`)
- `lib/player/types.ts` (MODIFY: add playback rate methods to `PlayerAdapter`)
- `components/player/YouTubePlayer.tsx` (MODIFY: implement `setPlaybackRate` / `getPlaybackRate` in adapter)
- `components/player/PlaybackControls.tsx` (MODIFY: support `syncStatus: "synced" | "syncing" | "disconnected"`)
- `components/chat/ChatPanel.tsx` (MODIFY: support controlled `messages` and `onSendMessage` props)
- `server/index.ts` (NEW: standalone Socket.io sync server implementing AGENTS.md sync protocol)
- `lib/socket.ts` (NEW: client Socket.io helper and connection factory)
- `app/room/[code]/page.tsx` (MODIFY: connect to socket, handle sync state, wire playback actions, route chat)

---

## 6. Requirements
- Next.js client connects to Socket.io realtime server at `NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"`.
- Room page emits `join_room` on mount with `{ roomId, userId, user }`.
- User interactions (play, pause, seek) emit corresponding events to server.
- Incoming `sync_state` updates playback state without infinite echo loops.
- Graduated drift correction enforces:
  - `< 300ms`: no action
  - `300ms – 2s`: `playbackRate` nudge (`1.1` or `0.9`)
  - `> 2s`: hard seek
- Host emits `heartbeat` every 2s during playback.
- "Synced" badge accurately reflects `"synced"`, `"syncing..."`, or `"disconnected"`.
- Chat messages are broadcast via `chat_message` and display on all connected peer clients.
- Standalone Socket.io server runs cleanly and independently via `npm run server:dev`.
- Multi-tab synchronization verified.
- `npx tsc --noEmit` and `npm run lint` pass with 0 errors.

---

## 7. Security Considerations
- Validate event payloads on server (sanitize string inputs, validate numeric timestamps and media times).
- Scope events strictly by `roomId` to prevent cross-room message leaks.
- Sanitize chat message text before rendering to prevent XSS.

---

## 8. Acceptance Criteria
- [ ] `socket.io-client` installed and connected on room mount.
- [ ] Standalone Socket.io server created in `server/index.ts` and runnable via `npm run server:dev`.
- [ ] `join_room` emitted on room page load with room code and user ID.
- [ ] Play, pause, and seek actions emit socket events to the server.
- [ ] `sync_state` and `correction` events received and applied to the YouTube player.
- [ ] Graduated drift correction active (rate adjustment for 300ms–2s, hard seek for >2s).
- [ ] Host sends regular heartbeats (~2s) when playing.
- [ ] "Synced" badge dynamically displays connection/sync state (`Synced`, `Syncing...`, `Disconnected`).
- [ ] Chat messages sent through socket `chat_message` and broadcast to all room peers.
- [ ] Multi-tab test confirms play/pause/seek and chat synchronize in real time.
- [ ] `npx tsc --noEmit` passes with 0 errors.
- [ ] `npm run lint` passes with 0 errors.
- [ ] `npm run build` succeeds without errors.

---

## 9. Checks to Run
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- Multi-tab manual sync verification (two browser tabs in the same room)

---

## 10. Exact Manual Test Steps
1. Start the realtime server in a terminal: `npm run server:dev`.
2. Start the web app in another terminal: `npm run dev`.
3. Open Tab 1 at `http://localhost:3000` and create a room.
4. In Tab 1, verify the "Synced" badge shows "Synced" (green pill).
5. Open Tab 2 in an incognito/separate browser window with the same room URL (`http://localhost:3000/room/[code]`).
6. Verify Tab 2 connects and also displays "Synced".
7. In Tab 1, paste a YouTube link (or select the default sample video) and click Play:
   - Verify video starts playing in Tab 1.
   - Verify video automatically starts playing in Tab 2 at the same media time.
8. In Tab 2, click Pause:
   - Verify playback pauses in Tab 2.
   - Verify playback automatically pauses in Tab 1.
9. In Tab 1, scrub/seek to a different timestamp (e.g. 01:00):
   - Verify Tab 1 seeks to 01:00.
   - Verify Tab 2 seeks to 01:00.
10. Test Chat:
    - Type "Hello from Tab 1" in Tab 1 and press Enter.
    - Confirm "Hello from Tab 1" appears in real time on Tab 2.
    - Type "Reply from Tab 2" in Tab 2 and press Enter.
    - Confirm "Reply from Tab 2" appears in real time on Tab 1.
11. Test Disconnection / Status Badge:
    - Temporarily stop the realtime server or disconnect network in DevTools.
    - Verify badge changes from "Synced" to "Disconnected" or "Syncing...".
    - Restart server/reconnect and verify badge returns to "Synced".
