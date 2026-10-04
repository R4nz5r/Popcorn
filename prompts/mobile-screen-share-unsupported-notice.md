# Implementation Prompt: Mobile Screen Sharing Compatibility Detection & Help Modal

## Goal
Detect when a user attempts to share their screen from an unsupported mobile device or browser (e.g. iOS Safari, Android in-app webview, or browsers lacking `getDisplayMedia`), and provide an elegant, helpful dialog explaining the mobile platform limitations while offering the immediate alternative of syncing YouTube videos via "+ Add video".

---

## Skills Read & Inspected
- `AGENTS.md`:
  - Section 3: UI work & responsiveness. Match theme aesthetics (Warm Midnight Cinema dark theme / light theme).
  - Section 5: Realtime server vs web app responsibilities.
  - Section 10: Multi-tab verification and type checks.
  - Section 12: Keep it small, preserve boundaries, run checks, share exact test steps.

---

## Code Inspected
1. `app/room/[code]/page.tsx`:
   - Line 1055: `handleToggleScreenShare()` attempts to invoke `webrtcManagerRef.current?.startScreenShare()`.
   - Line 1095: Errors were caught and logged only via `console.error("Failed to start screen share:", err);` with no visual feedback.
   - Lines 1405-1413 (Desktop Navbar) & Lines 1607-1619 (Mobile Menu Dropdown): Render "Share screen" button.
2. `lib/webrtc/WebRTCManager.ts`:
   - Line 58: Checks `typeof window === "undefined" || !navigator.mediaDevices?.getDisplayMedia` and throws `Screen sharing is not supported on this browser/device.`.

---

## Decisions and Assumptions
1. **Device & Capability Detection**:
   - Detect if `navigator.mediaDevices?.getDisplayMedia` is unavailable (e.g. iOS Safari) or if a mobile device user agent is active.
   - If the user taps "Share screen" on an unsupported device or if `startScreenShare` fails with a capability error, open `ScreenShareNoticeModal`.
2. **Helpful & Actionable Modal (`components/room/ScreenShareNoticeModal.tsx`)**:
   - Matches Popcorn's Warm Midnight Cinema styling (dark `#1c1b18`, rounded-3xl borders, smooth backdrop blur).
   - Explains clearly:
     - Mobile operating systems (iOS and mobile web engines) restrict web browsers from broadcasting screen capture.
     - Mobile devices can seamlessly **view** screens shared by PC/Laptop users.
     - Suggests adding a YouTube link via "+ Add video" for cross-device synchronized movie/video nights.
   - Provides a direct "+ Add Video" action button (opens `AddSourceModal`) and a "Got it" dismiss button.
3. **No Breaking Changes**:
   - Desktop PC/Laptop screen sharing continues to operate normally.
   - Mobile users can still view active screen shares without any changes to receiving logic.

---

## Files to Touch
1. `components/room/ScreenShareNoticeModal.tsx` (New file):
   - Accessible dialog explaining mobile screen share restrictions with action to switch to "+ Add video".
2. `app/room/[code]/page.tsx`:
   - Wire `isScreenShareNoticeOpen` state.
   - Trigger the modal in `handleToggleScreenShare` when capability is missing or when `startScreenShare` throws an unsupported browser error.
   - Render `ScreenShareNoticeModal`.

---

## Security Considerations
- Pure client-side UI guidance. No credentials or permissions are compromised.

---

## Acceptance Criteria
1. Tapping "Share screen" on mobile/unsupported devices displays the `ScreenShareNoticeModal` instead of silently failing.
2. Clicking "+ Add Video Instead" closes the notice and opens the `AddSourceModal`.
3. Desktop browsers with `getDisplayMedia` support can still share screen normally.
4. `npx tsc --noEmit` and `npm run lint` pass with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit`
- `npm run lint`

### Manual Test Steps
1. Open room on an iOS Safari or mobile device (or simulate mobile with unsupported `getDisplayMedia`).
2. Tap "Share screen" from the mobile dropdown menu.
3. Verify the "Screen Sharing on Mobile" modal opens with clear guidance and action buttons.
4. Tap "+ Add Video Instead" and confirm `AddSourceModal` opens smoothly.
