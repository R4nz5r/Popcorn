# Implementation Prompt: Interactive Experience Package (Keyboard Shortcuts, Realtime Emoji Reactions, Ambient Cinema Glow, and Audio Cues)

## 1. Goal
Elevate the Watch Together (Popcorn) experience into a vibrant, high-engagement cinema watch-party platform at $0 cost by implementing:
1. **Desktop Keyboard Shortcuts**: Instant play/pause (`Space`), mic toggle (`M`), fullscreen (`F`), and quick seeking (`←`/`→`) with intelligent input-focus suppression.
2. **Realtime Floating Emoji Reactions**: Quick reaction dock (🍿, ❤️, 😂, 😮, 🔥, 👏) that broadcasts floating animated reaction bubbles rising over the video player for everyone in the room.
3. **Ambient Cinema Glow Effect**: Subtle, warm ambient halo around the video player matching the cinema dark mode palette for an immersive theater feel.
4. **Discord-Style Sound Effects**: Lightweight Web Audio synthesized micro-cues for joining voice, leaving voice, muting, and unmuting.

---

## 2. Skills and Documentation Referenced
- `AGENTS.md`: Preservation of web/realtime server boundary, Next.js App Router, sync-only scope, design system adherence.
- Web Audio API specification: `OscillatorNode` and `GainNode` for instant, zero-asset synthesized sound design.
- Socket.io broadcast patterns: Ephemeral `send_reaction` / `receive_reaction` room-scoped events.
- CSS Transitions & Animations: Hardware-accelerated transforms (`translate3d`, `scale`, `opacity`) for smooth 60fps floating emoji animations.

---

## 3. Code Inspected
- `app/room/[code]/page.tsx`: Coordinates room lifecycle, keydown events, video playback, voice state, and layout.
- `server/index.ts`: Realtime Socket.io server handling room events.
- `components/player/PlaybackControls.tsx`: Video player controls bar.
- `components/player/YouTubePlayer.tsx` & `components/player/ScreenSharePlayer.tsx`: Video presentation surfaces.
- `components/voice/VoiceControls.tsx`: Voice party control triggers.

---

## 4. Decisions and Assumptions
1. **Zero-Asset Web Audio Synthesizer**: Instead of loading external MP3/WAV files that can fail, buffer, or add weight, we use a compact Web Audio helper (`lib/sound.ts`) that synthesizes crisp, gentle micro-tones (Discord-style) with zero latency and 0KB bundle payload.
2. **Input-Safe Keyboard Shortcuts**: The shortcut listener strictly ignores keystrokes whenever the active element is an `<input>`, `<textarea>`, or content-editable field (e.g. typing in chat or changing user name).
3. **Hardware-Accelerated Floating Reactions**: Emoji bubbles animate using CSS keyframes and auto-remove from state upon `onAnimationEnd`, ensuring zero memory leak even during high reaction bursts.
4. **Ambient Glow with Zero CPU Drag**: Glow is implemented via CSS blur and radial gradients without reading video canvas frames, maintaining 60fps performance on low-end laptops and mobile phones.

---

## 5. Files to Touch
1. `lib/sound.ts` [NEW]:
   - Web Audio synthesizer generating gentle join, leave, mute, unmute, and pop tones.
2. `components/player/FloatingReactions.tsx` [NEW]:
   - Floating animated emoji container rendered over the video canvas.
   - Quick emoji trigger bar with 🍿, ❤️, 😂, 😮, 🔥, 👏.
3. `server/index.ts`:
   - Socket event `send_reaction` broadcasting `receive_reaction` to the room.
4. `app/room/[code]/page.tsx`:
   - Bind keyboard shortcuts (`Space`, `M`, `F`, `←`, `→`).
   - Listen for `receive_reaction` socket event.
   - Trigger audio cues on voice join/leave/mute state transitions.
   - Add ambient cinema lighting glow wrapper to video canvas.

---

## 6. Security Considerations
- Reactions are strictly sanitized strings matching allowed emoji set or bounded length text to prevent injection.
- Socket broadcast is scoped to `roomId` with rate-limiting debounce on the client (max 5 reactions/sec per user).

---

## 7. Acceptance Criteria
- [ ] Pressing `Space` toggles play/pause without scrolling the page; does nothing while typing in chat or input modals.
- [ ] Pressing `M` toggles microphone mute if connected to voice party.
- [ ] Pressing `F` toggles fullscreen.
- [ ] Pressing `←` or `→` seeks backwards/forwards 5 seconds.
- [ ] Clicking an emoji (e.g. 🍿 or ❤️) displays floating animated reaction on video canvas and broadcasts to all room members in real time.
- [ ] Ambient cinema lighting gives a subtle warm glow behind the video player in dark mode.
- [ ] Joining, leaving, muting, and unmuting voice plays subtle, pleasant audio cues.
- [ ] `npx tsc --noEmit` and `npm run build` pass with 0 errors.

---

## 8. Checks to Run
1. `npx tsc --noEmit`
2. `npm run build`
3. Git status and multi-tab manual test of reactions, shortcuts, and audio cues.

---

## 9. Manual Test Steps
1. Open room on PC and a second device.
2. **Shortcuts Test**:
   - Press `Space` -> verify video pauses/resumes.
   - Click chat input and press `Space` -> verify a space character is typed and video does NOT pause.
   - Press `F` -> verify fullscreen toggles.
   - Press `←` and `→` -> verify video seeks 5s.
3. **Emoji Reactions Test**:
   - Click the 🍿 reaction button -> verify popcorn floats up over player and simultaneously appears on the second device.
4. **Audio Cues Test**:
   - Click "Join Voice" -> verify soft chime plays.
   - Click "Mute" / "Unmute" -> verify subtle feedback clicks play.
5. **Ambient Glow Test**:
   - Toggle dark theme -> verify player has an immersive ambient cinema halo.
