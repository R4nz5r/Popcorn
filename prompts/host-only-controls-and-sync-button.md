# Implementation Prompt: Host-Only Playback Controls and Interactive Sync Button

## 1. Goal
1. Restrict playback controls (Play, Pause, Timeline Scrubber Seek, and Change Video) exclusively to the Room Host, ensuring that viewer screens strictly follow the host without conflicting commands or accidental seeks.
2. Allow non-host viewers full independent control over their personal volume and mute settings.
3. Transform the **"Synced"** badge in `PlaybackControls` into an interactive **"Sync to Host"** button for viewers so that if a viewer is behind or out of sync, clicking it instantly aligns their player with the host's exact position.
4. Enforce host authorization on the realtime sync server (`server/index.ts`) for `play`, `pause`, `seek`, and `set_video` events, and add a dedicated `request_sync` handler for instant manual re-syncing.

---

## 2. Skills & References Read
- `AGENTS.md`:
  - Section 1: "Watch Together lets a host create a room... Everyone who joins sees the same video, at the same playback position, at the same time."
  - Section 5: "The sync protocol (section 10) is the only channel that mutates playback state... Never cross these boundaries. The browser never computes 'who is host' locally — that's server state, reflected to clients."
  - Section 7: "Sync is host-authoritative, not consensus-based. One client per room is the clock source; everyone else's player is corrected against it."
  - Section 9: Graduated drift correction & protocol message flow.
- Reference Mockups:
  - `design/2-watch-room.jpg`: Playback bar styling with "Synced" badge.
  - `design/4-host-controls-buffering.jpg`: Host controls and host transfer pattern.

---

## 3. Code Inspected
- `components/player/PlaybackControls.tsx`:
  - Lines 159-177: Play/Pause button currently triggers `onPlayPause` unconditionally for any user.
  - Lines 187-209: Scrubber progress bar handles pointer down and drag seek for any user.
  - Lines 260-277: Synced status is a non-clickable `<span>`.
- `server/index.ts`:
  - Lines 131-207: Socket handlers for `play`, `pause`, `seek`, and `set_video` currently allow any socket connection in the room to mutate room playback state.
- `app/room/[code]/page.tsx`:
  - Line 319: `isHost` is calculated from `effectiveHostId === currentUser.userId`.
  - Lines 617-637: `onStateChange` handles play/pause triggers.
  - Line 680: `<PlaybackControls>` is rendered without `isHost` or `onSyncToHost` props.

---

## 4. Decisions and Assumptions
1. **Host-Only Control Enforcement**:
   - **Client UI (`PlaybackControls.tsx`)**:
     - `isHost` prop added.
     - When `!isHost`:
       - Play/pause button is disabled with reduced opacity (`opacity-50 cursor-not-allowed`) and a tooltip ("Only host can control playback").
       - Progress bar scrubber is disabled for clicks and dragging (`cursor-default` on scrub interaction) with a tooltip ("Only host can seek"), while still accurately reflecting the video's live progress.
       - Audio volume bar and mute button remain fully interactive for personal listening preference.
   - **Client YouTube Embed (`app/room/[code]/page.tsx`)**:
     - In `onStateChange`, non-host users will not emit `play` or `pause` to the server if they interact directly with the embedded iframe.
   - **Server-Side Authorization (`server/index.ts`)**:
     - In `play`, `pause`, `seek`, and `set_video` events, verify `peer.userId === room.hostId`. If a non-host attempts to emit, the server logs and rejects the request.
2. **Interactive "Sync to Host" Button**:
   - **UI Behavior (`PlaybackControls.tsx`)**:
     - When `isHost`: Renders the stable "Host" or green "Synced" indicator.
     - When `!isHost`:
       - If `syncStatus === "syncing"`: Renders an active, clickable button with amber styling and an icon: `Sync to Host`. Clicking it immediately triggers `onSyncToHost`.
       - If `syncStatus === "synced"`: Renders a clean clickable green badge `Synced` with a subtle hover effect and tooltip ("In sync with host. Click to re-sync anytime").
       - If `syncStatus === "disconnected"`: Renders a gray `Disconnected` badge.
   - **Re-Sync Mechanism (`app/room/[code]/page.tsx` & `server/index.ts`)**:
     - Server adds a `request_sync` event listener that immediately responds to the requester with the authoritative `sync_state`.
     - Clicking "Sync to Host" sets `syncStatus("syncing")` and emits `request_sync`. Upon receiving `sync_state`, the client hard-seeks to `targetTime` and sets play/pause accordingly, immediately pulling the viewer into alignment.

---

## 5. Files Expected to Touch
- `components/player/PlaybackControls.tsx` (MODIFY: add `isHost` & `onSyncToHost` props, disable play/pause and scrubber for viewers, make Synced badge an interactive button for viewers)
- `app/room/[code]/page.tsx` (MODIFY: pass `isHost` and `onSyncToHost` to `PlaybackControls`, implement `handleSyncToHost`, restrict iframe `onStateChange` emission to host)
- `server/index.ts` (MODIFY: enforce `peer.userId === room.hostId` on `play`, `pause`, `seek`, `set_video`; add `request_sync` handler)

---

## 6. Requirements
- Only the host can play, pause, or seek the video.
- All participants can adjust their own volume and toggle mute freely.
- Viewers see their progress bar update in lockstep with the host, but cannot drag it to change time.
- Viewers have a clickable "Sync" / "Sync to Host" button that immediately fetches latest sync state and snaps their player to the host's position.
- Server rejects unauthorized `play`/`pause`/`seek`/`set_video` commands from non-hosts.
- Zero TypeScript errors (`npx tsc --noEmit`).
- Zero ESLint errors (`npm run lint`).
- Successful Next.js build (`npm run build`).

---

## 7. Security Considerations
- Never rely solely on client UI disabling. Server-side validation of `peer.userId === room.hostId` prevents malicious or unauthorized socket packets from hijacking room playback.

---

## 8. Acceptance Criteria
- [ ] Host screen can play, pause, seek, and change video.
- [ ] Viewer screen cannot play, pause, seek, or change video (controls disabled with clear tooltips).
- [ ] Viewer screen can adjust personal volume and mute.
- [ ] Viewer sees progress bar move smoothly as host plays.
- [ ] Viewer clicking "Sync to Host" immediately snaps their player to the host's time.
- [ ] Server ignores `play`, `pause`, `seek`, `set_video` from non-host sockets.
- [ ] `npx tsc --noEmit` passes with 0 errors.
- [ ] `npm run lint` passes with 0 errors.
- [ ] `npm run build` succeeds without errors.

---

## 9. Checks to Run
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- Automated multi-client test script verifying host authority and `request_sync` response.

---

## 10. Exact Manual Test Steps
1. Open Host tab at `http://localhost:3000/room/[code]`.
2. Open Peer tab (Incognito) at the same room URL.
3. On Peer tab:
   - Verify play/pause button is disabled with tooltip "Only host can control playback".
   - Verify scrubbing the progress bar is disabled.
   - Verify volume slider and mute toggle work normally.
4. On Host tab:
   - Click Play -> verify video plays on both Host and Peer.
   - Seek to a new position -> verify both Host and Peer seek.
5. On Peer tab:
   - Click "Synced" / "Sync to Host" button:
   - Verify it immediately queries the server and aligns playback time with the host.
