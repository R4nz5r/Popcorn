# Implementation Prompt: Watch Room UI (Desktop & Mobile)

## 1. Goal
Build the watch room UI for `app/room/[code]/page.tsx`, replacing the current placeholder:
- Reproduce `design/2-watch-room.jpg` exactly for the desktop layout (video on top, playback controls bar, and bottom card containing participant avatars, chat messages, and input).
- Reproduce `design/5-mobile-watch-room.jpg` for the mobile layout (video on top, compact playback controls with "Synced" badge, and chat rendered as a swipe-up drawer below it with drag handle, instead of a side panel).
- Establish the player abstraction (`PlayerAdapter`) wrapping video players behind a common interface (`play`, `pause`, `seekTo`, `getCurrentTime`, `getDuration`).
- Implement the YouTube video player using the YouTube IFrame Player API.
- Implement an upload placeholder state for uploaded videos that are pending/processing.
- Implement custom playback controls: play/pause toggle, draggable scrubber, current time / duration counter (`mm:ss` / `hh:mm:ss`), and static "Synced" badge.
- Implement the chat panel: local state message feed and input (no persistence or realtime broadcast in this phase).
- Implement the participant list: read `participantIds` from the room document (`GET /api/rooms/[code]`) and render avatar circles with initials and palette colors (`#93c5fd`, `#c4b5fd`, `#fcd34d`).
- Include an "Add something to watch" source selector modal matching `design/3-add-source-modal.jpg` allowing users to paste a YouTube link or test upload placeholder via local component state.

---

## 2. Skills & References Read
- `AGENTS.md`: Core loop, UI reproduction rules (Section 3), skills (Section 4), architecture (Section 5), tech stack (Section 6), decisions (Section 7), data model (Section 9), sync player abstraction (Section 10), checks (Section 12), and gotchas (Section 13).
- `design/2-watch-room.jpg`: Desktop watch room mockup reference.
- `design/5-mobile-watch-room.jpg`: Mobile watch room mockup reference (swipe-up drawer layout).
- `design/3-add-source-modal.jpg`: Source selector modal mockup reference.
- `design/4-host-controls-buffering.jpg`: Room control & buffering styling reference.
- `node_modules/next/dist/docs/`: Next.js App Router client components, routing, and params handling.
- YouTube IFrame Player API reference (`https://developers.google.com/youtube/iframe_api_reference`).

---

## 3. Code Inspected
- `app/room/[code]/page.tsx`: Existing placeholder staging page fetching room metadata from `GET /api/rooms/[code]`.
- `app/api/rooms/[code]/route.ts`: Room lookup endpoint returning `room` object (needs `participants` / `participantIds` field exposed).
- `lib/models/Room.ts`: Room Mongoose model with `participants: string[]` and `activeVideo: IActiveVideo`.
- `lib/identity.ts`: Anonymous identity helper with predefined avatar colors (`#93c5fd`, `#c4b5fd`, `#fcd34d`).
- `app/globals.css`: Tailwind v4 theme variables (`--background: #f3efe8`, `--foreground: #1f1f1d`).

---

## 4. Decisions and Assumptions
1. **Player Abstraction (`PlayerAdapter`)**:
   - Create `lib/player/types.ts` defining:
     ```ts
     export interface PlayerAdapter {
       play(): void;
       pause(): void;
       seekTo(seconds: number): void;
       getCurrentTime(): number;
       getDuration(): number;
       isReady(): boolean;
     }
     export interface PlayerCallbacks {
       onReady?: (duration: number) => void;
       onStateChange?: (isPlaying: boolean) => void;
       onTimeUpdate?: (currentTime: number, duration: number) => void;
       onBuffering?: (isBuffering: boolean) => void;
       onError?: (error: string) => void;
     }
     ```
   - All playback interactions (controls, scrubber, play/pause button) talk strictly to this adapter interface, making the watch room sync-ready for when Socket.io is connected in the next task.
