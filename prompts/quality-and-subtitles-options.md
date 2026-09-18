# Implementation Prompt: YouTube Player Settings (Quality & Subtitles / CC)

## Goal
Enable YouTube player settings (the Settings gear ⚙ for Quality and Playback Speed, Subtitles / Closed Captions [CC], and Fullscreen controls) as shown in the YouTube reference screenshot (1st pic), replacing the restricted `controls: 0` embed state that lacked settings and displayed the "More videos" / unstarted overlay (2nd pic). Ensure two-way synchronization between YouTube's native player events and Watch Together's custom playback controls.

---

## Skills and Docs Inspected
- `AGENTS.md`: Section 6 (Tech stack - YouTube IFrame Player API), Section 7 (Decisions already made - player abstraction), Section 10 (Sync protocol - player-agnostic interface), Section 12 (Checks to run).
- `YouTube IFrame Player API Documentation`:
  - `playerVars`: `controls: 1` enables the native control overlay with settings gear (⚙), `cc_load_policy: 1` enables subtitle options, `fs: 1` enables fullscreen, `enablejsapi: 1` allows programmatic bridge, `rel: 0` restricts related videos.
  - Quality API note: `setPlaybackQuality()` was deprecated by YouTube and manual video quality selection (1080p, 720p, etc.) is only available through YouTube's native settings gear menu.
  - Subtitles API: closed captions are accessible via the native `[CC]` toggle and settings language selector.

---

## Code Inspected
- `components/player/YouTubePlayer.tsx`:
  - Currently initializes `YT.Player` with `controls: 0`, `fs: 0`, `disablekb: 1`. This completely suppresses the native bottom bar, removing the Settings gear (⚙) and Closed Captions (`[CC]`), causing YouTube to show its paused overlay with "More videos" and channel watermark instead of player settings.
  - Lifecycle and event hooks (`onReady`, `onStateChange`, `onTimeUpdate`, `onError`) are already wired to `callbacksRef` and `playerRef`.
- `components/player/PlaybackControls.tsx`:
  - Renders custom controls below the video (`Play/Pause`, `00:00 / 00:00`, Scrubber Bar, Volume Bar, Synced badge).
- `app/room/[code]/page.tsx`:
  - Connects `YouTubePlayer` callbacks (`onStateChange`, `onTimeUpdate`, `onError`) to state variables (`isPlaying`, `currentTime`, `duration`, `videoError`).

---

## Decisions and Assumptions
1. **Enable Native YouTube Player Controls (`controls: 1`)**:
   - Setting `controls: 1`, `cc_load_policy: 1`, and `fs: 1` in `playerVars` renders YouTube's player interface (like Picture 1), providing users with direct access to:
     - The **Settings Gear (⚙)**: Video Quality selection (1080p, 720p, 480p, Auto), Playback Speed (0.25x – 2x), and Subtitles/CC language options.
     - The **Subtitles Button (`[CC]`)**: Instant toggle for captions.
     - The **Fullscreen Button**: Fullscreen video viewing.
   - Eliminates the static embed overlay that showed "More videos" and "Share" from Picture 2.
2. **Two-Way Synchronization**:
   - User actions inside the YouTube player (clicking Play/Pause, seeking via scrubber, changing volume) trigger `onStateChange` and time updates, which immediately update Watch Together's custom `PlaybackControls` bar.
   - User actions inside Watch Together's custom `PlaybackControls` bar (Play/Pause button, scrubber drag, volume bar, mute) call the `PlayerAdapter` (`play()`, `pause()`, `seekTo()`, `setVolume()`), keeping YouTube in perfect lockstep.
3. **Preserve Watch Together Design & Custom Controls Bar**:
   - The custom control bar below the video remains intact per `design/2-watch-room.jpg` to display the "Synced" badge, room time, and serve as the synchronized group control surface.

---

## Files to Touch
1. `components/player/YouTubePlayer.tsx`:
   - Update `playerVars` to:
     - `controls: 1`: display YouTube player controls with Settings gear (⚙) and Quality menu.
     - `cc_load_policy: 1`: enable captions / subtitles option.
     - `fs: 1`: allow fullscreen.
     - `disablekb: 0`: allow standard player interaction.
     - `modestbranding: 1`, `rel: 0`, `enablejsapi: 1`, `playsinline: 1`.
2. `lib/player/types.ts` (if needed for extended controls):
   - Keep `PlayerAdapter` interface clean and backwards-compatible.

---

## Requirements
- The YouTube video player must show YouTube's player controls including the Settings gear icon (⚙) and Subtitles (`[CC]`) button as shown in Picture 1.
- Clicking the Settings gear (⚙) in the player must display options for Quality (1080p, 720p, 480p, 360p, etc.), Playback Speed, and Subtitles.
- Clicking Subtitles (`[CC]`) must toggle closed captions on the video.
- The player must not show the undesirable unstarted embed screen with "More videos" from Picture 2.
- Both the player's internal controls and Watch Together's bottom controls bar must remain synchronized without fighting or causing state loops.

---

## Security Considerations
- Keep `enablejsapi: 1` and `origin: window.location.origin` to satisfy YouTube IFrame API origin requirements and prevent cross-site scripting.
- Restrict `rel: 0` so YouTube does not recommend unrelated external videos.

---

## Acceptance Criteria
- [ ] The YouTube player displays the native controls bar with Settings gear (⚙) and Subtitles (`[CC]`).
- [ ] Users can change video quality (e.g., 1080p, 720p, etc.) via the player's Settings gear.
- [ ] Users can toggle and select captions/subtitles via `[CC]` / Settings.
- [ ] The player no longer shows the "More videos" paused embed screen from Picture 2.
- [ ] Playing, pausing, and seeking through either YouTube's interface or Watch Together's control bar updates both seamlessly.
- [ ] `npx tsc --noEmit` and `npm run lint` pass with 0 errors.

---

## Checks to Run
- `npx tsc --noEmit` (TypeScript type check).
- `npm run lint` (ESLint verification).

---

## Exact Manual Test Steps
1. Navigate to an active room (e.g. `http://localhost:3000/room/CDJF7B`).
2. Add an embeddable YouTube video if none is active (or verify current video).
3. Hover over the video player:
   - Verify the bottom bar shows the Settings gear (⚙), Subtitles (`[CC]`), and Fullscreen button (matching Picture 1).
4. Click the Settings gear (⚙):
   - Confirm the popover menu opens with "Quality" and "Playback speed".
   - Select a different quality resolution (e.g. 720p or 480p) and verify video switches cleanly.
5. Click the Subtitles (`[CC]`) button:
   - Confirm subtitles/captions appear on the video for supported content.
6. Play and pause from both the YouTube controls and the Watch Together bottom control bar:
   - Confirm state reflects in both places.
