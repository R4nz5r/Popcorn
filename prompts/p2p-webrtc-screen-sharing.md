# Implementation Prompt: P2P WebRTC Screen Sharing (Discord-style) Without Affecting YouTube Sync

## Goal
Implement a 100% free Peer-to-Peer (P2P) WebRTC screen sharing capability in Watch Together, allowing room participants (or the host) to stream their screen/tab with audio to other participants in the room, while keeping all existing YouTube video syncing, chat, room presence, and host controls completely functional and untouched.

---

## Skills Read & Inspected
- `AGENTS.md`:
  - Section 1 & 7: "This product is sync-only. There is no local file upload." WebRTC screen sharing is ephemeral streaming between browsers—no files are stored, transcoded, or rehosted.
  - Section 5: Realtime server vs web app responsibilities. Socket.io handles signaling; browsers handle peer media streams directly.
  - Section 8: Room state & connected peers model.
  - Section 10: Multi-tab verification and type checks.
  - Section 12: Preserve existing boundaries; don't break existing features.

---

## Code Inspected
1. `server/index.ts`:
   - Socket.io server already manages rooms, peers (`room.peers`), and broadcasts (`chat_message`, `sync_state`, `room_participants`).
   - We can add lightweight signaling events (`webrtc_signal`, `screen_share_start`, `screen_share_stop`) without touching or perturbing any of the YouTube sync logic (`play`, `pause`, `seek`, `heartbeat`, `buffering`).
2. `app/room/[code]/page.tsx`:
   - Contains room state, active video state, chat, participants, and layout.
   - Manages switching between active video playback and idle placeholder.
   - Can hold screen sharing state (`screenSharer`: `{ userId: string; displayName: string } | null`).
3. `components/player/PlaybackControls.tsx`:
   - Contains controls bar for play/pause, scrub, volume, fullscreen, and sync status.
4. `components/player/ScreenSharePlayer.tsx` (New component):
   - Dedicated clean HTML5 `<video autoPlay playsInline>` container with stream stats/status, fullscreen toggle, volume/mute control, and a "Stop Sharing" button if the local user is the presenter.

---

## Decisions and Assumptions
1. **Zero Added Cost ($0 Budget)**:
   - Signaling uses the existing Socket.io server connection. No extra servers, processes, or ports.
   - STUN uses Google's public, free STUN servers (`stun:stun.l.google.com:19302`, `stun:stun1.l.google.com:19302`).
   - Media transport is direct P2P mesh between browsers. Server bandwidth for media is 0 bytes.
2. **Preserve Existing YouTube Features**:
   - Zero changes to the YouTube sync protocol, IFrame adapter, heartbeat mechanism, or buffering stall handlers.
   - When a screen share starts:
     - If a YouTube video is currently playing, the room automatically pauses YouTube so audio/video feeds don't clash.
     - The main video container switches to the `ScreenSharePlayer`.
   - When screen sharing ends:
     - The screen share stream and peer connections close cleanly.
     - The video view immediately reverts back to YouTube mode (or the placeholder if no YouTube video was loaded).
3. **Permissions & Signaling Model**:
   - Any participant can click "Share Screen" (or host, with graceful handling if someone else starts sharing).
   - Only one person shares screen at a time in a room.
   - Presenter initiates WebRTC offers to each connected peer in the room.
   - If a new peer joins while a screen share is active, the presenter automatically establishes a connection with the newcomer.
   - If the presenter leaves, closes the tab, or clicks "Stop sharing", the room automatically cleans up the screen share state.
4. **Chat Notifications**:
   - System messages broadcast to chat: `"${displayName} started screen sharing"` and `"${displayName} stopped screen sharing"`.

---

## Files to Touch
1. `server/index.ts`
   - Add room state field `screenSharer?: { userId: string; socketId: string; displayName: string } | null`.
   - Add Socket.io signaling handlers:
     - `screen_share_start`: records sharer, broadcasts `screen_share_started` to room, emits system chat message.
     - `screen_share_stop`: clears sharer, broadcasts `screen_share_stopped` to room, emits system chat message.
     - `webrtc_signal`: relays `{ toSocketId, fromSocketId, signal }` directly to the target peer socket.
   - On peer leave/disconnect: if the departing peer was the screen sharer, automatically trigger `screen_share_stopped` to clean up for remaining viewers.
   - Include `screenSharer` in `join_room` initial state so late joiners immediately know screen sharing is active.
2. `lib/webrtc/WebRTCManager.ts` (New file)
   - Encapsulates clean WebRTC peer connection management (`RTCPeerConnection`, `getDisplayMedia`, track handling, ICE candidates, and cleanup) to keep UI components decoupled and readable.
3. `components/player/ScreenSharePlayer.tsx` (New file)
   - Video surface displaying the remote or local screen stream with video element, fullscreen button, volume/mute control, presenter info badge, and "Stop Sharing" button for the sharer.
4. `app/room/[code]/page.tsx`
   - Add "Share Screen" button in header next to "+ Add video".
   - Wire Socket.io signaling listeners and `WebRTCManager`.
   - Conditionally render `ScreenSharePlayer` when screen sharing is active, or `YouTubePlayer` / placeholder when inactive.
   - Pause YouTube playback when screen sharing starts.

---

## Security & Privacy Considerations
- WebRTC screen capture requires explicit user consent prompted by the browser's native `getDisplayMedia` dialog.
- No media packets traverse our backend server.
- WebRTC media encryption (DTLS-SRTP) is enforced natively by all WebRTC-compliant browsers.

---

## Acceptance Criteria
1. **YouTube Sync Remains 100% Intact**:
   - Creating a room, adding a YouTube URL, play/pause/seek syncing across multiple tabs continues to work exactly as it does right now.
2. **Starting Screen Share**:
   - Clicking "Share Screen" prompts the browser native screen capture dialog (window/tab/entire screen).
   - Once selected, the presenter's screen shows their live shared stream.
   - All other room participants immediately see the presenter's screen in real time with low latency.
   - A system announcement appears in chat: `"<User> started screen sharing"`.
   - If a YouTube video was playing, it pauses.
3. **Audio Sharing**:
   - If the user enables audio in the browser screen share dialog (e.g. sharing a YouTube tab or desktop audio), audio is received by viewers with volume control.
4. **Stopping Screen Share**:
   - Clicking "Stop Sharing" (or the native browser stop sharing floating banner) ends the stream.
   - All viewers return seamlessly to the YouTube player or room placeholder.
   - Chat announces: `"<User> stopped screen sharing"`.
5. **Robust Lifecycle**:
   - Late joiners connect to the ongoing screen share automatically.
   - If the presenter navigates away or closes their browser, the screen share ends gracefully on all viewers' screens.
6. **Code Quality**:
   - `npx tsc --noEmit` passes with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit` to ensure strict TypeScript compilation across Next.js and server code.
- Build validation with Next.js compiler.

### Manual Multi-Tab Test Steps
1. Open Room in **Tab 1 (User A - Host)** and **Tab 2 (User B - Guest)**.
2. Add a YouTube video and verify synchronized playback still works seamlessly between Tab 1 and Tab 2.
3. In Tab 1, click **"Share Screen"** and select a window or tab.
4. In Tab 2, verify the screen instantly transitions from YouTube to the live screen stream from Tab 1.
5. Verify chat shows system message: `"User A started screen sharing"`.
6. In Tab 1, click **"Stop Sharing"**.
7. In both tabs, verify the room cleanly reverts back to YouTube player mode with all controls ready.
8. Verify chat shows system message: `"User A stopped screen sharing"`.
