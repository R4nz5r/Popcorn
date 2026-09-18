# Implementation Prompt: Fix Mobile Fullscreen & Playback Controls on Host Failover

## Goal
Fix mobile playback control failure and mobile fullscreen failure when a room host leaves and a normal user is promoted to Host:
1. **Fix Mobile Fullscreen (iOS Safari & Android)**: On mobile browsers (especially iOS Safari / iPhone where the HTML5 Fullscreen API is unsupported on `<div>` elements), implement a seamless CSS Viewport Fullscreen (Theater Mode) fallback so tapping the Fullscreen button on any phone expands the video edge-to-edge.
2. **Fix Mobile Touch Scrubber & Volume Crash**: In `PlaybackControls.tsx`, `calculateTimeFromEvent` and `calculateVolumeFromEvent` read `e.touches[0].clientX`. On `touchend`, `e.touches` is empty, causing an uncaught `TypeError: Cannot read properties of undefined (reading 'clientX')` that crashes controls on mobile. Fix this to read `e.changedTouches[0]`.
3. **Fix Video Tap & Playback Controls on Promoted Host**: When a guest is promoted to host, ensure the video player area remains interactive (tappable to play/pause) and that the promoted host's Play/Pause and Seek actions in `PlaybackControls` seamlessly control the room without iframe dead-zones.

---

## Skills Read & Inspected
- `AGENTS.md`: Section 3 (Mobile responsive layout down to mobile), Section 7 (Buffering and host authority), Section 9 (Sync protocol), Section 10 (Checks to run).
- `prompts/fix-ios-safari-fullscreen-type-error.md` and `prompts/automatic-host-failover.md`.

---

## Code Inspected
1. `components/player/PlaybackControls.tsx`:
   - Line 75: `const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;` crashes on `touchend` because `e.touches` is empty on release. Must check `e.touches[0] || e.changedTouches?.[0]`.
   - Line 125: Volume calculation has the same `e.touches[0]` crash.
2. `components/player/YouTubePlayer.tsx`:
   - Line 389: `{!isHost && (<div className="absolute inset-0 z-20..."/>)}`. When a user is promoted to host, `!isHost` becomes false, removing the tap overlay. Because the iframe was initialized with `controls: 0` when the user was a guest, the promoted user is left with a non-interactive iframe dead zone.
3. `app/room/[code]/page.tsx`:
   - Lines 622-645: `handleToggleFullscreen` only calls `container.requestFullscreen()`, which is `undefined` on iOS Safari `<div>` elements. Must add a CSS Viewport Fullscreen fallback (`isCssFullscreen`) so tapping fullscreen works on all mobile devices.

---

## Decisions & Assumptions
1. **Cross-Platform Mobile Fullscreen**:
   - First attempt native `container.requestFullscreen()` or `container.webkitRequestFullscreen()`.
   - If unsupported (e.g. iOS Safari) or rejected by browser policy, fallback to CSS Viewport Fullscreen (`fixed inset-0 z-50 w-screen h-screen bg-black flex flex-col justify-between p-3 sm:p-4`).
   - Listen to window `keydown` (Escape) and the toggle button to exit CSS fullscreen cleanly.
2. **Safe Touch Event Extraction**:
   - Helper function `getClientX(e)` that checks:
     `"touches" in e ? (e.touches[0]?.clientX ?? e.changedTouches?.[0]?.clientX ?? 0) : e.clientX`.
3. **Universal Tap-to-Play/Pause**:
   - Keep the video overlay interactive for both host and viewers when custom playback controls are active, triggering the synchronized `handlePlayPause()` action on tap.

---

## Files to Touch
1. `components/player/PlaybackControls.tsx` (MODIFY: fix `touchend` crash using `changedTouches`, ensure touch events do not throw).
2. `components/player/YouTubePlayer.tsx` (MODIFY: ensure overlay supports play/pause tap interaction regardless of dynamic host promotion).
3. `app/room/[code]/page.tsx` (MODIFY: implement CSS viewport fullscreen fallback for mobile, update video container styling when in fullscreen).

---

## Security & Architecture Considerations
- Preserves the host-authoritative rule: promoted host emits socket `play`, `pause`, and `seek` events to the server.
- No third-party libraries needed; native CSS and TouchEvent handling.

---

## Acceptance Criteria
- [ ] On mobile browsers (including iOS Safari), tapping the Fullscreen button expands the player to full screen without errors. Tapping it again exits fullscreen.
- [ ] Dragging and tapping the scrubber on mobile does not crash or throw `TypeError: Cannot read properties of undefined (reading 'clientX')`.
- [ ] When the room host leaves and a normal user is promoted to host:
  - The newly promoted host can tap the Play/Pause button in `PlaybackControls` to pause and resume the room.
  - The newly promoted host can seek using the scrubber bar on mobile.
  - Tapping the video continues to toggle play/pause.
- [ ] `npm run build` succeeds with 0 errors.

---

## Verification Plan
### Automated Checks
- `npm run build` in `f:\Nextjs\watch-together` to verify TypeScript, components, and routing build cleanly.

### Manual Verification
1. Open room on mobile (or mobile emulation in devtools).
2. Join room with 2 users: Host in Tab A, Normal user in Tab B (Mobile).
3. Close Tab A. Wait 3 seconds for Tab B to be promoted to Host.
4. On Tab B (Mobile):
   - Tap Play/Pause: verify video toggles playback and syncs.
   - Tap/Drag scrubber: verify playback seeks without errors.
   - Tap Fullscreen: verify video enters fullscreen (CSS viewport fallback on iOS / native on Android).
