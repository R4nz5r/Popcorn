# Implementation Prompt: P2P WebRTC Audio-Only Voice Party (Discord-Style)

## Goal
Implement a lightweight, high-performance, Peer-to-Peer (P2P) WebRTC Audio-Only Voice Party in Watch Together. Room participants can join a shared voice channel directly in the watch room, mute/unmute their microphone, toggle deafen, see active speaker rings, and talk with low latency without interfering with YouTube video sync, screen sharing, or chat.

---

## Skills Read & Inspected
- `AGENTS.md`:
  - Section 1 & 7: "This product is sync-only. There is no local file upload." WebRTC voice is ephemeral peer-to-peer audio streaming directly between browsers. No audio files are recorded, stored, or rehosted.
  - Section 5: Realtime server vs web app responsibilities. Long-running Node.js/Socket.io process handles signaling; browsers handle audio streams directly.
  - Section 8: Ephemeral room state and connected peers model.
  - Section 9 & 10: Multi-tab verification; sync protocol isolation.
  - Section 12: Preserve existing boundaries; don't break existing features.

---

## Code Inspected
1. `server/index.ts`:
   - Contains Socket.io server logic, peer management (`room.peers`), and signaling events.
   - Currently has screen share signaling (`webrtc_signal`, `screen_share_start`, `screen_share_stop`).
   - We will introduce dedicated voice signaling events (`voice_join`, `voice_leave`, `voice_signal`, `voice_state_update`) to ensure 100% isolation from screen sharing and YouTube sync.
2. `lib/webrtc/WebRTCManager.ts`:
   - Handles screen share WebRTC connections. We will keep this untouched or decoupled so voice calling lives in its own dedicated `lib/webrtc/VoiceCallManager.ts`.
3. `components/room/ParticipantList.tsx`:
   - Renders watching counts and user avatar stack.
   - We will enhance it to show voice channel status (connected to voice, muted badge, active speaking green glow ring).
4. `app/room/[code]/page.tsx`:
   - Room layout, desktop header nav, mobile dropdown menu, and socket event handling.
   - We will integrate the voice controls (Join Voice, Mute/Unmute, Deafen, Leave) in the header navigation and mobile menu.

---

## Decisions and Assumptions
1. **100% Free / Zero Infrastructure Cost ($0 Budget)**:
   - Signaling uses the existing Socket.io connection.
   - STUN uses Google's public, free STUN servers.
   - Audio is transmitted peer-to-peer (mesh network) using the Opus audio codec. Server bandwidth for audio is 0 bytes.
2. **Complete Isolation from YouTube Sync & Screen Sharing**:
   - Voice audio uses dedicated socket events and independent `RTCPeerConnection` instances.
   - YouTube video playback, sync heartbeats, buffering pause logic, and screen sharing will run unaffected.
   - Presenters can screen share *with* audio while talking in the voice channel simultaneously.
3. **Echo Cancellation & Audio Quality**:
   - `navigator.mediaDevices.getUserMedia` will request audio with:
     - `echoCancellation: true` (prevents YouTube audio from leaking back into mic)
     - `noiseSuppression: true`
     - `autoGainControl: true`
4. **Speaking Detection**:
   - A lightweight `AudioContext` with an `AnalyserNode` measures real-time audio volume levels to trigger speaker indicators (e.g. pulsing green border on speaking avatars) with debouncing.
5. **Clean Room & Disconnect Lifecycle**:
   - When a user leaves the room, closes the tab, or navigates away, the voice session cleans up instantly on both client and server, notifying peers.

---

## Files to Touch
1. `server/index.ts`:
   - Track `voicePeers` set/map per room (userId, socketId, isMuted, isSpeaking).
   - Add Socket.io handlers:
     - `voice_join`: adds socket to voice channel, broadcasts `voice_users_changed` to the room, emits system chat message.
     - `voice_leave`: removes socket from voice channel, broadcasts `voice_users_changed`, emits system chat message.
     - `voice_signal`: forwards `{ toSocketId, fromSocketId, signal }` directly to target peer.
     - `voice_state_update`: updates muted/speaking state and broadcasts to room.
   - On peer disconnect/leave, automatically remove user from `voicePeers` and emit `voice_users_changed`.
2. `lib/webrtc/VoiceCallManager.ts` (New file):
   - Manages local microphone stream, audio tracks, and peer connections (`RTCPeerConnection` mesh).
   - Manages remote `<audio>` elements for peers.
   - Provides mic mute, deafen, volume monitoring, and cleanup methods.
3. `components/voice/VoiceControls.tsx` (New file):
   - Responsive voice action buttons:
     - "Join Voice" button when disconnected.
     - Connected pill: Mute/Unmute mic button, Deafen/Undeafen button, Leave voice button.
4. `components/room/ParticipantList.tsx`:
   - Accept voice status props (`voiceUsers`, `speakingUsers`, `mutedUsers`).
   - Display mic-muted icons on avatars and active speaking pulsing green rings.
5. `app/room/[code]/page.tsx`:
   - Initialize and wire `VoiceCallManager`.
   - Render `VoiceControls` in the desktop header and mobile menu dropdown.
   - Pass voice statuses to `ParticipantList`.

---

## Security & Privacy Considerations
- Microphone access requires explicit browser permission prompt via `getUserMedia`.
- Microphone tracks are completely stopped when leaving the voice channel or leaving the room.
- WebRTC media traffic is end-to-end encrypted (DTLS-SRTP).

---

## Acceptance Criteria
1. **Join & Leave Voice**:
   - Clicking "Join Voice" prompts for microphone permission.
   - Once permitted, user joins the voice room.
   - Other users in the room see the user join the voice channel (with chat system notice).
   - Clicking "Leave" disconnects all peer connections and stops the microphone.
2. **Audio Transmission**:
   - Two or more users in the voice room can hear each other speaking with low latency.
3. **Mute & Deafen Controls**:
   - Clicking "Mute" disables the local microphone track and updates the avatar icon for everyone in the room.
   - Clicking "Deafen" mutes incoming remote audio and also mutes outgoing mic.
4. **Active Speaker Indicator**:
   - When a user speaks, an animated green ring appears around their avatar in the participant list.
5. **No Interference with YouTube or Screen Sharing**:
   - YouTube video play/pause/seek sync works flawlessly while talking in the voice party.
   - Screen sharing can be started or stopped without interrupting the voice call.
6. **Graceful Disconnects**:
   - Closing a browser tab or navigating back home cleans up peer connections on other participants' screens immediately.

---

## Checks to Run
1. TypeScript type-check: `npm run build` or `npx tsc --noEmit`
2. ESLint check: `npm run lint`
3. Multi-tab verification: Open 2 browser tabs in the same room, join voice, verify mic mute, speaking indicator, and synchronized YouTube playback.
