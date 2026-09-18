# Implementation Prompt: Fix Host Video Synchronization and Desynchronization

## 1. Goal
Fix the issue shown in the screenshot where the host has loaded and is playing a video, but the viewer screen remains stuck on the `▶ video player` placeholder with unsynced duration and cannot play:
1. **Eliminate Rogue Host Failover in `server/index.ts`**: Remove the automatic host transfer on disconnect so that refreshing or momentarily disconnecting does NOT strip host privileges from the room creator (per `AGENTS.md` Section 7).
2. **Synchronize Durable Host ID (`server/index.ts` & `page.tsx`)**: Pass the durable MongoDB `hostId` during `join_room` so the realtime server always knows the true host, preventing `[Set Video Rejected]` errors.
3. **Persist Active Video to MongoDB (`app/api/rooms/[code]/route.ts`)**: Add a `PATCH` handler to save the selected video to the database so any late joiner or refreshing peer immediately loads the active video.
4. **Ensure Peer Video Mount & Auto-Sync (`app/room/[code]/page.tsx`)**: Ensure that when `sync_state` is received with a `videoId`, the peer updates `activeVideo`, mounts the `YouTubePlayer`, seeks to the host's current time, and matches playback state.

---

## 2. Skills & References Read
- `AGENTS.md`:
  - Section 5: "Inside web, keep these responsibilities apart: Pages are mostly client components once inside a room... The sync protocol is the only channel that mutates playback state."
  - Section 7: "Host control transfer is manual in v1 — a host explicitly promotes another participant. Do not build automatic host failover unless asked."
  - Section 8: "A Room is the top-level document: a short join code, the current host's user id, a list of participant ids, and a reference to the active video."
  - Section 9: "Late joiners get a one-time sync_state message with the room's current position and play state, then enter the normal heartbeat loop."

---

## 3. Code Inspected
- `server/index.ts`:
  - Lines 461-468: Silently executed automatic host transfer on any disconnect:
    `room.hostId = nextPeer.userId;`
    When the host refreshed, the server reassigned host to the viewer.
  - Server log:
    `[Set Video Rejected] Non-host user anon_..._5205 attempted video change in KZXUHB`
    The server rejected the host's video selection because it falsely considered the viewer to be the host!
  - Lines 88-102: `join_room` initialized `room.hostId` to whichever socket joined first instead of honoring the room's durable creator from MongoDB.
- `app/room/[code]/page.tsx`:
  - `handleSelectSource` updated local state optimistically, but because the server rejected `set_video`, other peers never received the video.
- `app/api/rooms/[code]/route.ts`:
  - Only supported `GET`, missing a `PATCH` method to update `activeVideo` in the database.

---

## 4. Decisions and Assumptions
1. **Remove Automatic Host Transfer on Disconnect**:
   - In `server/index.ts`, when a peer disconnects, do NOT transfer host. If the host temporarily disconnects or refreshes, `room.hostId` remains unchanged.
2. **Durable Host Handshake in `join_room`**:
   - Client sends `roomHostId` (from `/api/rooms/[code]`) during `join_room`.
   - Server respects `roomHostId` as the authoritative host for the room.
3. **Durable Video Persistence via `PATCH /api/rooms/[code]`**:
   - When the host sets a video in `AddSourceModal`, `handleSelectSource` calls `PATCH /api/rooms/[code]` to persist `activeVideo` in MongoDB, while also emitting `set_video` over the socket.
4. **Reliable Peer Video Ingestion**:
   - In `app/room/[code]/page.tsx`, when `sync_state` brings a `videoId`, if `activeVideo?.videoId !== state.videoId`, set `activeVideo` so the `YouTubePlayer` mounts immediately on the peer screen and starts playing in sync.

---

## 5. Files Expected to Touch
- `server/index.ts` (MODIFY: remove auto-transfer on disconnect, honor durable host in `join_room`, fix `set_video` authorization)
- `app/api/rooms/[code]/route.ts` (MODIFY: add `PATCH` handler for `activeVideo`)
- `app/room/[code]/page.tsx` (MODIFY: pass `roomHostId` in `join_room`, call `PATCH` on `set_video`, mount player on `sync_state`)

---

## 6. Requirements
- The host adding a YouTube video via "+ Add video" modal sets the video on both Host and Peer simultaneously.
- The peer screen replaces `▶ video player` with the live video player and matches the host's duration and playback position.
- Refreshing the host's tab does NOT strip host status or break sync for viewers.
- Clicking "Sync to Host" on the viewer aligns the viewer with the host's playback position.
- Zero TypeScript errors (`npx tsc --noEmit`).
- Zero ESLint errors (`npm run lint`).
- Successful Next.js build (`npm run build`).

---

## 7. Security Considerations
- Validate that only the host (matching MongoDB `hostId`) can PATCH `activeVideo` or emit `set_video`.

---

## 8. Acceptance Criteria
- [ ] Host adding a video causes the video to appear on the peer screen immediately.
- [ ] Peer screen replaces the `▶ video player` placeholder with the YouTube player.
- [ ] Peer duration matches the video's actual duration (e.g. 6:00:49 instead of placeholder 1:48:00).
- [ ] Host playing/pausing propagates to the peer in lockstep.
- [ ] `npx tsc --noEmit` passes with 0 errors.
- [ ] `npm run lint` passes with 0 errors.
- [ ] `npm run build` succeeds without errors.

---

## 9. Checks to Run
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- Automated multi-client test script.

---

## 10. Exact Manual Test Steps
1. Open Host tab at `http://localhost:3000/room/[code]`.
2. Open Peer tab (Incognito) at the same URL.
3. On Host tab, click "+ Add video" and paste a YouTube URL.
4. Verify the video mounts immediately on BOTH the Host and Peer screens (the peer no longer shows the placeholder).
5. On Host tab, click Play:
   - Verify video starts playing on Host and Peer simultaneously.
   - Verify duration matches on both screens.
6. On Host tab, refresh the browser page:
   - Verify the Host remains the Host after refresh.
   - Verify video and playback sync remain intact.