2. **YouTube Player Integration (`components/player/YouTubePlayer.tsx`)**:
   - Dynamically load `https://www.youtube.com/iframe_api` script once.
   - Mount YouTube player with `controls: 0`, `rel: 0`, `modestbranding: 1`, `disablekb: 1`.
   - Forward player state transitions (`YT.PlayerState.PLAYING`, `PAUSED`, `BUFFERING`) to the callbacks.
   - Poll or hook into time updates (every 250ms during playback) to update the scrubber and time counter.
3. **Upload Placeholder (`components/player/UploadPlaceholder.tsx`)**:
   - Displays processing card when `activeVideo.type === 'upload'`, matching AGENTS.md requirements for transcode states.
4. **Playback Controls Bar (`components/player/PlaybackControls.tsx`)**:
   - Layout matching `design/2-watch-room.jpg` (desktop) and `design/5-mobile-watch-room.jpg` (mobile):
     - Play/pause toggle button with crisp SVG icons.
     - Formatted time text (`mm:ss / mm:ss` or `hh:mm:ss / hh:mm:ss`).
     - Interactive scrubber: track line with hover/drag scrub preview, smooth progress indicator, and seek dispatch.
     - "Synced" badge: `#cbf3bb` light green pill with `#1f1f1d` text.
5. **Chat Panel & Mobile Swipe-up Drawer (`components/chat/ChatPanel.tsx`)**:
   - **Desktop**: Renders inside the bottom card alongside participants as shown in `design/2-watch-room.jpg`.
   - **Mobile**: Transforms into a bottom drawer below the video player as shown in `design/5-mobile-watch-room.jpg`, with a pill drag handle (`—`), expandable/collapsible sheet state, and full-width input.
   - **Local State**: Holds messages in component state (`[{ id, sender, text, emoji, timestamp }]`), seeded with sample messages matching the mockup ("Tasnim: this scene is wild", "Rafi: wait rewind that"). New messages typed by the user are appended locally.
6. **Participant List (`components/room/ParticipantList.tsx`)**:
   - Displays count ("4 watching") and avatar stack with initials.
   - Uses `participantIds` from `GET /api/rooms/[code]`.
   - Renders avatar circles with colors matching `design/2-watch-room.jpg` (`RS` in `#93c5fd`, `TA` in `#c4b5fd`, and `+2` in `#fcd34d`).
7. **Add Source Modal (`components/room/AddSourceModal.tsx`) & Local-Only State**:
   - Exact recreation of `design/3-add-source-modal.jpg`.
   - **Explicit confirmation**: Changing the video source via the modal or pasting a YouTube link is strictly local component state only in this phase. There is NO hidden database write, NO PATCH/PUT API call, and NO backend persistence. The room document in MongoDB remains untouched.
8. **API Response Update**:
   - Update `app/api/rooms/[code]/route.ts` to return `participants` and `participantIds: room.participants || []` in the JSON response.

---

## 5. Files Expected to Touch
- `lib/player/types.ts` (NEW: Player adapter interfaces and callback definitions)
- `components/player/YouTubePlayer.tsx` (NEW: YouTube player with adapter pattern)
- `components/player/UploadPlaceholder.tsx` (NEW: Upload video placeholder)
- `components/player/PlaybackControls.tsx` (NEW: Custom playback controls bar)
- `components/chat/ChatPanel.tsx` (NEW: Chat message list & input, responsive desktop & mobile drawer)
- `components/room/ParticipantList.tsx` (NEW: Participant count and avatar stack)
- `components/room/AddSourceModal.tsx` (NEW: Source selection modal matching design/3)
- `app/api/rooms/[code]/route.ts` (MODIFY: Return `participants` / `participantIds`)
- `app/room/[code]/page.tsx` (MODIFY: Assemble watch room UI replacing placeholder)

---

