# Implementation Prompt: Fix Mobile Navigation Stuck on Homepage

## Goal
Fix the issue where mobile users tap "Join" (or "Create a room") and remain stuck on the homepage, by replacing Next.js 16's internal `router.push()` (which drops client transitions when LAN RSC requests encounter 307 redirects) with direct `window.location.href` navigation.

---

## Skills Read & Inspected
- `AGENTS.md`:
  - Section 2: Implementation loop (read docs, inspect code, write prompt in `prompts/`, get user approval, execute, verify, report).
  - Section 5: App structure and boundaries.
  - Section 10: Multi-device & type checks.

---

## Code Inspected
1. `app/page.tsx`:
   - Lines 47 & 85: Uses `router.push(`/room/${code}`)`.
   - When accessing Next.js 16 dev server over a LAN IP (`http://192.168.0.116:3000`), Next.js RSC routes return `307 Temporary Redirect` to `?_rsc`.
   - Next.js 16's client router does not complete the soft transition on redirected RSC requests over LAN origins, silently dropping the transition while `isJoining` remains `true`. As a result, the user remains stuck on the homepage indefinitely.
2. Direct navigation via `window.location.href = targetUrl` instructs the browser engine (WebKit/Chromium) to execute an immediate HTTP navigation, bypassing client router transition aborts and reliably entering the room.

---

## Decisions and Assumptions
1. **Direct Navigation**:
   - Update both `handleCreateRoom` and `handleJoinRoom` in `app/page.tsx` to set `window.location.href = `/room/${roomCode}``.
   - Add `// eslint-disable-next-line @next/next/no-location-assign-relative-destination` to keep ESLint passing with 0 warnings/errors.
2. **Error Handling & State**:
   - Ensure `setIsJoining(false)` and `setIsCreating(false)` reset cleanly on any validation or network failure so the user is never stuck in a disabled button state.
   - Ensure the error banner scrolls or appears clearly in view if a room code is invalid.

---

## Files to Touch
- `app/page.tsx`

---

## Security Considerations
- Room codes continue to be strictly sanitized with `sanitizeRoomCode`.
- Navigation destination is always restricted to the internal `/room/${sanitizedCode}` path.

---

## Acceptance Criteria
1. On a mobile phone navigating to `http://192.168.0.116:3000`:
   - Entering name and room code and tapping "Join" immediately navigates the browser to `/room/[code]`.
   - Creating a room also immediately navigates to the newly generated `/room/[code]`.
2. `npx tsc --noEmit` and `npx eslint app/page.tsx` pass with 0 errors and 0 warnings.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit`
- `npx eslint app/page.tsx`

### Manual Test Steps
1. On the mobile phone, open `http://192.168.0.116:3000`.
2. Enter your name and active room code `Q28K88`.
3. Tap "Join".
4. Confirm the browser immediately leaves the homepage and opens `/room/Q28K88`.
