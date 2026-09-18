# Implementation Prompt: Fix Mobile Allowed Dev Origins and Room Code Case Normalization

## Goal
Fix mobile browser failures on local Wi-Fi by:
1. Adding `allowedDevOrigins` to `next.config.ts` so Next.js does not block cross-origin dev resources and HMR from `192.168.0.116`.
2. Normalizing `code` in `app/room/[code]/page.tsx` via `sanitizeRoomCode()` so lowercase room URLs (e.g. `/room/q28k88`) join the exact same uppercase Socket.io room (`Q28K88`) as the host.
3. Restarting the Next.js dev server so `next.config.ts` changes take effect.

---

## Skills Read & Inspected
- `AGENTS.md`:
  - Section 2: Implementation loop (read docs, inspect code, write prompt in `prompts/`, get user approval, execute, verify, report).
  - Section 5: Realtime / Client boundaries and room state.
  - Section 10: Multi-device verification, dev server, and checks.

---

## Code Inspected
1. `next.config.ts`:
   - Next.js 16 blocks cross-origin dev resources by default from local network IPs (`⚠ Blocked cross-origin request to Next.js dev resource /_next/hmr from "192.168.0.116"`).
   - This causes mobile browser scripts to throw security errors and halt execution on `http://192.168.0.116:3000`.
   - Configuring `allowedDevOrigins: ["192.168.0.116", "192.168.0.116:3000", "localhost:3000"]` unblocks the mobile client.
2. `app/room/[code]/page.tsx`:
   - Line 42: `const code = (routeParams?.code as string) || "";`
   - In Next.js dev logs, the mobile phone navigated to `/room/q28k88` (lowercase).
   - Because `code` was not sanitized to uppercase, Socket.io emitted `join_room` with `roomId: "q28k88"`, while the host on desktop is in `roomId: "Q28K88"`. The two clients were placed into completely different socket rooms.
   - Wrapping with `sanitizeRoomCode` ensures both the database fetch and Socket.io room subscription always match `Q28K88`.

---

## Decisions and Assumptions
1. **Unblock Mobile Dev Traffic in Next.js**:
   - Add `allowedDevOrigins` with `192.168.0.116` and `localhost:3000` to `next.config.ts`.
2. **Case-Insensitive Room Joining**:
   - In `app/room/[code]/page.tsx`, sanitize `code` with `sanitizeRoomCode(routeParams?.code || "")`.
   - If the URL in the browser is lowercase, silently replace the history state with uppercase `Q28K88`.
3. **Restart Dev Server**:
   - Stop the outdated Next.js dev process (PID 9704) and start a fresh instance so `allowedDevOrigins` takes effect.

---

## Files to Touch
1. `next.config.ts`
2. `app/room/[code]/page.tsx`

---

## Security Considerations
- `allowedDevOrigins` is restricted strictly to local network IP addresses and development mode.
- Room sanitization continues to strip non-alphanumeric characters.

---

## Acceptance Criteria
1. Mobile devices on `192.168.0.116` are no longer blocked by Next.js cross-origin dev resource security filters.
2. Opening `/room/q28k88` (lowercase) or `/room/Q28K88` (uppercase) joins the same Socket.io room and syncs with the desktop host.
3. Next.js dev server is running and listening with the new configuration.
4. `npx tsc --noEmit` and `npx eslint app/room/[code]/page.tsx next.config.ts` pass with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit`
- `npx eslint app/room/[code]/page.tsx next.config.ts`

### Manual Test Steps
1. On your phone, open `http://192.168.0.116:3000/room/Q28K88` (or `q28k88`).
2. Confirm the room loads immediately without loading hang or blocked script errors.
3. Check the participant list and chat to confirm the phone and desktop are in the same synchronized room.
