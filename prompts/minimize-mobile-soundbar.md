# Implementation Prompt: Minimize Mobile Sound Bar & Expand on Sound Logo Tap

## Goal
On mobile screens (`< 640px` / Tailwind `< sm`), minimize (collapse) the volume sound bar by default so that the playback scrubber bar has significantly more horizontal space and touch comfort. When the user taps the sound logo (speaker icon), expand the sound bar smoothly. Tapping the sound logo again or tapping outside collapses it back. On desktop (`>= 640px`), the sound bar remains visible and clicking the sound logo toggles mute as normal.

---

## Skills Read & Inspected
- `AGENTS.md`: Section 3 (mobile responsive layout & exact mockups), Section 7 (host authority and player states), Section 10 (checks to run), Section 12 (conventions & approval loop).
- `components/player/PlaybackControls.tsx`: Playback controls bar, sound button, volume slider, touch event handlers.
- `components/player/ScreenSharePlayer.tsx`: Secondary video player controls for screen share audio.

---

## Code Inspected & Root Cause Analysis
- In `components/player/PlaybackControls.tsx`:
  - Lines 260–318 render the sound logo button (`onToggleMute`) and the volume bar (`w-16 sm:w-20`).
  - On mobile screens, having `w-16` (64px) permanently visible alongside the play button, fullscreen button, and host badge crowds the progress scrubber bar down to a very narrow width, making scrubbing difficult and cramped.
- User Decision:
  - First tap on the sound logo on mobile reveals the sound bar.
  - Tapping the logo again or tapping outside minimizes it.
  - Muting on mobile is done by dragging the volume slider to 0.
  - Desktop retains the existing behavior: volume slider is always visible (`sm:w-20 sm:opacity-100`) and clicking the sound logo toggles mute.

---

## Decisions and Assumptions
1. **State & Mobile Detection**:
   - Introduce `isMobileVolumeOpen` state (`useState(false)`) in `PlaybackControls.tsx`.
   - On sound logo click:
     - Check `window.innerWidth < 640`: if mobile, toggle `isMobileVolumeOpen`.
     - If desktop (`>= 640px`), invoke `onToggleMute?.()`.
2. **Animation & Space Optimization**:
   - When collapsed on mobile (`!isMobileVolumeOpen`):
     - Classes: `w-0 opacity-0 pointer-events-none overflow-hidden ml-0` (takes 0 horizontal layout space).
   - When expanded on mobile (`isMobileVolumeOpen`):
     - Classes: `w-16 opacity-100 pointer-events-auto overflow-visible ml-1.5`.
   - Desktop override (`sm:`):
     - `sm:w-20 sm:opacity-100 sm:pointer-events-auto sm:ml-1.5 sm:overflow-visible`.
   - Add `transition-all duration-200 ease-out` for smooth expansion and collapse.
3. **Click Outside Handling**:
   - Attach a `pointerdown` listener to `document` when `isMobileVolumeOpen` is true.
   - If a click/touch falls outside the volume container ref (and `isDraggingVolume` is false), close `isMobileVolumeOpen(false)`.
4. **ScreenSharePlayer Consistency**:
   - Apply the matching collapsible mobile volume slider pattern to `ScreenSharePlayer.tsx` for visual and functional consistency across both player surfaces.

---

## Files to Touch
1. `components/player/PlaybackControls.tsx` (MODIFY: add `isMobileVolumeOpen`, mobile toggle on sound logo, outside-click listener, responsive collapsible styling for the volume slider).
2. `components/player/ScreenSharePlayer.tsx` (MODIFY: add matching mobile volume collapse/expand behavior for the screen share player controls).

---

## Acceptance Criteria
- [ ] On mobile screens (`< 640px`), the sound bar is collapsed by default and only the speaker icon is shown.
- [ ] Tapping the sound logo on mobile smoothly reveals the volume slider.
- [ ] Touching/dragging the slider adjusts the volume cleanly.
- [ ] Tapping the sound logo again collapses the volume slider.
- [ ] Tapping anywhere outside the volume controls collapses the volume slider.
- [ ] On desktop screens (`>= 640px`), the volume slider remains visible at all times, and clicking the sound logo toggles mute.
- [ ] `npx tsc --noEmit` passes with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit`
- `npm run build`

### Manual Test Steps
1. Open room on mobile viewport (e.g. 390px width in devtools or on phone).
2. Observe that the volume slider is collapsed and the progress scrubber has plenty of horizontal room.
3. Tap the sound logo: verify the volume slider expands smoothly.
4. Drag the volume slider to change volume: verify it updates correctly without closing.
5. Tap the sound logo again: verify the slider smoothly collapses.
6. Tap the sound logo to open, then tap elsewhere on the video or page: verify the slider collapses.
7. Switch to desktop viewport (>= 640px): verify the slider is permanently visible and clicking the sound logo toggles mute.
