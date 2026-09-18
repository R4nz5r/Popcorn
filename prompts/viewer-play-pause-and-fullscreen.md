# Implementation Prompt: Viewer Play/Pause Control and Fullscreen Support

## 1. Goal
1. **Restore Play/Pause Capability for Viewers**: Re-enable the Play/Pause button on the custom playback controls bar for normal users so that viewers are never trapped on a paused/unstarted screen, and allow viewers to play and pause playback.
2. **Add Fullscreen Option**: Add a dedicated Fullscreen toggle button on the playback controls bar for both host and normal users that toggles fullscreen mode on the video container using the standard HTML5 Fullscreen API.
3. **Fix Viewer Playability Trap**: In `app/room/[code]/page.tsx` and `components/player/YouTubePlayer.tsx`, eliminate the rigid `!isHost` block in `onStateChange` that was instantly forcing the player to re-pause whenever a viewer attempted to play, and allow clicking the video to toggle play/pause and unmute.
4. **Preserve Timeline Integrity**: Keep timeline scrubber seeking (`onSeek`) and changing video (`set_video`) host-exclusive so normal users cannot skip or fast-forward the party's timeline.

---

## 2. Skills & References Read
- `AGENTS.md`:
  - Section 1: "Everyone who joins sees the same video, at the same playback position, at the same time — play, pause, and seek by any participant apply to everyone."
  - Section 3: UI reference reproduction and responsive layout.
  - Section 9: Player abstraction and sync protocol.
- HTML5 Fullscreen API:
  - `element.requestFullscreen()` and `document.exitFullscreen()`.
  - `document.fullscreenElement` and `fullscreenchange` event.

---

## 3. Code Inspected
- `components/player/PlaybackControls.tsx`:
  - Line 158: Play/Pause button had `disabled={!isHost}` and `opacity-40 cursor-not-allowed`, preventing normal users from clicking Play/Pause.
  - Lines 230-285: Missing a fullscreen toggle button.
- `app/room/[code]/page.tsx`:
  - Line 374: `handlePlayPause` had `if (!isHost) return;`.
  - Lines 693-705: `onStateChange` had a guard that forced `playerAdapter.pause()` if `!isHost && desiredPlayState !== playing`.
- `server/index.ts`:
  - Lines 141 & 175: Server rejected `play` and `pause` from non-host peers.

---

## 4. Decisions and Assumptions
1. **Play/Pause for Normal Users (`PlaybackControls.tsx` & `page.tsx` & `server/index.ts`)**:
   - The Play/Pause button is enabled for all users (`disabled={false}`).
   - When a normal user clicks Pause, playback pauses for the room (or client).
   - When a normal user clicks Play, playback resumes in sync with the room.
   - `server/index.ts` accepts `play` and `pause` from all room participants, while keeping `seek` and `set_video` host-only.
2. **Fullscreen Toggle (`PlaybackControls.tsx` & `page.tsx`)**:
   - Add `onToggleFullscreen` and `isFullscreen` props to `PlaybackControlsProps`.
   - Add a fullscreen button icon (standard 4-corner expand/collapse icon) in `PlaybackControls` next to the volume controls.
   - In `page.tsx`, wrap the video player in a `videoContainerRef` and implement `handleToggleFullscreen()` using `requestFullscreen()` and `exitFullscreen()`.
3. **Viewer Video Click Interaction (`YouTubePlayer.tsx`)**:
   - When a viewer clicks the video overlay, toggle play/pause and unmute audio.
   - Remove the forced-pause block in `onStateChange` so normal users can transition smoothly between playing and paused states.

---

## 5. Files Expected to Touch
- `components/player/PlaybackControls.tsx` (MODIFY: enable Play/Pause for all users, add Fullscreen toggle button)
- `app/room/[code]/page.tsx` (MODIFY: enable `handlePlayPause` for all users, implement `handleToggleFullscreen`, fix `onStateChange`)
- `components/player/YouTubePlayer.tsx` (MODIFY: video overlay toggles play/pause on click)
- `server/index.ts` (MODIFY: allow `play` and `pause` from all room peers; keep `seek` and `set_video` host-only)

---

## 6. Requirements
- Normal users can click Play and Pause from the control bar and video overlay.
- Normal users and host have a Fullscreen button that toggles full-screen video viewing.
- Timeline scrubbing (seeking) remains host-only so viewers cannot fast-forward or skip the room's timeline.
- Viewer's video plays reliably without getting stuck or locked on pause.
- Zero TypeScript errors (`npx tsc --noEmit`).
- Zero ESLint errors (`npm run lint`).
- Successful Next.js build (`npm run build`).

---

## 7. Security Considerations
- Validate fullscreen permissions safely with browser vendor prefix fallbacks if needed.
- Server validates that room exists and socket belongs to the room before broadcasting play/pause.

---

## 8. Acceptance Criteria
- [ ] Normal user screen can click Play to play the video.
- [ ] Normal user screen can click Pause to pause the video.
- [ ] Both host and normal user have a working Fullscreen button that expands the video to fill the display.
- [ ] Timeline scrubber remains host-only (viewers cannot scrub timeline).
- [ ] `npx tsc --noEmit` passes with 0 errors.
- [ ] `npm run lint` passes with 0 errors.
- [ ] `npm run build` succeeds without errors.

---

## 9. Checks to Run
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- Multi-client automated sync test.

---

## 10. Exact Manual Test Steps
1. Open Host tab at `http://localhost:3000/room/[code]`.
2. Open Peer tab (Incognito) at the same room URL.
3. On Peer tab:
   - Click the Play button on the control bar: verify the video plays!
   - Click the Pause button on the control bar: verify the video pauses!
   - Click the new Fullscreen button: verify the video expands to fullscreen, and pressing Escape exits fullscreen.
   - Try dragging the timeline scrubber: verify scrubbing is locked for the peer.
4. On Host tab:
   - Verify timeline scrubbing and video controls work as expected.