## 6. Requirements
- Desktop layout strictly reproduces `design/2-watch-room.jpg`.
- Mobile layout strictly reproduces `design/5-mobile-watch-room.jpg` (video on top, chat as bottom drawer with handle, not a side panel).
- Add-source modal strictly reproduces `design/3-add-source-modal.jpg`.
- Player abstraction decouples UI controls from player implementation.
- YouTube playback works: play, pause, seek, time updates.
- Upload type video shows placeholder state.
- Chat input adds messages to local state with immediate visual feedback.
- Participant avatars render initials with matching colors.
- Video switching is local component state only, no API writes.
- Zero TypeScript errors (`npx tsc --noEmit`).
- Zero ESLint errors (`npm run lint`).
- Successful Next.js production build (`npm run build`).

---

## 7. Security Considerations
- Sanitize and validate any pasted YouTube URLs to ensure only valid 11-character video IDs are loaded into the iframe.
- Chat text rendered safely via React standard text nodes (no `dangerouslySetInnerHTML`).
- Anonymous user state guarded against invalid `localStorage` access.

---

## 8. Acceptance Criteria
- [ ] Desktop layout matches `design/2-watch-room.jpg` (spacing, border colors `#e8e4dc`, fonts, controls).
- [ ] Mobile layout matches `design/5-mobile-watch-room.jpg` (video on top, swipe-up chat drawer below).
- [ ] Add-source modal matches `design/3-add-source-modal.jpg` (layout, spacing, typography, states).
- [ ] Video source switching operates via local component state only with zero backend API mutations.
- [ ] YouTube video plays, pauses, seeks, and displays accurate current time / duration via custom controls.
- [ ] Upload video shows upload placeholder state.
- [ ] Chat panel sends and displays messages locally.
- [ ] Participant list renders avatars and initials from `participantIds`.
- [ ] `GET /api/rooms/[code]` returns `participants` and `participantIds`.
- [ ] `npm run lint` passes with 0 errors.
- [ ] `npx tsc --noEmit` passes with 0 errors.
- [ ] `npm run build` succeeds without error.

---

## 9. Checks to Run
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- Browser validation: Desktop view at `http://localhost:3000/room/[code]`
- Browser validation: Mobile responsive view (< 768px)
- Visual comparison against `design/2-watch-room.jpg`, `design/5-mobile-watch-room.jpg`, and `design/3-add-source-modal.jpg`

---

## 10. Exact Manual Test Steps
1. Navigate to `http://localhost:3000` and click "+ Create a room".
2. On the room page (`/room/[code]`):
   - Observe header with room code and copy link button.
   - Observe video player area on top.
   - Observe playback controls bar with play/pause button, scrubber, `00:00 / 00:00`, and "Synced" badge.
   - Observe participant avatars (`4 watching`, `RS`, `TA`, `+2`) and chat messages.
3. Verify Add-Source Modal against `design/3-add-source-modal.jpg`:
   - Click "Add video" / source selector.
   - Confirm layout, border, typography, and options match `design/3-add-source-modal.jpg`.
   - Confirm video source change is local-only (verify network tab shows zero PATCH/POST/PUT calls mutating the room).
4. Test Video Controls:
   - Load YouTube sample video or paste a YouTube URL.
   - Click Play: video starts playing, timer advances, scrubber moves.
   - Click Pause: video pauses.
   - Click / drag scrubber: video seeks to target position.
5. Test Chat:
   - Type a new message into the input field and press Enter.
   - Observe the new message appears in the chat list.
6. Test Mobile Viewport:
   - Resize browser to mobile width (< 640px) or open mobile devtools.
   - Verify video remains on top.
   - Verify chat is positioned as a bottom drawer with a swipe handle below the video.
   - Verify controls bar fits cleanly with "Synced" badge.
7. Test Upload Placeholder:
   - Switch video source to "Upload a file" via the modal.
   - Verify upload placeholder state is displayed.
