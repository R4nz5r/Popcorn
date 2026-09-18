# Implementation Prompt: Replace Demo Chat and Participant Data with Actual Live Data

## Goal
Replace the mock/demo chat messages ("Tasnim: this scene is wild", "Rafi: wait rewind that") and artificial participant data ("4 watching", "RS", "TA", "+2") in the watch room UI with actual, real-time data:
1. **Real Participant Count & Avatars**:
   - Eliminate hardcoded `Math.max(participants.length, 4)` and mock avatar fallbacks (`RS`, `TA`, `+2`).
   - Display the actual count of connected peers (e.g. `1 watching`, `2 watching`, `N watching`).
   - Feed `liveParticipants: PeerUser[]` (with real `userId`, `displayName`, and `avatarColor`) into `ParticipantList`.
   - Compute real initials (e.g. "G5" for "Guest 5952", "G2" for "Guest 5205", "JD" for "John Doe", "TA" for "Tasnim") and appropriate text contrast colors.
   - Display real avatars for connected users. Only render a `+N` badge if the number of connected participants exceeds the visible slot limit (e.g. more than 3 participants).
2. **Real Chat Messages & Session History**:
   - Remove hardcoded `INITIAL_CHAT_MESSAGES` and `INITIAL_MESSAGES` demo messages.
   - Start fresh rooms with an empty chat feed `[]`.
   - Retain ephemeral in-memory session chat history in `RoomSyncState.messages` on the realtime server (up to 100 recent messages).
   - On `join_room`, deliver existing session messages to the connecting socket (`chat_history` event) so late joiners and reloaded tabs see the real session chat.
   - Render only actual messages sent by participants in the room.

---

## Skills Read & Inspected
- `AGENTS.md`:
  - Section 5: Realtime server vs Web App boundaries.
  - Section 7: Ephemeral rooms & ephemeral chat per room session.
  - Section 8: User identity model (`userId`, `displayName`, `avatarColor`) and Chat message model.
  - Section 10: Multi-tab testing and type check requirements.
- Code inspected:
  - `components/room/ParticipantList.tsx`: Currently forces `totalWatching = Math.max(participants.length, 4)` and injects mock fallback avatars `RS`, `TA`, and `+2`.
  - `components/chat/ChatPanel.tsx`: Currently seeds `INITIAL_MESSAGES` with "Tasnim" and "Rafi".
  - `app/room/[code]/page.tsx`: Currently sets initial chat state to `INITIAL_CHAT_MESSAGES` and passes only string `participantIds` rather than `PeerUser[]` objects into `ParticipantList`.
  - `server/index.ts`: Manages `room.peers`, broadcasts `room_participants` and `chat_message`, but does not retain ephemeral chat history for joining peers.
  - `lib/socket.ts`: Defines `PeerUser`, `ChatMessagePayload`, `RoomParticipantsPayload`.

---

## Decisions and Assumptions
1. **Participant List Data Source**:
   - The authoritative source for connected participants while online is `liveParticipants: PeerUser[]` from the Socket.io server.
   - If `liveParticipants` has not arrived yet (e.g. prior to socket connection), fallback to `[currentUser]` so the room always shows at least the local user (`1 watching`).
2. **Avatar Display Threshold**:
   - If total watching is 1 to 3: Render each participant's individual avatar circle (no `+N` badge).
   - If total watching is > 3: Render the first 2 avatars plus a `+${total - 2}` badge (e.g. for 4 watching, 2 avatars + `+2`, matching `design/2-watch-room.jpg`).
3. **Initials Generation**:
   - Multi-word name: Take the first character of the first word + the first character of the second word (e.g., "Guest 5952" -> "G5", "Ragib Sarwar" -> "RS").
   - Single-word name: Take the first two characters (e.g., "Tasnim" -> "TA", "Rafi" -> "RA").
   - Uppercase, trimmed, with fallback to "U".
