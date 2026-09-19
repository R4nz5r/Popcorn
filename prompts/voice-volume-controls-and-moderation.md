# Implementation Prompt: Voice Volume Controls, Individual Mute, and Host Moderation

## 1. Goal
Empower users and room hosts with granular voice audio controls:
1. **Self Voice Input Control**: Adjust microphone input gain (0% to 150%) with a real-time live mic test level meter.
2. **Individual User Volume & Local Mute**: Click on any participant in the Participant List (or use the Voice Mixer) to set that user's volume (0% to 100%) or toggle "Mute for me" locally without affecting anyone else.
3. **Host Voice Moderation**: Allow the room host to silence a noisy participant in the room ("Mute in Room") or mute all participant microphones at once ("Mute All Mics") when watching a movie. Participants receive an informative notice and can unmute themselves when they wish to speak (preserving user privacy).

---

## 2. Skills and Documentation Referenced
- `AGENTS.md`: Technical boundaries, Next.js App Router conventions, realtime server on Railway, host authority, graduated drift correction, sync-only scope.
- Web Audio API specification: `GainNode`, `MediaStreamAudioDestinationNode`, `AnalyserNode` for input gain scaling and VU metering.
- HTMLMediaElement & WebRTC specifications: `HTMLAudioElement.volume`, `HTMLAudioElement.muted` for zero-overhead local volume/muting per peer.
- Socket.io event design: room-scoped moderation events with host validation.

---

## 3. Code Inspected
- `lib/webrtc/VoiceCallManager.ts`: Manages WebRTC mesh, peer connections, DOM audio elements (`audioElements: Map<string, HTMLAudioElement>`), speaking detector, and audio constraints.
- `server/index.ts`: Socket server running on Railway with `voice_join`, `voice_leave`, `voice_signal`, and `voice_state_update` handlers.
- `components/room/ParticipantList.tsx`: Displays participant avatars, watching count, speaking rings, and mute badges.
- `components/voice/VoiceControls.tsx`: Desktop navbar voice pill and mobile dropdown controls.
- `app/room/[code]/page.tsx`: Coordinates room state, `currentUser`, `room.hostId`, `liveHostId`, and voice state.

---

## 4. Decisions and Assumptions
1. **Local Volume & Mute is Client-Side**: Setting a peer's volume or clicking "Mute for me" modifies the local `HTMLAudioElement` directly. It requires no network round-trip, is instantaneous, and does not alter the audio stream for anyone else.
2. **Input Gain Scaling via Web Audio GainNode**: To allow a user to boost or reduce their microphone volume, the local microphone stream is routed through an AudioContext `GainNode` before transmission. This enables clean 0% to 150% gain scaling.
3. **Host Moderation Respects User Privacy**:
   - The host can only **mute** participants; a host can **never force unmute** a participant's microphone (standard industry security rule implemented by Zoom and Google Meet).
   - When muted by the host, the participant receives a subtle toast message: *"The host muted your microphone. You can unmute when you wish to speak."*
4. **Intuitive Pro UI (Two Access Points)**:
   - **Participant List**: Clicking any user card/avatar opens an audio popover directly next to that person (natural Discord-style interaction).
   - **Voice Settings Modal (⚙️)**: Added to the voice controls bar with two tabs:
     - *Input Settings*: Mic input gain slider + live responsive audio level meter.
     - *Voice Mixer*: Side-by-side volume sliders and mute switches for all connected peers.

---

## 5. Files to Touch
1. `lib/webrtc/VoiceCallManager.ts`:
   - Add `setInputGain(gain: number): void` using Web Audio `GainNode`.
   - Add `setPeerVolume(socketId: string, volume: number): void` to scale peer audio elements.
   - Add `setPeerMuted(socketId: string, muted: boolean): void` to mute peer audio elements locally.
   - Add `getMicLevel(): number` for live VU metering.
   - Store peer volume and local mute preferences in memory so reconnections respect saved levels.
2. `server/index.ts`:
   - Add `host_mute_user` socket handler: validates host role and emits `force_mute_mic` to the target socket.
   - Add `host_mute_all` socket handler: validates host role and broadcasts `force_mute_mic` to all room sockets except the host.
3. `components/voice/VoiceSettingsModal.tsx` [NEW]:
   - Clean modal with Input Gain slider, animated live VU meter, and Voice Mixer tab for all active peers.
4. `components/room/ParticipantAudioCard.tsx` [NEW] or enhanced `components/room/ParticipantList.tsx`:
   - Interactive popover on clicking any participant showing volume slider, "Mute for me" toggle, and (if Host) "Mute in Room" button.
   - "Mute All Mics" button in the participant list header visible only to the room host when 2+ people are in voice.
5. `components/voice/VoiceControls.tsx`:
   - Add ⚙️ settings button to both desktop pill and mobile menu to open `VoiceSettingsModal`.
6. `app/room/[code]/page.tsx`:
   - Listen for `force_mute_mic` from the server, trigger `voiceManager.setMuted(true)`, and display a feedback toast.
   - Wire host moderation handlers and pass state to `ParticipantList` and `VoiceControls`.

---

## 6. Security & Privacy Considerations
- **No Non-Consensual Unmuting**: The server strictly enforces that hosts cannot broadcast an `unmute` command to participants.
- **Role Verification**: The server verifies that only the socket matching the room's current `hostId` can dispatch `host_mute_user` or `host_mute_all`.
- **Sanitized Inputs**: Volume and gain inputs are strictly bounded (volume: 0.0 to 1.0; input gain: 0.0 to 1.5) to prevent audio distortion or NaN/Infinity exceptions.

---

## 7. Acceptance Criteria
- [ ] Any user in voice can adjust another user's playback volume from 0% to 100% via the participant card or voice mixer.
- [ ] Any user can toggle "Mute for me" to silence a specific peer locally without affecting other participants.
- [ ] Any user can adjust their own microphone input gain (0% to 150%) and see their live voice meter bounce in the Voice Settings modal.
- [ ] When the Host clicks "Mute in Room" on a participant, that participant is muted and informed via a toast notification.
- [ ] When the Host clicks "Mute All Mics", all other participants in the voice party are muted at once.
- [ ] All components are styled in harmony with the warm midnight cinema dark theme and light theme, responsive on desktop and mobile.
- [ ] `npx tsc --noEmit` and `npm run build` pass with 0 errors.

---

## 8. Checks to Run
1. `npx tsc --noEmit` (clean TypeScript compilation across web and server).
2. `npm run build` (Next.js production build verification).
3. Push to GitHub `main` and verify Vercel and Railway deployments.

---

## 9. Manual Test Steps
1. Open two browser sessions (PC and mobile or incognito window) in the same room and click **Join Voice**.
2. **Individual Volume & Mute Test**:
   - On PC, click the mobile user in the Participant List.
   - Drag their volume slider to 20% -> verify their voice becomes quieter on PC.
   - Toggle "Mute for me" -> verify the mobile user is silenced on PC while mobile mic still functions normally.
   - Unmute -> verify their voice is heard again.
3. **Self Mic Gain & Level Meter Test**:
   - Click the ⚙️ icon on the voice bar.
   - Speak -> verify the green live audio meter bounces in real-time.
   - Adjust input volume slider to 150% -> verify gain increases.
4. **Host Moderation Test**:
   - As the Host, click "Mute in Room" on the guest -> verify the guest's mic switches to Muted and a toast appears on the guest's screen.
   - Guest can click "Unmute" to speak again.
   - As the Host, click "Mute All Mics" -> verify all guest microphones are muted simultaneously.
