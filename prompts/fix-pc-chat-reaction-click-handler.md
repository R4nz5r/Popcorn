# Implementation Prompt: Fix PC Chat Reaction Click and Ref Duplication

## Goal
Fix emoji reactions not firing on PC when clicking emoji buttons in the chat reaction popover.

---

## Root Cause Analysis
In [components/chat/ChatPanel.tsx](file:///f:/Nextjs/watch-together/components/chat/ChatPanel.tsx), both the desktop reaction popover (line 327) and the mobile reaction popover (line 480) were assigned the exact same React ref: `ref={reactionMenuRef}`.
Because React mounts the mobile JSX after desktop, `reactionMenuRef.current` always pointed to the mobile popover element.
On PC:
1. User clicks an emoji button in the desktop popover.
2. The browser dispatches a `mousedown` event before `click`.
3. The `handleClickOutside` listener on `document` runs:
   `reactionMenuRef.current && !reactionMenuRef.current.contains(e.target)`
4. Since `reactionMenuRef.current` was the mobile element, `contains(e.target)` evaluated to `false`.
5. `setIsReactionMenuOpen(false)` executed immediately on `mousedown`, unmounting the desktop popover before the button's `click` event could ever fire.
6. The reaction was never dispatched.

On mobile, `reactionMenuRef.current` matched the mobile element, which is why it worked on mobile but failed on PC.

---

## Skills Read & Code Inspected
- `AGENTS.md`: Section 3 (responsive layout, keeping desktop and mobile references exact), Section 12 (build to prompt and run checks).
- `components/chat/ChatPanel.tsx`: Inspected lines 136, 168-179, 325-342, 478-494.

---

## Decisions & Assumptions
1. Separate refs for desktop and mobile: `desktopReactionMenuRef` and `mobileReactionMenuRef`, plus button refs `desktopReactionButtonRef` and `mobileReactionButtonRef`.
2. In `handleClickOutside`, verify that the click target is outside BOTH desktop and mobile menus and trigger buttons before closing the popover.
3. Add `onMouseDown={(e) => e.stopPropagation()}` to the popover container so clicks inside the popover never bubble to the document's outside-click listener.
4. Keep the popover open so users can tap or click multiple reactions in sequence (e.g. 🍿🍿🍿), with clean click-outside dismissal.

---

## Files to Touch
- `components/chat/ChatPanel.tsx`:
  - Split `reactionMenuRef` into `desktopReactionMenuRef` and `mobileReactionMenuRef`.
  - Update `handleClickOutside` to check both refs and button refs.
  - Add `onMouseDown={(e) => e.stopPropagation()}` to popovers.

---

## Requirements
- Clicking any emoji in the PC chat reaction popover must immediately fire `onSendReaction` and play the reaction pop sound.
- Clicking the toggle button for "Video reactions" on PC must toggle visibility without prematurely closing the menu.
- Clicking outside the popover anywhere on the page must cleanly close the popover.
- Mobile touch interactions must continue to work flawlessly.

---

## Acceptance Criteria
- [ ] Clicking emojis on PC chat popover triggers rising reaction bubbles on the video and plays pop sound.
- [ ] Clicking "Video reactions" toggle on PC toggles between "Visible" and "Hidden".
- [ ] Clicking outside the popover closes it on PC.
- [ ] Mobile drawer reactions continue to work.

---

## Checks to Run
- `npx tsc --noEmit`
- `npm run build`
- Manual test on PC browser: open room, click `🍿 React`, click emojis, verify bubbles and sounds trigger.

---

## Exact Manual Test Steps
1. Open a room on PC (`http://localhost:3000/room/...`).
2. In the chat input, click `🍿 React` to open the emoji popover.
3. Click `🍿`, `❤️`, or `🔥`.
4. Verify the popover does NOT abruptly close without action.
5. Verify floating reaction bubbles rise over the video player with pop sound effects.
6. Click the "Video reactions" toggle button and verify it switches between "Visible" and "Hidden".
7. Click outside the popover to confirm it closes cleanly.
