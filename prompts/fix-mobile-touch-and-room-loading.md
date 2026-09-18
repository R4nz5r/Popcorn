# Implementation Prompt: Fix Mobile Touch Response and Room Page Loading Guard

## Goal
Fix the mobile issue where tapping "Join" does nothing (due to mobile keyboard dismissal layout shift canceling standard click events) and ensure the room page (`/room/[code]`) reliably resolves route params and fetches room data without hanging on "Loading room...".

---

## Skills Read & Inspected
- `AGENTS.md`:
  - Section 2: Implementation loop (investigate, prompt in `prompts/`, user approval, execute, verify, report).
  - Section 3 & 5: Mobile responsiveness and client boundaries.
  - Section 10: Multi-device testing and type checks.

---

## Code Inspected
1. `app/page.tsx`:
   - Lines 167–203: The "Join" button only binds `onClick={handleJoinRoom}`. On mobile touchscreens (iOS Safari / Android Chrome), when the user finishes typing in the room code input and taps "Join", the input blur dismisses the virtual keyboard. This immediate layout shift causes `touchend` coordinates to diverge from `touchstart`, causing mobile browsers to treat the tap as a gesture/scroll and cancel the synthetic `click` event entirely.
   - Enclosing `<form action="javascript:void(0)">` can additionally suppress standard event propagation on mobile virtual keyboard submissions.
   - Replacing the form wrapper with a native responsive container and attaching `onPointerDown` (which triggers immediately upon finger contact before keyboard dismissal layout shifts) ensures the tap registers 100% of the time.
   - Adding `enterKeyHint="go"` and keyboard blur on Enter handles mobile virtual keyboard submissions cleanly.
2. `app/room/[code]/page.tsx`:
   - Line 117: `useEffect` for `fetchRoom()` must guard `if (!code) return;` to prevent racing against initial client router param hydration before `code` is populated.

---

## Decisions and Assumptions
1. **Immediate Touch Registration**:
   - Add `onPointerDown` on both "Join" and "Create a room" buttons: if `e.pointerType === "touch"`, trigger the action immediately on touch contact.
   - Replace the `<form>` wrapper with a styled `<div>` flex row to eliminate mobile browser form submit swallowing.
   - Add `enterKeyHint="go"` to the room code input so the mobile keyboard explicitly shows a "Go" button.
2. **Room Param Guard**:
   - In `app/room/[code]/page.tsx`, guard `useEffect` with `if (!code) return;` so `fetchRoom()` only runs with a valid room code.
3. **No Breaking Changes**:
   - Desktop mouse clicks continue to work identically via `onClick`.
   - All room validation, sanitization, and state models remain unchanged.

---

## Files to Touch
1. `app/page.tsx`
2. `app/room/[code]/page.tsx`

---

## Security Considerations
- Room code sanitization and internal destination routing remain strictly enforced.

---

## Acceptance Criteria
1. On a mobile phone:
   - Tapping "Join" immediately triggers room join and navigates to the room.
   - Pressing "Go" / "Enter" on the mobile keyboard immediately triggers room join.
2. The room page (`/room/[code]`) loads the room state cleanly without getting stuck on "Loading room...".
3. `npx tsc --noEmit` and `npx eslint app/page.tsx app/room/[code]/page.tsx` pass with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit`
- `npx eslint app/page.tsx app/room/[code]/page.tsx`

### Manual Test Steps
1. On mobile phone, open `http://192.168.0.116:3000`.
2. Type name in "Your name" input.
3. Type active room code (e.g. `Q28K88`) in "Enter room code" input.
4. Tap "Join".
5. Confirm the tap registers immediately, the button shows "Joining...", and the browser loads `/room/Q28K88`.
