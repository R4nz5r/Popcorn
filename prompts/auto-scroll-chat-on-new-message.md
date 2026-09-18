# Implementation Prompt: Auto-Scroll Chat Feed to Bottom on New Messages

## Goal
Ensure the chat message feed in the watch room automatically scrolls to the bottom so new incoming messages and system announcements are immediately visible without requiring the user to manually scroll down.

---

## Skills Read & Inspected
- `AGENTS.md`:
  - Section 3: Desktop and mobile chat panel references.
  - Section 7: Live chat experience.
  - Section 10: Multi-tab tests and checks.
- Code inspected:
  - `components/chat/ChatPanel.tsx`:
    - Lines 31-41: A single `messagesEndRef` was attached to both the desktop and mobile message containers simultaneously. In React, this assigned the ref to the mobile element (which is hidden on desktop via `md:hidden`), rendering `scrollIntoView()` ineffective on desktop.
    - `scrollIntoView({ behavior: "smooth" })` can also be unreliable when multiple scroll containers exist.
    - Setting `container.scrollTop = container.scrollHeight` on the dedicated container refs (`desktopFeedRef` and `mobileFeedRef`) guarantees instantaneous, reliable auto-scrolling directly to the latest message.

---

## Decisions and Assumptions
1. **Dedicated Container Refs**:
   - Create separate `desktopFeedRef` and `mobileFeedRef` for the desktop and mobile scrollable containers.
2. **Direct `scrollTop = scrollHeight`**:
   - On every change to `activeMessages`, scroll both visible containers to the bottom using `container.scrollTop = container.scrollHeight`.
   - Add a brief `requestAnimationFrame` / `setTimeout(..., 50)` tick to guarantee that new DOM elements (such as multiline text or system notices) have finished layout before calculating `scrollHeight`.
3. **Smooth Behavior**:
   - Use `scrollTo({ top: container.scrollHeight, behavior: "smooth" })` or direct assignment so users always see the latest message when it arrives.

---

## Files to Touch
1. `components/chat/ChatPanel.tsx`
   - Replace single `messagesEndRef` with `desktopFeedRef` and `mobileFeedRef`.
   - Update `scrollToBottom` to set `scrollTop = scrollHeight` on both containers.
   - Run `scrollToBottom` when `activeMessages` changes.

---

## Security & Architectural Considerations
- Client-only UI behavior, no security implications.
- Does not affect socket protocol or message serialization.

---

## Acceptance Criteria
1. When a new chat message arrives (or when the user sends a message):
   - The desktop chat container automatically scrolls to the bottom so the new message is fully in view.
2. When system announcements arrive (e.g. `[User] joined the room` or `[User] left the room`):
   - The chat feed automatically scrolls to reveal the announcement.
3. In mobile view, the mobile chat drawer also auto-scrolls to the bottom upon new messages.
4. All checks (`npx tsc --noEmit` and build) pass with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit` to verify type safety.

### Manual Test Steps
1. Open a watch room in Tab A and Tab B.
2. Send enough messages (or join/rename) so the chat feed overflows and a vertical scrollbar appears.
3. From Tab B, type and send `"Testing auto scroll to bottom"`.
4. Observe Tab A without touching its mouse or scrollbar: verify Tab A's chat feed automatically scrolls down to show `"Testing auto scroll to bottom"`.
