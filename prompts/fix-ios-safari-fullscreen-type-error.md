# Implementation Prompt: Fix iOS Safari Fullscreen TypeError in ScreenSharePlayer

## Goal
Fix the `TypeError: containerRef.current.requestFullscreen is not a function` error occurring on iOS Safari (iPhone) when toggling fullscreen in `ScreenSharePlayer.tsx` and ensure safe cross-browser fullscreen handling with WebKit vendor prefix fallbacks across the app.

---

## Skills Read & Inspected
- `AGENTS.md`:
  - Section 2: Implementation workflow (read docs, inspect code, write prompt in `prompts/`, get user approval, execute, verify, report).
  - Section 3: Mobile layout & responsiveness.
  - Section 10: Multi-device testing, type checks, lint checks.

---

## Code Inspected
1. `components/player/ScreenSharePlayer.tsx`:
   - Line 67: `containerRef.current.requestFullscreen().catch(() => {});`
   - On iOS Safari (iPhone), Apple WebKit does NOT support the HTML5 Fullscreen API on `<div>` elements (`requestFullscreen` is `undefined`). Calling `undefined()` throws an immediate `Runtime TypeError`.
   - On iPhone WebKit, fullscreen video playback is supported on the `<video>` element directly via `videoRef.current.webkitEnterFullscreen()`.
   - On iPad and other WebKit browsers, `element.webkitRequestFullscreen()` is supported.
   - On exiting fullscreen, `document.exitFullscreen` or `document.webkitExitFullscreen` must be checked safely before invoking.
2. `app/room/[code]/page.tsx`:
   - Line 589: `videoContainerRef.current.requestFullscreen?.()`: Ensure WebKit vendor prefixes (`webkitRequestFullscreen`, `webkitFullscreenElement`, `webkitExitFullscreen`) are also safely supported for standard playback mode.

---

## Decisions and Assumptions
1. **Safe iOS / WebKit Fullscreen Fallbacks**:
   - In `ScreenSharePlayer.tsx`:
     ```ts
     const handleToggleFullscreen = () => {
       const container = containerRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
       const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
       const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };

       const isFs = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);

       if (!isFs) {
         if (container?.requestFullscreen) {
           container.requestFullscreen().catch(() => {});
           setIsFullscreen(true);
         } else if (container?.webkitRequestFullscreen) {
           container.webkitRequestFullscreen();
           setIsFullscreen(true);
         } else if (video?.webkitEnterFullscreen) {
           video.webkitEnterFullscreen();
         }
       } else {
         if (document.exitFullscreen) {
           document.exitFullscreen().catch(() => {});
         } else if (doc.webkitExitFullscreen) {
           doc.webkitExitFullscreen();
         }
         setIsFullscreen(false);
       }
     };
     ```
   - Listen to both `fullscreenchange` and `webkitfullscreenchange` event listeners.
2. Apply the same safe WebKit vendor-prefix fallbacks to `handleToggleFullscreen` in `app/room/[code]/page.tsx`.

---

## Files to Touch
1. `components/player/ScreenSharePlayer.tsx`
2. `app/room/[code]/page.tsx`

---

## Security Considerations
- Fullscreen requires explicit user gesture/interaction, which is preserved.
- No third-party dependencies or external API calls are introduced.

---

## Acceptance Criteria
1. Tapping the fullscreen button on an iPhone (iOS Safari / Chrome) in `ScreenSharePlayer`:
   - Safely triggers native video fullscreen via `webkitEnterFullscreen` (or vendor-prefixed fullscreen) without throwing any runtime TypeError.
2. Exiting fullscreen works cleanly on both iOS and desktop browsers.
3. `npx tsc --noEmit` and `npm run lint` pass with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit`
- `npm run lint`

### Manual Test Steps
1. On your iPhone, open the room `http://192.168.0.116:3000/room/Q28K88`.
2. Tap the fullscreen button on the screen share player.
3. Confirm no red runtime error overlay appears, and the video expands to fullscreen cleanly.
