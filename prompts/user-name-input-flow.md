# Implementation Prompt: Require Username Input on Room Creation and Join

## Goal
Require users to provide their desired display name before creating or joining a watch room, while persisting it in `localStorage` for convenience and allowing live name updates:
1. **Landing Page (`/`)**:
   - Add a styled "Your name" input field above the "Create a room" button and "Join room" form, matching the design aesthetic in `design/1-landing.jpg`.
   - Pre-populate the field with the user's saved name from `localStorage` if available.
   - Validate that a name is entered (1-30 characters) before creating or joining a room. Show an inline error if blank.
   - Save the entered name in `localStorage` so returning users don't need to re-type it.
2. **Direct Link Join Modal (`/room/[code]`)**:
   - If a user opens a room directly via an invite link (e.g. shared by a friend) and has not set a custom name yet (or only has a default guest name), present a clean, modal prompt matching `design/3-add-source-modal.jpg`:
     - Heading: "Join Watch Party"
     - Subheading: "Enter your name to join room {code}"
     - Input field with autofocus: "Your name (e.g. Rafi, Tasnim)"
     - Button: "Join room"
   - Once submitted, the room immediately connects with their chosen name and initials.
3. **In-Room Name Edit**:
   - Allow users to click their name pill in the top header to edit their name at any time during a session.
   - Emits `update_user` to the socket server so the participant list and chat update their name in real time for all room members.
4. **Realtime Server Support**:
   - In `server/index.ts`, add `update_user` socket handler: updates `peer.displayName` in `room.peers` and broadcasts updated `room_participants`.

---

## Skills Read & Inspected
- `AGENTS.md`:
  - Section 3: UI reference reproduction (`design/1-landing.jpg`, `design/3-add-source-modal.jpg`).
  - Section 5: Realtime server vs web app boundaries.
  - Section 7: Ephemeral rooms & low-friction joining (no passwords or signup walls).
  - Section 8: User data model (`userId`, `displayName`, `avatarColor`).
  - Section 10: Multi-tab tests and type checks.
- Code inspected:
  - `lib/identity.ts`: Currently assigns `Guest ${randomSuffix}`. Needs `updateUserName(name: string)` and `hasCustomName()` helpers.
  - `app/page.tsx`: Landing page layout. Needs name input field and validation before `handleCreateRoom` and `handleJoinRoom`.
  - `app/room/[code]/page.tsx`: Needs name prompt modal for direct joiners without a custom name, and clickable header badge for inline name editing.
  - `server/index.ts`: Needs `update_user` listener to broadcast name changes.

---

## Decisions and Assumptions
1. **No Account / No Password**:
   - Adheres strictly to `AGENTS.md` Section 7: display names are stored locally in the browser (`localStorage`) without requiring accounts, passwords, or emails.
2. **Name Storage**:
   - Key: `wt_anonymous_user`. Update `displayName` while preserving the stable `userId` and `avatarColor`.
3. **Frictionless Link Joining**:
   - If a user has already set a name previously on that device/browser, direct links enter directly without showing the modal.
   - If they are a first-time visitor on that browser or only have an auto-generated guest tag, show the fast 1-field join modal.

---

## Files to Touch
1. `lib/identity.ts`
   - Add `updateUserName(name: string): AnonymousUser`.
   - Add `hasCustomName(): boolean`.
2. `app/page.tsx`
   - Add "Your name" input field with label and placeholder.
   - Validate non-empty name before creating or joining.
   - Pre-fill with existing name from `localStorage`.
3. `app/room/[code]/page.tsx`
   - If `!hasCustomName()`, show a join-name modal before connecting to socket or participating in chat.
   - Make the header user badge clickable to edit display name.
   - Emit `update_user` on name change.
4. `server/index.ts`
   - Add `update_user` listener: update `peer.displayName` in `room.peers` and broadcast `room_participants`.

---

## Security & Architectural Considerations
- Sanitizes usernames: trims whitespace, limits length to 30 characters.
- Prevents empty or whitespace-only names.
- Retains host-authoritative and ephemeral room presence rules.

---

## Acceptance Criteria
1. On `localhost:3000`:
   - A "Your name" input field is displayed.
   - Clicking "+ Create a room" or "Join" with an empty name shows an error: "Please enter your name".
   - Entering "Tasnim" and clicking "+ Create a room" creates the room and shows "Tasnim" in the header and participant list with initials "TA".
2. Direct Link Join:
   - In a fresh incognito window, opening `localhost:3000/room/[code]` presents a "Join Watch Party" modal asking for their name.
   - Entering "Rafi" and clicking "Join room" enters the room with display name "Rafi" and initials "RA".
   - The chat feed shows "Rafi joined the room" and the participant list displays "Rafi" (`RA`).
3. In-Room Rename:
   - Clicking the user's name badge in the top header allows editing their name to e.g. "Rafi S." and updates all connected users in real time.
4. All checks (`npx tsc --noEmit` and build) pass with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit` to verify type safety across all updated files.
- Integration test for `update_user` socket event.

### Manual Test Steps
1. On `http://localhost:3000`:
   - Clear name and click "+ Create a room". Confirm error "Please enter your name" appears.
   - Type "Tasnim" and click "+ Create a room".
   - Verify room header displays "Tasnim" with avatar initials "TA".
2. Open incognito window to the room URL:
   - Verify "Join Watch Party" modal appears asking for name.
   - Type "Rafi" and submit.
   - Verify incognito user enters as "Rafi" (`RA`) and Host sees "Rafi joined the room".
3. In incognito window, click the name badge in header, rename to "Rafi (Mobile)":
   - Verify Host's participant list updates to "Rafi (Mobile)" in real time.
