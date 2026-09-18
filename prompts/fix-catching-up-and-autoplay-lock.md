# Implementation Prompt: Fix Catching Up Banner Stuck and Viewer Autoplay Lock

## 1. Goal
Fix the two interconnected issues visible in the user's screenshot:
1. **Viewer Autoplay Lock**: In the viewer (incognito) window, browser autoplay policy blocks unmuted autoplay, showing the red YouTube play button thumbnail. Because custom controls are host-only and the video overlay blocked all clicks, the viewer was completely trapped and could not start playback.
2. **"Catching Up" Banner Stuck**: The "Catching up to the group / Guest 5205 is catching up" banner appeared and stayed stuck on both screens because transient pre-roll buffering was broadcast immediately without waiting for an actual sustained stall, and the trapped viewer never cleared buffering.

---

## 2. Skills & References Read
- `AGENTS.md`:
  - Section 7: "Buffering pauses the room, not just the buffering client. When a peer can't keep up, the UI shows 'others are paused for you' — do not let the room silently drift ahead of someone stuck buffering."
  - Section 9: Player abstraction, sync protocol, and late joiner synchronization.
- Browser Autoplay Policy (Chrome/Edge):
  - Unmuted autoplay requires prior user gesture on the document.
  - Muted autoplay (`mute: 1`) is 100% permitted by all modern browsers.

---

## 3. Code Inspected
- `server/index.ts`:
  - Line 352: `if (isBuffering)` immediately emitted `buffering_state: true` to the entire room before the 1500ms debounce timer ran.
  - Lines 138 & 166: `play` and `pause` events reset `room.pausedByBuffering = false`, but did not emit `buffering_state: { isBuffering: false }` to clear stuck banners.
- `components/player/YouTubePlayer.tsx`:
  - Lines 355-365: The viewer overlay (`<div className="absolute inset-0 z-20 cursor-default" />`) stopped all propagation, preventing user gestures from reaching the player.
  - Line 204: `autoplay: 0` caused the player to sit on the unstarted thumbnail instead of playing in sync.
- `app/room/[code]/page.tsx`:
  - Lines 339-350: User interaction listener only ran on `pointerdown`/`keydown`, but clicking the blocked video overlay did not trigger it.

---

## 4. Decisions and Assumptions
1. **Guaranteed Muted Autoplay on Mount with Instant Click-to-Unmute**:
   - In `YouTubePlayer.tsx`, configure player with `autoplay: 1` and `mute: 1` on initial load for viewers so the video immediately begins playing in sync without getting stuck behind the red YouTube thumbnail.
   - When the viewer clicks anywhere on the video overlay or the page, immediately unmute (`adapter.unMute()`) and set volume.
   - Show a subtle "Click to unmute" pill overlay on the viewer's video if muted, ensuring complete clarity.
2. **Debounce `buffering_state` Emission on Server**:
   - In `server/index.ts`, only broadcast `buffering_state: { isBuffering: true }` when the 1500ms stall timer actually triggers (indicating a genuine sustained network stall, not normal pre-roll).
   - In `play` and `pause` handlers, if any buffering state was active, clear it and broadcast `buffering_state: { isBuffering: false }`.
   - On peer recovery (`isBuffering: false`), broadcast `buffering_state: { isBuffering: false }`.

---

## 5. Files Expected to Touch
- `server/index.ts` (MODIFY: broadcast `buffering_state: true` only after 1500ms stall, clear buffering state on play/pause)
- `components/player/YouTubePlayer.tsx` (MODIFY: enable autoplay with mute, make viewer overlay unlock audio/play on click, add unmute pill)
- `app/room/[code]/page.tsx` (MODIFY: ensure user gesture unlocks audio and sync)

---

## 6. Requirements
- The viewer window automatically plays in sync with the host upon loading (no stuck red YouTube button).
- The "Catching up to the group" banner does NOT appear during normal playback start, seek, or pre-roll.
- The banner only appears if a participant suffers a genuine sustained stall (>1.5s), and disappears immediately upon recovery.
- Clicking anywhere on the viewer's video un-mutes and locks audio to the host.
- Zero TypeScript errors (`npx tsc --noEmit`).
- Zero ESLint errors (`npm run lint`).
- Successful Next.js build (`npm run build`).

---

## 7. Security Considerations
- Ensure viewer cannot seek or pause when clicking the video to unmute.

---

## 8. Acceptance Criteria
- [ ] Viewer window immediately starts playing the video in lockstep with the host (no red play button trap).
- [ ] Viewer has audio (or clicks to unmute if browser initially blocked sound).
- [ ] Neither host nor viewer shows the "catching up" banner during standard playback.
- [ ] `npx tsc --noEmit` passes with 0 errors.
- [ ] `npm run lint` passes with 0 errors.
- [ ] `npm run build` succeeds without errors.

---

## 9. Checks to Run
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- Multi-client automated test script.

---

## 10. Exact Manual Test Steps
1. Open Host tab at `http://localhost:3000/room/[code]` with a video playing.
2. Open Peer tab (Incognito) at the same room URL.
3. Verify the Peer tab immediately starts playing the video in sync without showing a stuck red YouTube button.
4. Verify neither screen shows the "Catching up to the group" banner during normal playback.
5. Click anywhere on the Peer tab: verify sound plays cleanly.
