# Implementation Prompt: Fix Mobile & PC Fullscreen and Host Failover Controls

## Goal
Fix both the Fullscreen and Playback Controls failures on mobile and PC when the room host leaves and control transfers to a normal user:
1. **Fix Fullscreen on Mobile (iOS Safari & Android) and PC**:
   - On iOS Safari / iPhone, native HTML5 Fullscreen (`requestFullscreen` / `webkitRequestFullscreen`) is completely unsupported on `<div>` elements and silently fails without throwing. Detect when native fullscreen is unavailable (`!document.fullscreenEnabled && !document.webkitFullscreenEnabled`) and activate seamless CSS Viewport Fullscreen (Theater Mode) immediately.
   - When fullscreen is active (whether native or CSS fallback), ensure the video container expands edge-to-edge (`fixed inset-0 z-50 bg-black flex flex-col justify-between w-screen h-screen`) with the controls bar floating at the bottom, and allow exiting via the fullscreen button or the Escape key.
2. **Fix Playback Controls & Video Interactivity**:
   - In `YouTubePlayer.tsx`, eliminate the full-screen transparent click-shield overlay that was intercepting touches and preventing mobile browsers from unlocking audio/video playback for the YouTube iframe.
   - For the unmute prompt, use `pointer-events-none` on the backdrop and `pointer-events-auto` strictly on the unmute badge, allowing users to touch the video and iframe directly.
   - Always initialize YouTube with `controls: 1` and `fs: 1` so native YouTube player controls, fullscreen, subtitles, and settings gear are accessible.
   - Ensure the newly promoted host's Play/Pause and Seek interactions in `PlaybackControls` and directly on the video immediately synchronize the entire room.

---

## Skills Read & Inspected
- `AGENTS.md`: Section 3 (responsive down to mobile), Section 7 (host authority, drift correction), Section 9 (sync protocol), Section 10 (checks to run).
- `prompts/automatic-host-failover.md` and `prompts/quality-and-subtitles-options.md`.

---

## Code Inspected
1. `components/player/YouTubePlayer.tsx`:
   - Line 389: The overlay `<div className="absolute inset-0 z-20 cursor-pointer select-none">` blocked all touch events from reaching the YouTube iframe on mobile. Mobile browsers (WebKit on iOS and Chrome on Android) require direct touch on the iframe to grant media playback permissions.
   - Lines 217-224: `controls: isHost ? 1 : 0` and `fs: isHost ? 1 : 0` created a disabled player for viewers that never updated when promoted to host.
2. `app/room/[code]/page.tsx`:
   - Line 640: `handleToggleFullscreen` called `container.webkitRequestFullscreen()` which on iPhone is a silent no-op on `<div>` elements, preventing `isCssFullscreen` fallback from ever triggering.
   - Line 1247: Fullscreen styling relied on `[&:fullscreen]` CSS pseudo-classes instead of the React `isFullscreen || isCssFullscreen` state, failing on browsers that require vendor prefixes.
3. `components/player/PlaybackControls.tsx`:
   - Touch drag handlers now use `getClientX` with `changedTouches`, but need active state synchronization with the promoted host.

---

## Decisions and Assumptions
1. **Universal Fullscreen**:
   - Check `const nativeSupported = Boolean(document.fullscreenEnabled || (document as any).webkitFullscreenEnabled) && !/iPhone|iPod/.test(navigator.userAgent)`.
   - If not nativeSupported: immediately toggle `isCssFullscreen`.
   - If nativeSupported: attempt `container.requestFullscreen()` with fallback to `isCssFullscreen` on error.
   - In either mode, render full viewport layout with high z-index and black background.
2. **Iframe Touch Access on Mobile**:
   - Do not block the YouTube player with an invisible overlay. Keep the unmute banner interactive without swallowing taps meant for the video.
   - Provide `controls: 1` and `fs: 1` so YouTube native controls and fullscreen button work on all devices.

---

## Files to Touch
1. `components/player/YouTubePlayer.tsx` (MODIFY: set `controls: 1, fs: 1`, remove blocking overlay, make unmute banner non-blocking with `pointer-events-none` container and `pointer-events-auto` badge).
2. `app/room/[code]/page.tsx` (MODIFY: fix `handleToggleFullscreen` detection, bind fullscreen container styles directly to `isFullscreen || isCssFullscreen` state, verify promoted host play/pause sync).
3. `components/player/PlaybackControls.tsx` (MODIFY: ensure fullscreen icon reflects active fullscreen state, touch events work smoothly).

---

## Acceptance Criteria
- [ ] On mobile (iPhone Safari and Android Chrome), tapping the Fullscreen button enters full viewport mode immediately without fail. Tapping again exits fullscreen.
- [ ] On PC, clicking Fullscreen enters native fullscreen mode (or CSS fallback).
- [ ] When the host leaves, after 3 seconds the remaining participant is promoted to Host.
- [ ] The newly promoted host can play, pause, and seek from both the custom controls bar and directly on the video.
- [ ] Both `npx tsc --noEmit` and `npm run build` succeed with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit` to verify type safety.
- `npm run build` to verify Next.js production build passes.

### Manual Test Steps
1. Open `https://popcorn.ragibshahrier.com` on PC (Host) and join room on Mobile (Viewer).
2. Start video playback. Close the PC Host tab.
3. Observe Mobile: within 3 seconds, the badge updates to green **`Host`**.
4. On Mobile:
   - Tap Fullscreen button: verify the video expands to the full screen. Tap again to exit.
   - Tap Play/Pause: verify the video toggles playback smoothly.
   - Drag or tap scrubber: verify the video seeks without error.
