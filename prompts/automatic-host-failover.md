# Implementation Prompt: Automatic Host Failover on Departure

## Goal
When the room host leaves or navigates away and remains disconnected past the 3-second grace period, automatically promote the next remaining participant to Host so that the remaining user(s) get full host access:
1. Promote the earliest remaining peer in `room.peers` to `room.hostId`.
2. Broadcast the host failover event to the room via `host_status`, `sync_state`, and `room_participants`.
3. Update the promoted user's client state:
   - Control bar badge switches to green **`Host`**.
   - Header badge shows **`Host`**.
   - **`+ Add video`** button and modal are fully accessible and authorized to change the room's video.
   - Authoritative room playback controls (Play, Pause, Scrubber seeking) are granted to the new host.
4. Update the room's persistent record in MongoDB via `PATCH /api/rooms/[code]` with `{ newHostId }` so the database reflects the new host.

---

## Skills Read & Inspected
- `AGENTS.md`: Section 5 (realtime server vs web boundary, server authoritative state), Section 7 (host authority), Section 9 (sync protocol and message types), Section 10 (checks to run).
- Socket.io and Next.js client component patterns in `app/room/[code]/page.tsx`, `server/index.ts`, and `app/api/rooms/[code]/route.ts`.

---

## Code Inspected
- `server/index.ts`: Disconnect handler (lines 485-530). Currently, it sets a 3s timeout to emit `host_status: { isHostOnline: false }` but does not promote the remaining participants.
- `app/api/rooms/[code]/route.ts`: PATCH route currently only updates `video` and strictly guards `if (userId && room.hostId && room.hostId !== userId) return 403`. Needs to support `newHostId` update and authorize the promoted host.
- `app/room/[code]/page.tsx`: Tracks `liveHostId`, computes `isHost = currentUser.userId === effectiveHostId`, and restricts video modification (`handleSelectSource`) and room sync actions to `isHost`.

---

## Decisions and Assumptions
1. **Grace Period**: 3 seconds. If the host reloads or reconnects within 3 seconds, no failover occurs.
2. **Promotion Order**: The oldest connected peer in `room.peers` (first in Map iteration order) is selected as the new host.
3. **Dual Host-Status Handling**:
   - If other users remain in the room: Promote `remainingPeers[0]`, update `room.hostId`, and broadcast `host_status: { isHostOnline: true, hostId: newHost.userId }` alongside updated `sync_state` and `room_participants`.
   - If no users remain: Declare the room host-less (`isHostOnline: false`).
4. **Database Authorization**: Support `{ newHostId }` in `PATCH /api/rooms/[code]` so the promoted host can persist their role and update videos without 403 errors.

---

## Files to Touch
1. `server/index.ts`
   - In `disconnect` handler: when `departingPeer.userId === room.hostId`, if `isHostOnline(room)` is false after 3 seconds:
     - Check `remainingPeers = Array.from(room.peers.values())`.
     - If `remainingPeers.length > 0`:
       - Select `newHost = remainingPeers[0]`.
       - Assign `room.hostId = newHost.userId`.
       - Broadcast `host_status: { isHostOnline: true, hostId: newHost.userId }`.
       - Broadcast `sync_state: { ... hostId: newHost.userId, isHostOnline: true }`.
       - Broadcast `room_participants` with updated `hostId`.
2. `app/api/rooms/[code]/route.ts`
   - In `PATCH`: accept optional `newHostId`.
   - If `newHostId` is provided, update `room.hostId = newHostId`.
   - Authorize video update if `userId === room.hostId || userId === newHostId`.
3. `app/room/[code]/page.tsx`
   - In `handleHostStatus`: when `payload.isHostOnline && payload.hostId`:
     - Update `setLiveHostId(payload.hostId)`.
     - If `payload.hostId === currentUser?.userId`:
       - Set `setSyncStatus("synced")`.
       - Send a `PATCH /api/rooms/${code}` with `{ newHostId: currentUser.userId }` to sync database state.

---

## Security & Architectural Considerations
- Preserves the host-authoritative rule: There is always exactly ONE host at any given time.
- The browser never computes who the new host is locally; the server decides and broadcasts to all clients.
- Prevents abandoned rooms where guests are permanently locked out of video controls.

---

## Acceptance Criteria
1. When Host (Tab A) navigates away from the room, after 3 seconds, Guest (Tab B) is automatically promoted to Host.
2. Guest's UI updates: badge changes to green **`Host`**, and header displays the **`Host`** tag.
3. The newly promoted Host can click **`+ Add video`**, enter a new YouTube link, and the video loads and syncs without any 403 or permission errors.
4. The newly promoted Host has full playback controls (Play, Pause, Scrubber Seek) controlling the room.
5. All automated checks (`npx tsc --noEmit` and build) pass with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit` to verify type checks across all modules.
- `curl.exe` tests to verify `GET` and `PATCH /api/rooms/[code]`.

### Manual Test Steps
1. In Tab A (`Guest 5205`), create a room (e.g. `/room/TEST01`).
2. In Tab B (`Guest 5952`), join the room `/room/TEST01`. Tab A shows `Host`, Tab B shows `Synced`.
3. In Tab A, navigate away to `/` or another room.
4. Observe Tab B: after 3 seconds, the badge in Tab B turns green and reads **`Host`**.
5. In Tab B, click **`+ Add video`**, paste a YouTube link (`https://www.youtube.com/watch?v=VXQh4PGxLn8`), and click Save.
6. Verify the video loads and Tab B can play/pause/seek with full host privileges.
