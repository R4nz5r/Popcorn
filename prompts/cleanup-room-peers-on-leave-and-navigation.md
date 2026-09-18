# Implementation Prompt: Clean Up Room Peers on Navigation and Room Exit

## Goal
Immediately update the host screen and watching count when a user leaves the room (e.g. clicks the logo to go home, joins another room, navigates away, or closes the tab):
1. **Immediate Presence Update on Host Screen**:
   - If there are 2 users in the room and one leaves, the host screen immediately updates from `2 watching` to `1 watching`.
   - The departed user's avatar is removed immediately from the host's screen.
2. **"User has left" System Message in Chat**:
   - When a peer leaves, the server broadcasts a clear system chat message (e.g. `"${departingPeer.displayName} left the room"`) so participants in the room see that the user has left.
3. **Clean Socket & Room Lifecycle**:
   - When navigating away from `/room/[code]`, the client emits `leave_room`.
   - When joining a new room on the same socket, the server automatically leaves any prior room.
   - On disconnect or leave, the server cleans up the peer and immediately broadcasts `room_participants` and the departure chat notice.

---

## Skills Read & Inspected
- `AGENTS.md`:
  - Section 5: Realtime server vs web app responsibilities.
  - Section 7: Host authority and ephemeral room state.
  - Section 8: Room state & connected peers model, chat message format.
  - Section 10: Multi-tab manual tests and type checks.
- Code inspected:
  - `server/index.ts`:
    - `join_room` sets `currentRoomId = roomId` without leaving the previous room.
    - No `leave_room` event exists.
    - `disconnect` only cleaned up `currentRoomId` on TCP drop.
  - `app/room/[code]/page.tsx`:
    - `useEffect` cleanup removes listeners but never emits `leave_room`.

---

## Decisions and Assumptions
1. **Centralized Departure Handler `handlePeerLeave(socket: Socket, roomId: string)`**:
   - Removes socket from `room.peers`.
   - Emits `socket.leave(roomId)`.
   - Emits system chat message `"${departingPeer.displayName} left the room"`.
   - Immediately broadcasts updated `room_participants` so the remaining peers update from `2 watching` to `1 watching`.
   - Triggers host failover if the host left.
2. **Automatic Room Switching**:
   - If `currentRoomId && currentRoomId !== roomId`, the server calls `handlePeerLeave(socket, currentRoomId)` before joining the new room.
3. **Client Navigation Triggers**:
   - In `app/room/[code]/page.tsx`, `useEffect` cleanup and `pagehide` emit `leave_room`.

---

## Files to Touch
1. `server/index.ts`
   - Implement `handlePeerLeave(socket: Socket, roomId: string)`.
   - Broadcast system message: `{ id, sender: "System", text: "${peer.displayName} left the room", timestamp }`.
   - Handle `leave_room` socket event.
   - In `join_room`, auto-leave previous room if changing rooms.
   - In `disconnect`, clean up any room where the socket is present.
2. `app/room/[code]/page.tsx`
   - Emit `leave_room` in `useEffect` cleanup and `pagehide`.
3. `components/chat/ChatPanel.tsx`
   - Style system messages cleanly (e.g. subtle italic or muted system text matching the theme).

---

## Acceptance Criteria
1. When Host (Tab 1) and Guest (Tab 2) are in a room:
   - Host sees `2 watching` with 2 avatars.
2. When Guest navigates to `/` or another room:
   - Host screen IMMEDIATELY updates to `1 watching`.
   - Guest's avatar is removed from Host's screen.
   - Chat feed on Host's screen shows `Guest ... left the room`.
3. If Guest joins a different room, Guest sees `1 watching` in the new room, and the original room remains `1 watching`.
4. All checks (`npx tsc --noEmit` and build) pass with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit` for TypeScript type checks.
- Multi-socket test in `server/test-sync.ts`: Socket A & Socket B join room -> Socket B leaves or joins another room -> verify Socket A receives `room_participants` with 1 participant and chat message indicating B left.

### Manual Test Steps
1. Open Room 1 in Tab A (Host).
2. Open Room 1 in Tab B (Guest). Verify both show `2 watching`.
3. In Tab B, click the "Watch together" logo to navigate to `/`.
4. Observe Tab A: verify it immediately updates to `1 watching` and shows `Guest ... left the room` in the chat feed.
