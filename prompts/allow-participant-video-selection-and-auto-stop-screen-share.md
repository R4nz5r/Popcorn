# Implementation Prompt: Allow Participant Video Selection and Auto-Stop Screen Share

## Goal
Enable any participant (host or guest) in a room to add or change the YouTube video, automatically terminate active screen sharing when a video is queued, expand URL parsing to cover YouTube Shorts and Live streams, and ensure video transitions load cleanly across all connected devices.

---

## Skills & Rules Read
- `AGENTS.md`:
  - Section 1: Core watch party sync requirements.
  - Section 5: Realtime server ownership of room sync state; API routes for persistence.
  - Section 9: Sync protocol and player abstraction.
  - Section 10 & 12: Verification and build checks.

---

## Code Inspected
1. `server/index.ts`:
   - Line 451: `if (!peer || peer.userId !== room.hostId)` rejects non-hosts from emitting `set_video`.
   - `set_video` does not clear `room.screenSharer` if screen sharing was active.
2. `app/api/rooms/[code]/route.ts`:
   - Lines 87–93: `PATCH` route rejects video persistence if `userId !== room.hostId`.
3. `app/room/[code]/page.tsx`:
   - Line 749: `if (!isHost) return;` silently drops video selection for non-hosts.
   - Line 1202: `{screenSharer ? (<ScreenSharePlayer ... />) : ...}` prioritizes screen sharing, causing the YouTube player to remain obscured when a video is loaded.
4. `components/room/AddSourceModal.tsx`:
   - Line 24: `extractYouTubeId` regex fails for `/shorts/` and `/live/` URLs.
5. `components/player/YouTubePlayer.tsx`:
   - Line 194: `cueVideoById` does not auto-buffer or update playback on video change.

---

## Decisions and Architectural Specifications
1. **Open Video Selection for Participants**:
   - Both host and guests can queue/change the YouTube video using the `+ Add video` modal.
   - `server/index.ts`: Verify `peer` is a valid connected member of the room (`if (!peer) return;`), without restricting to `room.hostId`.
   - `app/api/rooms/[code]/route.ts`: Allow updating `room.activeVideo` without 403 authorization lock.
   - `app/room/[code]/page.tsx`: Remove `if (!isHost) return;` in `handleSelectSource`.

2. **Auto-Stop Screen Sharing on Video Change**:
   - On the server (`set_video`): If `room.screenSharer` is non-null, clear `room.screenSharer = null` and emit `screen_share_stopped` to all peers in the room.
   - On the client (`handleSelectSource`): If `screenSharer` is active locally, clear `setScreenSharer(null)`, stop any local media tracks, and emit `screen_share_stop`.
   - On peer sync (`handleSyncState`): When `sync_state` is received with a valid `videoId`, clear `screenSharer` if active so the YouTube player displays immediately.

3. **Enhanced YouTube URL Parsing**:
   - Support `youtube.com/watch?v=...`, `youtu.be/...`, `youtube.com/shorts/...`, `youtube.com/live/...`, `youtube.com/embed/...`, and direct 11-character video IDs.

4. **Reliable Video Transition in `YouTubePlayer.tsx`**:
   - When `videoId` updates on an already-mounted player, use `loadVideoById` (or `cueVideoById` fallback) to ensure the player switches to the new video.

---

## Files to Touch
1. `server/index.ts`
2. `app/api/rooms/[code]/route.ts`
3. `app/room/[code]/page.tsx`
4. `components/room/AddSourceModal.tsx`
5. `components/player/YouTubePlayer.tsx`

---

## Security Considerations
- Malicious or malformed video inputs are sanitized: only valid 11-character YouTube alphanumeric IDs are accepted.
- Room participation is verified: only sockets currently joined to the room can emit `set_video`.

---

## Acceptance Criteria
1. Any participant in the room (host or guest, mobile or desktop) can open `+ Add video`, paste a YouTube URL (including Shorts and Live links), and successfully load the video.
2. If screen sharing is active when a video is loaded, screen sharing immediately terminates for everyone and the YouTube player displays the new video.
3. The selected video synchronizes across all peers in the room.
4. `npx tsc --noEmit` and `npm run lint` pass with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit`
- `npm run lint`

### Manual Test Steps
1. On phone (guest) at `http://192.168.0.116:3000/room/Q28K88`:
   - Tap `+ Add video`
   - Paste a YouTube URL or tap "Trailer"
   - Confirm video successfully loads on phone and desktop.
2. On desktop (host):
   - Start screen share, verify screen share player renders.
   - Tap `+ Add video` and load a YouTube video.
   - Confirm screen share stops cleanly and YouTube player takes over.
