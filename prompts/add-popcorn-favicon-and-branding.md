# Implementation Prompt: Add Popcorn Favicon & Brand Icon

## Goal
Replace the default Next.js favicon with a custom Popcorn bucket icon (🍿) so that browser tabs, mobile home screens, and bookmarks display a vibrant, recognizable popcorn brand icon. Also optionally pair the icon with the "Popcorn" logo in the header.

---

## Skills Read & Inspected
- `AGENTS.md`: Section 1 (What you are building), Section 6 (Tech stack - Next.js App Router), Section 10 (Checks to run).
- Next.js App Router Metadata file conventions: `app/icon.svg` (or `app/icon.png`) is automatically generated as `<link rel="icon">` with high resolution and SVG scaling across desktop and mobile browsers.

---

## Code Inspected & Design
- Currently, `app/favicon.ico` is the default Next.js black/white icon from `create-next-app`.
- In `app/layout.tsx`, metadata specifies `title: "Popcorn"`, but has no custom icon configuration.
- We will craft a modern, crisp SVG icon:
  - Red & white striped popcorn carton with curved perspective.
  - Fluffy, buttery golden-yellow popcorn kernels bursting over the top rim.
  - High-contrast outlines so it looks sharp on both dark and light browser tab themes.
- Files to create/touch:
  1. `app/icon.svg`: Next.js automatic SVG favicon for all modern browsers.
  2. `public/popcorn.svg`: Static asset for direct reference or manifest.
  3. `app/layout.tsx`: Explicitly link the icon in `metadata.icons`.
  4. `app/room/[code]/page.tsx` & `app/page.tsx`: Add a small, matching popcorn icon badge next to the "Popcorn" brand text.

---

## Decisions and Assumptions
- Use SVG format for `app/icon.svg` because it scales infinitely with zero pixelation on Retina/4K displays and mobile browsers.
- Ensure the icon colors look vibrant on both dark and light browser titlebars.

---

## Files to Touch
1. `app/icon.svg` (NEW: Custom SVG popcorn bucket favicon).
2. `public/popcorn.svg` (NEW: SVG asset for manifest/logos).
3. `app/layout.tsx` (MODIFY: Add `icons: { icon: "/icon.svg", apple: "/icon.svg" }` to metadata).
4. `app/page.tsx` (MODIFY: Add popcorn icon next to Popcorn heading).
5. `app/room/[code]/page.tsx` (MODIFY: Add popcorn icon next to Popcorn logo in header).

---

## Acceptance Criteria
- [ ] The browser tab shows the popcorn icon instead of the default Next.js icon.
- [ ] The Popcorn brand in the landing page and room header displays the popcorn logo.
- [ ] `npx tsc --noEmit` and `npm run build` pass with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit` to verify type safety.
- `npm run build` to verify Next.js production build succeeds.

### Manual Test Steps
1. Open `https://popcorn.ragibshahrier.com` in a browser tab.
2. Check the browser tab: verify the favicon shows the popcorn bucket icon.
3. Check the landing page and watch room header: verify the popcorn brand icon is displayed.
