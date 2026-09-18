# Implementation Prompt: Prevent Mobile Keyboard Auto-Zoom on iOS Safari

## Goal
Fix the unwanted mobile auto-zoom behavior when focusing the chat input (or modal inputs) on iOS Safari / mobile devices.
When the user taps the chat "Message" input, the screen must stay at 1.0x scale (normal mobile screen size) with the video and layout intact, rather than zooming in and blowing up the interface.

---

## Skills Read & Inspected
- `AGENTS.md`: Section 3 (mobile responsive layout & exact mockups), Section 6 (Next.js App Router + Tailwind CSS), Section 10 (checks to run).
- `app/layout.tsx`: Inspected root layout configuration. Currently missing Next.js `viewport` export with `maximumScale: 1`.
- `components/chat/ChatPanel.tsx`: Inspected lines 118-190. Mobile input uses `text-sm` (14px).
- `components/room/UserNameModal.tsx` & `components/room/AddSourceModal.tsx`: Both inputs use `text-sm` (14px).
- `app/globals.css`: Inspected base CSS rules.

---

## Code Inspected & Root Cause Analysis
- **The Root Cause**:
  On iOS Safari (iPhone / iPad), Apple enforces a built-in accessibility rule: whenever an `<input>` or `<textarea>` has a computed `font-size` smaller than `16px` (1rem / Tailwind `text-sm`), Safari **automatically zooms the entire viewport in to ~120%** when focused.
  Because the viewport zooms in, the video player gets pushed off the top of the screen, the interface overflows horizontally, and the layout looks broken and distorted.
- **The Solution**:
  1. Set the font size of all inputs on mobile screens to `16px` (`text-base md:text-sm`). At 16px, iOS Safari recognizes the text as sufficiently legible and **completely disables auto-zooming**.
  2. In `app/layout.tsx`, export Next.js `viewport: Viewport` with `width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false`.
  3. In `app/globals.css`, add a mobile fallback rule `@media screen and (max-width: 767px) { input, select, textarea { font-size: 16px !important; } }` as an ironclad safety net against any future inputs triggering zoom.

---

## Decisions and Assumptions
- Use `text-base md:text-sm` on inputs so that mobile devices receive 16px (zero auto-zoom) while desktop retains the compact 14px styling.
- Export standard Next.js 15/16 `Viewport` object in `app/layout.tsx`.
- Visual styling (height, padding, borders, colors) remains 100% faithful to the design mockup.

---

## Files to Touch
1. `app/layout.tsx` (MODIFY: export `viewport: Viewport` configuration).
2. `components/chat/ChatPanel.tsx` (MODIFY: upgrade mobile input and textarea to `text-base md:text-sm`).
3. `components/room/UserNameModal.tsx` (MODIFY: update input to `text-base md:text-sm`).
4. `components/room/AddSourceModal.tsx` (MODIFY: update input to `text-base md:text-sm`).
5. `app/globals.css` (MODIFY: add `@media (max-width: 767px)` input font-size rule).

---

## Acceptance Criteria
- [ ] Tapping the chat "Message" input on iPhone Safari does NOT zoom the screen in. The page remains at 1.0x scale.
- [ ] Tapping the name modal or add-source modal inputs does NOT zoom the screen in.
- [ ] The video player and controls remain visible and properly sized when the keyboard appears.
- [ ] Both `npx tsc --noEmit` and `npm run build` pass with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit` to verify type safety.
- `npm run build` to verify Next.js production build succeeds.

### Manual Test Steps
1. On iPhone Safari, open a room at `https://popcorn.ragibshahrier.com`.
2. Tap the **Message** input in the chat drawer.
3. Verify that the keyboard pops up without any viewport zooming or layout distortion.
4. Type a message and send it; verify everything stays centered and sharp.