4. **Ephemeral Room Chat Retention**:
   - In `server/index.ts`, store `messages: ChatMessagePayload[]` in `RoomSyncState`.
   - Cap history at 100 messages per room to prevent memory leaks.
   - When a peer connects (`join_room`), emit `chat_history: { messages }` so the user immediately sees all messages sent in the current session.

---

## Files to Touch
1. `components/room/ParticipantList.tsx`
   - Update `ParticipantListProps` to accept `participants?: PeerUser[]` (or `{ userId: string; displayName: string; avatarColor?: string }[]`).
   - Remove `Math.max(..., 4)` and mock avatars (`RS`, `TA`, `+2`).
   - Calculate `totalWatching = participants.length`.
   - Render actual avatars for active participants with tooltips showing their display name.
   - Conditionally render `+N` only when `totalWatching > 3`.
2. `components/chat/ChatPanel.tsx`
   - Remove `INITIAL_MESSAGES` containing mock messages.
   - Default internal messages state to `[]`.
3. `app/room/[code]/page.tsx`
   - Remove `INITIAL_CHAT_MESSAGES` constant.
   - Initialize `chatMessages` state as empty `[]`.
   - Pass `activeParticipants` (constructed from `liveParticipants`, falling back to `[currentUser]`) to `<ParticipantList>`.
   - Add listener for `chat_history` socket event to populate initial room messages from the server.
4. `server/index.ts`
   - Add `messages: ChatMessagePayload[]` to `RoomSyncState`.
   - In `join_room`: emit `chat_history` with `room.messages`.
   - In `chat_message`: append the sanitized message to `room.messages` (slicing to max 100).
5. `lib/socket.ts`
   - Export `ChatHistoryPayload` interface for type safety.

---

## Security & Architectural Considerations
- Preserves sync-only and ephemeral room design principles from `AGENTS.md`.
- No database persistence required for ephemeral chat (as specified in `AGENTS.md` Section 8).
- Message sanitization and length limits (500 chars) remain enforced on the server.
- Participant avatars strictly reflect server-tracked active sockets.

---

## Acceptance Criteria
1. When entering a room as a single user:
   - Header reads `1 watching`.
   - Exactly 1 avatar circle is shown with that user's initials and color.
   - Chat feed is clean with no dummy messages from "Tasnim" or "Rafi".
2. When a second user joins from another tab or browser:
   - Header instantly updates to `2 watching` for both users.
   - Both users' real avatars appear with their respective initials and colors (e.g. "G5" and "G2"). No "+2" or fake avatars are rendered.
3. When users send messages:
   - Messages from "Guest 5952", "Guest 5205", etc. appear in real-time with their real names.
4. When a user reloads or a late joiner connects:
   - They receive the actual participant count and the actual chat messages sent during the active session.
5. All automated checks (`npx tsc --noEmit`) pass with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit` from workspace root to verify full type safety.
- Next.js build validation if applicable.

### Manual Multi-Tab Test Steps
1. Open a new watch room in Chrome Tab 1 (User A, e.g. "Guest 5952").
2. Verify:
   - Participant list displays `1 watching` with a single avatar for Tab 1.
   - Chat feed contains 0 messages.
3. Open an Incognito window to the same room URL in Tab 2 (User B, e.g. "Guest 5205").
4. Verify:
   - Both Tab 1 and Tab 2 update to display `2 watching`.
   - Exactly 2 avatar circles appear with Tab 1's and Tab 2's actual initials/colors. No "+2" bubble exists.
5. In Tab 1, send message `"Hello from Tab 1"`. Verify it appears in both tabs.
6. In Tab 2, send message `"Hi back from Tab 2"`. Verify it appears in both tabs.
7. Refresh Tab 2:
   - Verify it rejoins cleanly, shows `2 watching`, and displays the real chat messages `"Hello from Tab 1"` and `"Hi back from Tab 2"`.
