# Streamline Add Video Modal and Dynamic Button

## Goal
Streamline the watch room's video selection flow:
1. Make the navbar button text dynamic: display `+ Add video` when no video is active, and `Change video` when a video is already playing.
2. Eliminate the redundant intermediate single-card step in `AddSourceModal` so clicking the button directly displays the YouTube input field with instant focus, reducing clicks and improving user speed.

## Context & Skills Read
- `AGENTS.md` (sync-only platform, YouTube IFrame player, responsive design tokens, strict approval protocol).
- Inspected code:
  - `components/room/AddSourceModal.tsx`: Currently shows an unnecessary 1-option card ("Paste a YouTube link") requiring a second click before revealing the text input.
  - `app/room/[code]/page.tsx`: Currently hardcodes `+ Add video` on both desktop (line 1405) and mobile dropdown (line 1447), regardless of whether a video is actively playing.
  - `lib/player/types.ts`: `ActiveVideoSource` structure.

## Decisions & Assumptions
- Keep the button label intuitive: `+ Add video` when empty, `Change video` when a video is active.
- Remove `isPastingYouTube` state toggle in `AddSourceModal` — the modal should immediately present the input form.
- Pass `hasActiveVideo?: boolean` to `AddSourceModal` to customize the modal title ("Add video to watch" vs "Change room video") and primary button ("Load Video" vs "Change Video").
- Keep the quick demo links ("Trailer", "Rick Astley") and clear error validation.
- Match existing light/dark mode color tokens (`bg-white dark:bg-[#1c1b18]`, `border-[#e8e4dc] dark:border-[#2b2925]`, etc.).

## Files to Touch
- `components/room/AddSourceModal.tsx`
- `app/room/[code]/page.tsx`

## Requirements
1. **Dynamic Button Text**:
   - In `app/room/[code]/page.tsx`:
     - Desktop button: shows `+ Add video` if `!activeVideo?.videoId`, otherwise `Change video`.
     - Mobile button: shows `+ Add video` if `!activeVideo?.videoId`, otherwise `Change video`.
2. **Streamlined Modal**:
   - In `components/room/AddSourceModal.tsx`:
     - Render the YouTube link input directly upon modal open with `autoFocus`.
     - Display helper text: "Paste a YouTube link or video ID to play in this room."
     - Support submit on Enter or click.
     - Single "Cancel" button to dismiss.
     - Quick demo presets ("Trailer", "Rick Astley") remain available.
     - Reset input and error message whenever modal is closed or successfully submitted.

## Security & Reliability
- Video ID validation uses `extractYouTubeId` regex (strict alphanumeric check), avoiding arbitrary URL navigation or injection.
- Preserves sync socket broadcasts unchanged (`socket.emit("change_video", ...)`).

## Acceptance Criteria
- [ ] Navbar button displays `+ Add video` when room has no active video.
- [ ] Navbar button displays `Change video` when room has an active video.
- [ ] Clicking the button immediately opens the modal with the input field focused.
- [ ] Submitting a valid YouTube link loads the video and closes the modal.
- [ ] Submitting an invalid link displays an inline error message.
- [ ] Clicking "Cancel" closes the modal.
- [ ] Both light mode and dark mode render seamlessly without contrast issues.

## Checks to Run
- `npx tsc --noEmit`
- `npm run lint`

## Manual Test Steps
1. Navigate to a room (`/room/[code]`) with no video loaded.
2. Confirm the navbar button reads `+ Add video`.
3. Click `+ Add video` -> Verify modal opens directly to the input field with cursor focused.
4. Click "Cancel" -> Verify modal closes.
5. Click `+ Add video` again -> Click "Trailer" demo link -> Verify video loads.
6. Verify the navbar button now displays `Change video`.
7. Click `Change video` -> Verify modal title says "Change room video" and input is ready.
