# Implementation Prompt: Interactive Chat Timestamps & Typing Indicators

## Goal
Implement interactive video timestamps and realtime typing indicators in the chat panel of Watch Together:
1. **Clickable Chat Timestamps**: Automatically detect timestamp patterns (e.g. `1:23`, `02:45`, `1:15:30`) in chat messages and render them as interactive clickable badges. Clicking a timestamp seeks the video (Host seeks the room for everyone; Guest jumps to that point).
2. **Current Time Quick-Insert**: Provide a one-click button in the chat input area to insert the current video playback position (e.g. `[02:15]`) directly into the message text.
3. **Live Typing Indicators**: Realtime broadcast of typing activity so peers see when others are typing (e.g. *"Alex is typing..."* with animated bouncing dots) with debounced stop and automatic timeout cleanup.

---

## Skills Read & Code Inspected
- `AGENTS.md`: Section 1 (sync-only, no upload), Section 7 (host-authoritative sync, ephemeral room chat), Section 9 (sync protocol).
- `components/chat/ChatPanel.tsx`: Current chat message renderer, auto-scroll ref, mobile drawer, input forms.
- `server/index.ts`: Socket.io event dispatching, room peer tracking, sanitization.
- `app/room/[code]/page.tsx`: Room socket subscriptions, `handleSeek`, `currentTime` state, player adapter bindings.

---

## Decisions & Assumptions
1. **Timestamp Parsing**: Match `mm:ss` (`0:45`, `2:30`, `14:20`) and `hh:mm:ss` (`1:05:22`) using regular expression boundary matching. Text around the timestamp will be preserved as normal text.
2. **Host vs. Guest Timestamp Seek**:
   - If Host clicks a timestamp: triggers `handleSeek(seconds)` which seeks the entire room and broadcasts `seek` to all peers.
   - If Guest clicks a timestamp: seeks local player to allow viewing that moment without interrupting the host's authoritative stream, or syncs to it.
3. **Zero Extra Network Overhead for Typing**: Typing events are lightweight socket notifications (`typing: true/false`). Client throttles typing emits to once every 2 seconds, and server broadcasts only to others in the room (`socket.to(roomId)`).
4. **Auto-Expiry**: If a peer types and disconnects or drops, the client automatically clears their typing indicator after 3.5 seconds of inactivity.

---

## Files to Touch
- `components/chat/ChatPanel.tsx`:
  - Add regex-based timestamp parser helper function `renderMessageWithTimestamps(text, onSeek)`.
  - Style timestamp pills with warm amber accent (`text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20`).
  - Add quick timestamp insert button `+ [01:23]` inside the input form.
  - Add `typingUsers` prop and render animated typing status bar with animated bouncing dots.
  - Implement debounced `onTyping(isTyping: boolean)` trigger in input handlers.
- `server/index.ts`:
  - Add `typing` socket event handler: emits `peer_typing` with `{ userId, displayName, isTyping }` to room peers.
  - On peer disconnect/leave, broadcast `peer_typing` with `isTyping: false`.
- `app/room/[code]/page.tsx`:
  - Manage `typingUsers` state with automatic decay timer.
  - Register `peer_typing` socket listener.
  - Pass `currentTime`, `onSeekToTimestamp`, `typingUsers`, and `onTyping` to `ChatPanel`.

---

## Requirements
- Clickable timestamps must handle both `mm:ss` (e.g. `02:30`, `4:05`) and `hh:mm:ss` (e.g. `1:12:00`).
- Text surrounding timestamps in a message must render accurately without distortion or stripping emojis.
- Quick timestamp insert button must only be active when a video is loaded with valid duration/currentTime.
- Typing indicators must display accurate peer names:
  - 1 user: *"Alex is typing..."*
  - 2 users: *"Alex and Sarah are typing..."*
  - 3+ users: *"Several people are typing..."*
- Typing indicator must never display the local user's own name to themselves.
- All styles must match the existing Warm Midnight Cinema dark and light themes.

---

## Security Considerations
- Sanitize and clamp all timestamp seek targets (`Math.max(0, Math.min(duration, seconds))`).
- Ensure typing payload only forwards validated `userId` and `displayName` from the server's authenticated peer session, never arbitrary client strings.
- Throttled typing prevents socket flooding.

---

## Acceptance Criteria
- [ ] Typing a message containing `01:15` renders `01:15` as a styled clickable button.
- [ ] Clicking `01:15` seeks the player to 75 seconds.
- [ ] Clicking the timestamp button in the chat input pastes the formatted current time into the text box.
- [ ] When another user is typing, the typing indicator shows their name and animated bouncing dots.
- [ ] When the user stops typing for 2.5s or sends the message, the typing indicator disappears.
- [ ] Works cleanly on both desktop and mobile chat drawer.

---

## Checks to Run
- `npx tsc --noEmit` to verify type integrity.
- `npm run build` to ensure Next.js production compilation passes without warnings.
- Manual test in multi-tab room to verify live typing indicator and timestamp jumping.

---

## Exact Manual Test Steps
1. Open a room in two browser tabs (Host and Guest).
2. Start typing in Tab 2's chat input: observe "Guest is typing..." with bouncing dots appear in Tab 1's chat feed.
3. Stop typing in Tab 2: observe the typing indicator disappear after ~2.5s.
4. In Tab 2, type: `check this out at 00:30` and send the message.
5. In Tab 1, click the `00:30` timestamp badge: observe the video jump directly to 30 seconds.
6. Test clicking the quick timestamp button next to the input to verify current playback time pastes into the input field.
