# Implementation Prompt: Fix Mobile Join Form Refresh and Enable LAN Socket Connection

## Goal
Fix the issue where tapping "Join" or pressing Enter on a mobile device / mobile view causes the homepage to refresh and wipe the inputs instead of entering the room, and ensure the mobile client connects seamlessly to the realtime Socket.io server over the local network (LAN).

---

## Skills Read & Inspected
- `AGENTS.md`:
  - Section 2: Implementation workflow (investigate, prompt in `prompts/`, user approval, execute, verify, report).
  - Section 5: Realtime / Client boundaries.
  - Section 10: Multi-tab & verification checks (`tsc --noEmit`, lint).
  - Section 12: Maintain clean boundaries and exact functionality.

---

## Code Inspected
1. `app/page.tsx`:
   - Lines 55–89: `handleJoinRoom` is an async function attached to `<form onSubmit={handleJoinRoom}>`.
   - Lines 165–187: The "Join" button has `type="submit"`. On mobile browsers (Safari/Chrome), tapping submit or pressing the virtual keyboard's "Go/Done" key triggers the browser's native HTTP GET submission if touch dispatch precedes React 19 synthetic event handling or before client-side hydration completes. This results in an immediate full-page reload back to `/?`.
   - Line 83: Uses `router.push('/room/${data.room.code}')`. On LAN mobile connections, if client router prefetch fails, adding a reliable fallback ensures navigation always succeeds.
2. `lib/socket.ts`:
   - Lines 63–75: `getSocket()` uses `process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"`. When opened on a mobile device, `localhost` points to the mobile phone itself, breaking socket connectivity and chat/sync once the room loads.

---

## Decisions and Assumptions
1. **Prevent Native Form Submit on Mobile**:
   - Change the "Join" button from `type="submit"` to `type="button"` with `onClick={handleJoinRoom}`. A `type="button"` physically cannot trigger a native form submit in any browser.
   - Add `action="javascript:void(0)"` and explicit `onSubmit={(e) => { e.preventDefault(); handleJoinRoom(); }}` to the form container.
   - Add `onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleJoinRoom(); } }}` on the input field so pressing the mobile keyboard's "Go" or "Enter" key submits cleanly without a browser reload.
2. **Robust Navigation**:
   - In `handleJoinRoom`, attempt `router.push(`/room/${data.room.code}`)` and fallback to `window.location.assign(`/room/${data.room.code}`)` if navigation encounters any client-side routing interruption.
3. **Dynamic LAN Realtime Socket Resolution**:
   - In `lib/socket.ts`, if running in the browser and accessing via a network IP or custom hostname (not `localhost` or `127.0.0.1`), adapt the socket URL to `http://${window.location.hostname}:3001` if `NEXT_PUBLIC_SOCKET_URL` points to localhost. This allows mobile devices on the same Wi-Fi network to connect to the realtime server out-of-the-box without requiring manual `.env` edits whenever the local IP changes.

---

## Files to Touch
1. `app/page.tsx`
   - Update the Join form and button attributes to eliminate native submit refresh.
   - Enhance `handleJoinRoom` with keyboard and navigation safeguards.
2. `lib/socket.ts`
   - Dynamically resolve the socket server hostname for LAN / mobile clients.

---

## Security Considerations
- All room codes continue to be strictly sanitized with `sanitizeRoomCode`.
- Socket signaling and room authentication remain intact.

---

## Acceptance Criteria
1. On a mobile phone or mobile view:
   - Entering a name, entering an active room code, and tapping "Join" navigates directly to `/room/[code]` without refreshing the page.
   - Pressing "Enter" or "Go" on the mobile virtual keyboard navigates into the room without page reload.
2. The mobile client successfully connects to the Socket.io server on port 3001 and syncs participant state.
3. `npx tsc --noEmit` and `npm run lint` pass with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit`
- `npm run lint`

### Manual Test Steps
1. Navigate to `http://192.168.0.116:3000` (or `http://localhost:3000`) in mobile view / mobile device.
2. Enter name and active room code (e.g. `Q28K88`).
3. Tap "Join".
4. Confirm the browser smoothly transitions to `/room/Q28K88` instead of reloading the homepage.
