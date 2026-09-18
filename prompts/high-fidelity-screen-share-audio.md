# Implementation Prompt: High-Fidelity Audio Mode for Screen Sharing (Desktop & VLC Media Support)

## Goal
Fix muffled, distorted, hollow, and missing-dialogue audio when sharing desktop applications (such as VLC media player, games, or local videos) by disabling VoIP speech filtering algorithms (echo cancellation, noise suppression, auto gain control) and enforcing stereo capture in the WebRTC screen share stream.

---

## Skills Read & Inspected
- `AGENTS.md`:
  - Section 5: Client / Realtime boundaries.
  - Section 10: Multi-tab manual verification and type checks.
  - Section 12: Preserve existing boundaries; don't break existing features.

---

## Code Inspected
1. `lib/webrtc/WebRTCManager.ts`:
   - Line 66-71: Calls `navigator.mediaDevices.getDisplayMedia` with `audio: true`.
   - When `audio: true` is passed as a boolean, Chromium applies default teleconferencing filters:
     - `noiseSuppression: true`: Cuts out music, background instruments, bass, and sound effects, treating them as ambient noise.
     - `echoCancellation: true`: Generates flanging / hollow phasing artifacts.
     - `autoGainControl: true`: Causes volume fluctuations.
     - `channelCount: 1`: Downmixes to mono voice channel.

---

## Decisions and Assumptions
1. **Studio/High-Fidelity Audio Constraints**:
   - Explicitly configure `audio` constraints in `getDisplayMedia`:
     ```ts
     audio: {
       echoCancellation: false,
       noiseSuppression: false,
       autoGainControl: false,
       channelCount: 2,
     }
     ```
   - Provide a safe fallback to `{ video: true, audio: true }` in case a browser or platform rejects specific audio constraint keys.
2. **Preserve Compatibility**:
   - Screen sharing Chrome tabs will continue to work seamlessly.
   - Desktop windows and system audio (VLC, Spotify, local games/players) will now stream full-frequency music, sound effects, and dialogue without voice ducking.
3. **No Breaking Changes**:
   - Zero changes to YouTube video sync, room state, chat, or socket protocols.

---

## Files to Touch
1. `lib/webrtc/WebRTCManager.ts`
   - Update `startScreenShare()` to pass high-fidelity audio constraints with graceful fallback.

---

## Security Considerations
- Screen capture still requires explicit user consent through the browser's native `getDisplayMedia` permission prompt.
- End-to-end media encryption (DTLS-SRTP) remains fully active.

---

## Acceptance Criteria
1. When sharing a desktop app (VLC media player, browser, or entire screen with audio):
   - Music, sound effects, and speech are captured cleanly without robotic distortion, underwater gating, or phasing.
   - Stereo separation is preserved.
2. If a browser does not support specific constraint flags, capture falls back gracefully to standard audio capture without throwing an uncaught error.
3. `npx tsc --noEmit` and `npm run lint` pass with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit`
- `npm run lint`

### Manual Test Steps
1. Open Room in two tabs: Tab A and Tab B.
2. In Tab A, click **"Share screen"**.
3. Select a window or screen playing a video with music and sound effects (such as VLC or a local media player) with audio sharing enabled.
4. In Tab B, listen to the audio stream and confirm the audio is clear, crisp, and free of the underwater noise-suppression flutter.
