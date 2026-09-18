# Implementation Prompt: Fix Room Join and Leave Announcements and Eliminate Duplicate Departures

## Goal
Fix the chat notification issue where the chat box only shows repeated "left the room" messages (4 times for 2 join/leave cycles) and never shows when users join:
1. **Add "Joined the room" System Announcements**:
   - When a participant joins the room, broadcast a system message: `"${peer.displayName} joined the room"`.
   - Ensure late joiners or room refreshes only announce new arrivals (not re-announcing on internal re-syncs or heartbeats).
2. **Fix Duplicate "Left the room" Dispatches**:
   - Remove `room?.hostId` from the `useEffect` dependency array in `app/room/[code]/page.tsx`. Currently, when `fetchRoom()` resolves and sets `room.hostId`, the effect tears down and triggers `handleLeaveRoom()`, causing a false departure message immediately upon joining.
   - Remove redundant `socket.emit("join_room")` in `fetchRoom()` to prevent double join registrations.
   - Ensure `leave_room` is only emitted when the user genuinely navigates away from the room or closes the page.
   - Deduplicate server-side join and leave notices so only genuine membership changes trigger chat messages.

---

## Skills Read & Inspected
- `AGENTS.md`:
  - Section 5: Web vs realtime server boundaries.
  - Section 7: Ephemeral room presence and chat.
  - Section 8: User identity and chat message model.
  - Section 10: Multi-tab checks and type checking.
- Code inspected:
  - `app/room/[code]/page.tsx`:
    - Lines 118-131: `fetchRoom` emits `join_room`.
    - Line 433: `useEffect` dependencies include `room?.hostId`, triggering unmount/cleanup right after room fetch finishes, which emitted `handleLeaveRoom()` on initial load.
  - `server/index.ts`:
    - Lines 196-290: `join_room` never emitted a `"joined the room"` system chat message.
    - Lines 66-139: `handlePeerLeave` emitted `"left the room"` every time `leave_room` was called.

---

## Decisions and Assumptions
1. **Join Notification**:
   - In `server/index.ts`, check `const isNewPeer = !room.peers.has(socket.id);`.
   - If `isNewPeer`, create and emit system message `"${peer.displayName} joined the room"` and append to `room.messages`.
2. **Stable Socket Lifecycle**:
   - In `app/room/[code]/page.tsx`, use a ref for `roomHostId` so the socket `useEffect` does not unmount when `room.hostId` is fetched from MongoDB.
   - The socket lifecycle effect depends strictly on `[currentUser?.userId, code]`.
   - Remove duplicate `join_room` emit from inside `fetchRoom()`.
3. **Leave Deduplication**:
   - On the client, track `hasLeftRef = useRef(false)` so `handleLeaveRoom()` only emits `leave_room` once per unmount/exit.
   - On the server, `handlePeerLeave` checks `if (!departingPeer) return;`, ensuring no duplicate leaves are processed for the same socket.

---

## Files to Touch
1. `server/index.ts`
   - In `join_room`: check `const isNewPeer = !room.peers.has(socket.id);`.
   - If `isNewPeer`, broadcast `"${peer.displayName} joined the room"` via system chat message and save to `room.messages`.
2. `app/room/[code]/page.tsx`
   - Remove `room?.hostId` from `useEffect` dependencies.
   - Remove redundant `socket.emit("join_room")` in `fetchRoom`.
   - Add `hasLeftRef` guard to ensure `leave_room` only emits once when departing.
3. `components/chat/ChatPanel.tsx`
   - Verify system messages display cleanly for both join and leave events.

---

## Acceptance Criteria
1. When User B joins Room 1 (where User A is waiting):
   - The chat feed shows `Guest ... joined the room`.
   - Watching count updates to `2 watching`.
   - No false `Guest ... left the room` message is generated during page load.
2. When User B leaves Room 1:
   - The chat feed shows exactly one `Guest ... left the room`.
   - Watching count updates to `1 watching`.
3. Over 2 join and leave cycles:
   - Exactly 2 "joined the room" and 2 "left the room" messages are displayed, interleaved properly.
4. All checks (`npx tsc --noEmit` and build) pass with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit` to verify type safety.
- Multi-socket test in `server/test-announcements.ts` simulating 2 join/leave cycles and verifying exact count and order of system messages.

### Manual Test Steps
1. In Tab A (normal window), open a room.
2. In Tab B (incognito window), join the same room.
3. Observe Tab A's chat box: it shows `Guest ... joined the room` (NOT "left the room").
4. In Tab B, click the "Watch together" logo to leave the room.
5. Observe Tab A's chat box: it shows `Guest ... left the room` (exactly once).
6. In Tab B, re-enter the room: verify Tab A shows `Guest ... joined the room`.
7. In Tab B, leave the room: verify Tab A shows `Guest ... left the room`.
