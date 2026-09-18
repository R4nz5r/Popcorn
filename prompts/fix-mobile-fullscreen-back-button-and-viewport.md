# Implementation Prompt: Fix Mobile Fullscreen Back Button & Viewport Toolbar Clipping

## Goal
Fix the mobile fullscreen mode so that:
1. A clear, floating **"← Back" / "Exit Fullscreen"** button is added at the top-left of the screen in fullscreen mode so the user can easily exit fullscreen with a single tap.
2. The bottom controls bar (which contains play/pause, scrubber, volume, and fullscreen toggle) is fully visible above Safari's bottom dynamic address bar by using dynamic viewport height (`100dvh`) and safe-area padding (`env(safe-area-inset-bottom)`).
3. The video player scales appropriately within the available height so that both the video and the controls fit comfortably within the viewport on any mobile device.

---

## Skills Read & Inspected
- `AGENTS.md`: Section 3 (mobile responsive layout & exact mockups), Section 7 (host authority and player states), Section 10 (checks to run).
- `app/room/[code]/page.tsx`: Fullscreen layout container and video area styles.
- `components/player/PlaybackControls.tsx`: Playback controls bar and fullscreen toggle.

---

## Code Inspected & Root Cause Analysis
- **The Issue in Picture 2**:
  1. `h-screen` (`100vh`) on iOS Safari calculates height based on the maximum screen height, disregarding the Safari browser chrome / address bar at the bottom. As a result, the bottom ~70px of the container is hidden underneath the browser toolbar, clipping the `PlaybackControls` bar.
  2. The container uses `overflow-hidden`, preventing the user from scrolling down to see the obscured controls.
  3. There is no visible top navigation or back button when entering fullscreen, leaving users with no obvious way to return to the room view.
- **The Solution**:
  1. Add a floating **`← Back`** button at the top-left (`absolute top-3 left-3 sm:top-5 sm:left-5 z-50`) when in fullscreen (`isFullscreen || isCssFullscreen`), styled with a frosted dark pill (`bg-black/70 backdrop-blur-md border border-white/20 text-white`) that triggers `handleToggleFullscreen`.
  2. Change fullscreen container height from `h-screen` to `h-[100dvh] w-screen fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden`.
  3. Add safe area bottom padding to the controls area: `pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]` so the controls bar floats cleanly above Safari's navigation bar on all iPhones and Android devices.
  4. Ensure the video container area uses `flex-1 min-h-0 flex items-center justify-center` so the video scales responsively without pushing the bottom controls out of the viewport.

---

## Decisions and Assumptions
- Use `100dvh` (dynamic viewport height) with `env(safe-area-inset-bottom)` to guarantee the entire interface fits within the visible screen area regardless of whether browser toolbars expand or collapse.
- Provide both the top **`← Back`** button and the bottom controls bar's fullscreen button so users can exit easily from either location.

---

## Files to Touch
1. `app/room/[code]/page.tsx` (MODIFY: add top floating `← Back` button in fullscreen mode, update fullscreen container to `h-[100dvh]` with safe-area padding).

---

## Acceptance Criteria
- [ ] In fullscreen mode on iPhone / mobile, a floating **`← Back`** button is clearly visible at the top-left.
- [ ] Tapping the **`← Back`** button exits fullscreen and returns to the normal room view.
- [ ] The custom `PlaybackControls` bar at the bottom is 100% visible and accessible above the mobile browser's bottom address bar.
- [ ] The video scales cleanly in both portrait and landscape orientation without overflowing or clipping the controls.
- [ ] `npx tsc --noEmit` and `npm run build` pass with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit` to verify type safety.
- `npm run build` to verify Next.js production build passes.

### Manual Test Steps
1. Open a room at `https://popcorn.ragibshahrier.com` on iPhone Safari.
2. Tap the **Fullscreen** button in the controls bar.
3. Verify:
   - The top-left displays a floating **`← Back`** button.
   - The bottom controls bar is completely visible above the Safari toolbar.
4. Tap the **`← Back`** button: verify it instantly exits fullscreen.
