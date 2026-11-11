# Implementation Prompt: Fix Screen Share Button & WebRTC Stream Reliability

## Goal
Fix the "Share screen" button so that it works reliably on desktop across all browsers (Chrome, Firefox, Safari, Edge), provides immediate mobile compatibility notice on mobile devices (iOS, Android, iPadOS), resolves constraint crashes and transient user activation errors in `getDisplayMedia`, and ensures smooth video playback without stream reset freezes on volume changes.

---

## Skills Read & Inspected
- `AGENTS.md`:
  - Section 1 & 7: Sync-only, no local video file uploads. Screen sharing uses browser-to-browser WebRTC streams with ephemeral signaling.
  - Section 3: UI aesthetics & responsiveness (Warm Midnight Cinema dark theme / light theme).
  - Section 5: Realtime server vs web app responsibilities.
  - Section 10: Multi-tab manual verification and automated checks.
  - Section 12: Preserve boundaries, keep changes focused, run checks, share exact test steps.

---

## Code Inspected & Root Causes
1. `lib/webrtc/WebRTCManager.ts`:
   - Lines 60-80: Hardcodes `video: { displaySurface: "browser" }` and advanced audio constraints `audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 }`.
   - In Firefox and Safari, passing constraint objects to `audio` or `displaySurface: "browser"` causes `getDisplayMedia()` to throw `OverconstrainedError`, `TypeError`, or `NotSupportedError`.
   - The fallback in the catch block attempts to call `navigator.mediaDevices.getDisplayMedia(...)` a second time. In all modern browsers, the transient user activation (user gesture) is consumed by the first call. Calling `getDisplayMedia()` a second time in an async catch block causes an immediate `InvalidStateError` or `SecurityError: getDisplayMedia must be called from a user gesture`.
   - The outer catch block swallows the error and returns `null` without notifying callers or distinguishing user cancellations from permission/system failures.
2. `app/room/[code]/page.tsx`:
   - Line 1058: `if (!currentUser || !socketRef.current?.connected) return;` is executed before the mobile capability check. If the realtime socket is reconnecting, or if a mobile user taps "Share screen" while the socket is negotiating, the click is silently ignored.
   - Line 1074: Only checks `!navigator.mediaDevices?.getDisplayMedia`. On Android Chrome and iPads, `navigator.mediaDevices.getDisplayMedia` is defined on the prototype, but invoking it throws `NotSupportedError: getDisplayMedia is not supported on this platform`. Because `startScreenShare()` returned `null`, `page.tsx` never caught `NotSupportedError`, and `ScreenShareNoticeModal` was never shown.
   - Missing user-facing error feedback when screen capture fails due to system permissions.
3. `components/player/ScreenSharePlayer.tsx`:
   - Line 66: `video.srcObject = stream` is assigned on every volume slider change or mute toggle because `[stream, effectiveMuted, volume]` are dependencies of the same effect. In HTML5 video, re-assigning `video.srcObject` when it hasn't changed resets the media decoding pipeline, freezing or blacking out playback.
   - Line 30: `isVideoLoaded` relies strictly on `loadedStreamId === stream?.id`. If `video.readyState >= 2` before event listeners attach, `loadeddata` never fires, leaving viewers permanently stuck on the "Connecting to screen..." overlay.

---

## Decisions and Assumptions
1. **Universal Cross-Browser `getDisplayMedia` Initialization**:
   - Detect browser engine (Safari, Firefox, Chromium) before calling `getDisplayMedia`.
   - In Safari and Firefox, request `{ video: true, audio: false }` since these engines do not support display audio in `getDisplayMedia` and throw errors if audio constraints are provided.
   - In Chromium (Chrome, Edge, Brave, Opera), request `{ video: true, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }` for high-fidelity audio without restricting `video.displaySurface` to `"browser"`. If constraint validation fails synchronously before user activation expires, safely retry with `{ video: true }`.
2. **Robust Mobile & Tablet Detection**:
   - Implement comprehensive mobile detection (`/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i` and touch Mac iPads).
   - In `handleToggleScreenShare()`, evaluate the mobile check upfront before network socket guards so mobile users always receive the helpful `ScreenShareNoticeModal` directing them to "+ Add video instead".
3. **Graceful Cancellation & Error Feedback**:
   - If the user cancels the browser's screen picker, dismiss cleanly without error alerts (`NotAllowedError`).
   - If an error occurs (such as missing OS screen recording permissions), log cleanly and inform the user.
4. **Resilient Screen Share Video Surface (`ScreenSharePlayer.tsx`)**:
   - Only update `video.srcObject = stream` when `video.srcObject !== stream`.
   - Separate audio volume/mute handling from stream attachment.
   - Check `video.readyState >= 2` or `!video.paused` on mount/update so the loading spinner clears promptly.
5. **No Breaking Changes**:
   - YouTube video playback, sync protocol, voice party, and chat remain completely untouched.

---

## Files to Touch
1. `lib/webrtc/WebRTCManager.ts`:
   - Implement safe browser-aware `getDisplayMedia` options and clean error propagation.
2. `app/room/[code]/page.tsx`:
   - Check mobile/tablet status upfront before socket guards.
   - Open `ScreenShareNoticeModal` on mobile devices or if `NotSupportedError` occurs.
3. `components/player/ScreenSharePlayer.tsx`:
   - Guard `video.srcObject` re-assignment and ensure reliable readyState detection.

---

## Security Considerations
- Screen capture still requires explicit user consent through the browser's native picker dialog.
- DTLS-SRTP end-to-end encryption is maintained.
- No media data is stored on any server.

---

## Acceptance Criteria
1. Clicking "Share screen" on desktop browsers (Chrome, Edge, Firefox, Safari) immediately opens the browser's screen picker without constraint or activation errors.
2. Users can share entire screens, desktop application windows (e.g. VLC, media players), or browser tabs.
3. Tapping "Share screen" on mobile devices (iOS, Android, iPadOS) immediately displays the `ScreenShareNoticeModal` with "+ Add Video Instead".
4. Adjusting the screen share volume slider on the viewer's screen does not reset the video stream or cause video blackouts.
5. Automated type checks (`npx tsc --noEmit`) pass with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit`
- `npm run lint`

### Manual Test Steps
1. Open Watch Together in Chrome/Firefox on desktop.
2. Click **"Share screen"** in the top navigation bar. Verify the browser's native screen picker dialog opens immediately.
3. Select a window or screen. Confirm that your screen appears smoothly in `ScreenSharePlayer`.
4. Open the room in a second browser tab. Confirm that the viewer sees the screen share without being stuck on the connecting spinner.
5. Adjust the volume slider on the viewer tab; verify playback is uninterrupted.
6. Open the room in a mobile viewport / mobile browser and tap "Share screen"; verify `ScreenShareNoticeModal` opens with "+ Add Video Instead".
