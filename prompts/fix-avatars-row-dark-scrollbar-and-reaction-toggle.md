# Implementation Prompt: Horizontal Avatars, Dark Scrollbar, Move Reaction Dock to Chat & Reaction Toggle

## Goal
Implement the user's refined UI/UX adjustments across the watch room:
1. **Horizontal Participant Avatars**: Change the avatar display in [ParticipantList.tsx](file:///f:/Nextjs/watch-together/components/room/ParticipantList.tsx) from a vertical column to a horizontal row (`flex-row items-center gap-2 flex-wrap`), freeing up vertical space for chat.
2. **Dark Mode Sleek Scrollbars**: Eliminate the stark white Windows OS scrollbar by styling `globals.css` with a slim 6px dark scrollbar matching the Warm Midnight Cinema palette (`#1c1b18` background, `#33312b` thumb).
3. **Move Reaction Dock from Video to Chat**: Remove the persistent floating `🍿 React` pill from the video canvas so it never blocks video subtitles, YouTube controls, or video content. Integrate the reaction trigger directly into the chat input bar in [ChatPanel.tsx](file:///f:/Nextjs/watch-together/components/chat/ChatPanel.tsx).
4. **Floating Reaction Mute / Disable Toggle**: Provide a toggle (e.g. *"Show reactions on video: ON/OFF"*) inside the reaction popover in chat, persisting the preference in `localStorage`. When disabled, floating bubbles are not drawn over the video.

---

## Skills Read & Code Inspected
- `AGENTS.md`: Section 3 (exact UI alignment, responsiveness), Section 12 (build to prompt and run checks).
- `components/room/ParticipantList.tsx`: Line 209 (`flex flex-col gap-2`).
- `app/globals.css`: Needs custom webkit and standard Firefox scrollbar properties for light and dark modes.
- `components/player/FloatingReactions.tsx`: Currently has both the canvas and the floating dock positioned at `absolute bottom-12 right-3`.
- `components/chat/ChatPanel.tsx`: Chat input area has room for the `🍿` reaction button right beside the timestamp insert button.
- `app/room/[code]/page.tsx`: Houses the state and forwards reaction callbacks.

---

## Decisions & Assumptions
1. **Participant Avatars**:
   - Change `flex flex-col gap-2` to `flex flex-row items-center gap-2 flex-wrap`.
   - The popover for individual participant volume and mute stays fully working on click.
2. **Dark Mode Scrollbars**:
   - Light mode: transparent track with `#d6d2c9` rounded thumb.
   - Dark mode: transparent track with `#33312b` rounded thumb (hover `#4d4a43`).
   - Width: 6px, thin and unobtrusive on all browsers.
3. **Reaction Dock Placement**:
   - The video canvas retains only the floating animation bubbles layer (wrapped in `pointer-events-none`).
   - The interactive reaction trigger (`🍿`) moves into the chat input action bar alongside the timestamp button.
   - Clicking `🍿` opens a popover displaying the 6 quick emojis plus a toggle switch to enable/disable floating bubbles on video.
4. **Persistence**:
   - Reaction visibility preference is saved in `localStorage.getItem("popcorn_hide_floating_reactions")`.
   - When set to `true`, incoming reactions still appear in chat/sound (optional), but zero bubbles float over the video.

---

## Files to Touch
- `components/room/ParticipantList.tsx`: Update avatar container to horizontal row.
- `app/globals.css`: Add global light/dark scrollbar CSS.
- `components/player/FloatingReactions.tsx`: Split into a pure floating bubbles layer (or support `showDock={false}` and `disabled={boolean}`).
- `components/chat/ChatPanel.tsx`: Add reaction picker button and dock with emoji buttons and video reaction toggle.
- `app/room/[code]/page.tsx`: Connect reaction trigger from `ChatPanel` to `handleSendReaction`, pass `reactionsEnabled` state to `FloatingReactions`.

---

## Requirements
- Video screen must be 100% free of persistent floating widgets.
- Emojis in the chat reaction picker must be 1-click easy to send.
- Avatars must not exceed container width and must wrap gracefully.
- Scrollbars must not appear stark white in dark mode.
- Reaction toggle must immediately stop floating bubbles and save across page reloads.

---

## Security Considerations
- Safe `localStorage` checking with `try/catch` and SSR-safe guards.
- Sanitized emoji inputs.

---

## Acceptance Criteria
- [ ] Participant avatars sit horizontally in a row under "X watching".
- [ ] Chat feed scrollbar in dark mode is slim dark grey, matching the background.
- [ ] No reaction pill floats over the video player.
- [ ] Chat input bar contains the `🍿` reaction trigger.
- [ ] Clicking `🍿` reveals emojis to send reactions.
- [ ] Toggle switch in the reaction picker disables floating bubbles on the video and persists across reloads.

---

## Checks to Run
- `npx tsc --noEmit`
- `npm run build`
- Multi-tab manual verification of horizontal avatars, dark scrollbar, chat reaction picker, and video reaction toggle.

---

## Exact Manual Test Steps
1. Open a room with 2 or more participants.
2. Observe participant avatars (e.g. `RA`, `JA`) aligned horizontally in a row.
3. Open chat in dark mode and scroll: verify the scrollbar is a sleek dark tone, not bright white.
4. Verify the video display has no persistent floating widgets.
5. In the chat input, click the `🍿` reaction button: see the emoji picker expand.
6. Click an emoji (e.g. `❤️`): observe floating bubbles animate over the video.
7. In the reaction picker, click the toggle to disable floating reactions on video.
8. Send another emoji: verify no floating bubbles appear on the video.
9. Refresh the page: confirm the preference remains disabled.
