# Implementation Prompt: Mobile Responsive Navbar with Action Dropdown Menu

## Goal
Implement a clean, mobile-first responsive navbar layout for the watch room (`app/room/[code]/page.tsx`). Preserve the exact desktop layout matching `design/2-watch-room.jpg` on `md:` breakpoints, while collapsing secondary actions (`Share screen`, `Copy room link`, user identity & change name) into a sleek mobile action dropdown menu (`flex md:hidden`), keeping `+ Add video` directly accessible on mobile.

---

## Skills & Rules Read
- `AGENTS.md`:
  - Section 2: Implementation workflow (inspect code, write prompt in `prompts/`, get approval via question panel, execute, verify, report).
  - Section 3: UI work — desktop mockup in `design/2-watch-room.jpg` must be kept exact. Mobile layout must adapt sensibly without restyling desktop.
  - Section 10: Checks to run (`npx tsc --noEmit`, `npm run lint`, multi-device / responsive manual tests).

---

## Code Inspected
1. `app/room/[code]/page.tsx`:
   - Lines 880–985: Current `<header>` layout.
   - Left side: Logo Link (`Watch together`) + Room code badge (`Room: {room.code}` + `Copy link` button).
   - Right side: `Share screen` button + `+ Add video` button + Current user profile chip (`Avatar + Name + Edit icon + Host badge`).
   - Total width exceeds ~600px, causing flex items to wrap, overlap, or truncate on mobile screens (iPhone width 375px–390px).
   - Handlers already available: `handleCopyLink`, `handleToggleScreenShare`, `setIsModalOpen`, `setIsNameModalOpen`, `setIsInitialNamePrompt`.

---

## Decisions & Design Specifications
1. **Desktop Fidelity (`md:flex`)**:
   - The desktop navbar layout remains 100% identical to the reference mockup (`design/2-watch-room.jpg`).
   - Hidden on mobile (`hidden md:flex`), visible on desktop (`md:flex`).

2. **Mobile Layout (`< md:`)**:
   - **Header Height & Spacing**: Single clean row (`h-14` / `py-2.5 px-3`), `items-center justify-between`.
   - **Left Zone**:
     - Brand Title: `Watch together` (font-bold text-sm tracking-tight text-[#1f1f1d]).
     - Compact Room Badge: `<button onClick={handleCopyLink}>` showing `{room.code}` with copy icon and feedback (`Copied!` tooltip/label).
   - **Right Zone**:
     - **Primary Action**: `+ Add video` button kept visible (`text-xs font-semibold px-2.5 py-1.5 bg-[#262624] text-white rounded-lg`).
     - **Mobile Menu Trigger**: Compact trigger button displaying the user's initials avatar + kebab dots/chevron icon (`•••`).
   - **Mobile Action Dropdown Menu**:
     - Floating popover positioned at top-right below the trigger with smooth animation, glassmorphism background (`bg-white/95 backdrop-blur-md border border-[#e5e2db] rounded-2xl shadow-xl p-2 w-64 z-50`).
     - **User Section**: Avatar, display name, Host badge, and "Edit name" button.
     - **Divider**: Subtle separator line.
     - **Share Screen Action**: Status-aware button (Active: "Stop sharing", Inactive: "Share screen", Disabled: "Shared by [Name]").
     - **Copy Room Link Action**: "Copy room link" button with feedback toast/indicator.
     - **Room Status**: Participant count badge (`X watching`).
   - **Interactions**:
     - Click-outside listener closes the dropdown.
     - Escape key closes the dropdown.
     - Selecting an action (e.g. `+ Add video`, `Share screen`, `Edit name`) automatically closes the dropdown.

---

## Files to Touch
1. `app/room/[code]/page.tsx`

---

## Security & Performance Considerations
- All click-outside event listeners cleaned up properly in `useEffect`.
- No new heavy third-party UI dependencies added; uses native React state and Tailwind CSS utilities.
- Safe Area insets respected for mobile notches/dynamic islands.

---

## Acceptance Criteria
1. On desktop viewports (>= 768px):
   - Header is visually unchanged, matching `design/2-watch-room.jpg` exactly.
2. On mobile viewports (< 768px, tested at 375px and 390px):
   - Header fits on a single neat row without wrapping, horizontal overflow, or clipped text.
   - `+ Add video` button is directly tappable.
   - Mobile menu trigger button opens the action dropdown.
   - Tapping "Share screen", "Copy room link", or "Change name" executes correctly.
   - Tapping outside or pressing Escape closes the dropdown.
3. `npx tsc --noEmit` and `npm run lint` pass with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit`
- `npm run lint`

### Manual Test Steps
1. Resize browser window to mobile width (375px and 390px).
2. Verify navbar fits cleanly in a single row without horizontal overflow.
3. Tap `+ Add video` -> verify Add Source modal opens.
4. Tap the mobile menu trigger -> verify dropdown opens cleanly.
5. In dropdown, tap "Copy room link" -> verify link is copied and feedback appears.
6. In dropdown, tap "Change name" -> verify name change modal opens.
7. Tap outside -> verify dropdown closes.
8. Switch viewport back to desktop (1280px) -> verify full desktop navbar renders as before.
