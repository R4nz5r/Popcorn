# Implementation Prompt: Disable Native YouTube Player Controls for Viewers

## 1. Goal
Prevent non-host viewers from pausing, seeking, or scrubbing the video directly via YouTube's built-in player controls (the red scrubber bar, center play/pause button, etc.), while preserving the host's ability to control playback:
1. Pass `isHost` to `YouTubePlayer`.
2. For viewers (`!isHost`), set `controls: 0` and `disablekb: 1` in YouTube's `playerVars` so native player controls are hidden.
3. For viewers (`!isHost`), place a transparent click-interceptor overlay on top of the video container (`<div className="absolute inset-0 z-20 cursor-default" />`) so viewers cannot click the iframe to pause or scrub.
4. Keep the host's video container interactive with standard controls (`controls: 1`, `disablekb: 0`).

---

## 2. Skills & References Read
- `AGENTS.md`:
  - Section 7: "Sync is host-authoritative, not consensus-based. One client per room is the clock source; everyone else's player is corrected against it."
  - Section 9: Player abstraction and sync protocol.
- YouTube IFrame Player API parameters:
  - `controls: 0` hides player controls.
  - `disablekb: 1` disables keyboard controls for the player.

---

## 3. Code Inspected
- `components/player/YouTubePlayer.tsx`:
  - Lines 203-214: `playerVars` hardcodes `controls: 1` and `disablekb: 0` for all viewers.
  - Lines 354-360: Container wraps the iframe element without an interaction shield for non-hosts.
- `app/room/[code]/page.tsx`:
  - Lines 650-715: `YouTubePlayer` does not pass `isHost`.

---

## 4. Decisions and Assumptions
1. **`isHost` Prop on `YouTubePlayer`**:
   - `YouTubePlayerProps` will accept `isHost?: boolean` (defaults to `true`).
2. **Native YouTube Controls Configuration**:
   - For host (`isHost = true`): `controls: 1`, `disablekb: 0`.
   - For viewers (`isHost = false`): `controls: 0`, `disablekb: 1`.
3. **Transparent Interaction Shield for Viewers**:
   - When `!isHost`, render a transparent shield over the video container:
     `<div className="absolute inset-0 z-20 cursor-default" title="Only host controls playback" />`
   - Blocks all pointer events from reaching the YouTube iframe, completely preventing direct pause/seek clicks on the viewer's screen.

---

## 5. Files Expected to Touch
- `components/player/YouTubePlayer.tsx` (MODIFY: accept `isHost`, set `controls: isHost ? 1 : 0`, add click interceptor overlay for viewers)
- `app/room/[code]/page.tsx` (MODIFY: pass `isHost` to `YouTubePlayer`)

---

## 6. Requirements
- Host can interact with YouTube controls or custom controls normally.
- Viewer cannot click, scrub, or pause the YouTube video directly.
- Viewer video remains 100% synchronized with the host's playback.
- Viewer volume and mute remain controllable via the custom playback bar.
- Zero TypeScript errors (`npx tsc --noEmit`).
- Zero ESLint errors (`npm run lint`).
- Successful Next.js build (`npm run build`).

---

## 7. Security Considerations
- Purely presentation and interaction isolation. Server-side host authorization (already implemented in `server/index.ts`) continues to guarantee that non-hosts cannot emit sync state mutations.

---

## 8. Acceptance Criteria
- [ ] On viewer screen, native YouTube controls (red scrub bar, play/pause overlay) are hidden.
- [ ] Clicking on the viewer's video frame does not pause or seek the video.
- [ ] Host screen can still control playback seamlessly.
- [ ] Viewer's player stays in sync with host.
- [ ] `npx tsc --noEmit` passes with 0 errors.
- [ ] `npm run lint` passes with 0 errors.
- [ ] `npm run build` succeeds without errors.

---

## 9. Checks to Run
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

---

## 10. Exact Manual Test Steps
1. Open Host tab at `http://localhost:3000/room/[code]`.
2. Open Peer tab (Incognito) at the same URL.
3. On Peer tab:
   - Try clicking anywhere on the video area: verify video does NOT pause.
   - Hover over the video: verify YouTube's native red scrubber bar does not appear.
4. On Host tab:
   - Click Play, Pause, and Seek: verify both screens stay in lockstep sync.
