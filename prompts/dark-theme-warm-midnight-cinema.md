# Implementation Prompt: Popcorn "Warm Midnight Cinema" Dark Theme

## 1. Goal
Implement a premier **Warm Midnight Cinema** Dark Theme across the entire Popcorn platform (Landing Page, Watch Room, Playback Controls, Chat, Participant List, Modals, and Menus). The theme eliminates harsh glare during nighttime watch sessions, complements Popcorn's cozy movie-night brand identity with warm espresso tones (`#121110`) and warm amber/gold accents (`#f59e0b`), features a zero-FOUC (flash of unstyled content) engine with an animated Sun/Moon toggle, and preserves full mobile responsiveness and sync integrity.

---

## 2. Skills & Code Inspected
- **Skills**: Next.js App Router conventions, Tailwind CSS v4, Socket.io client sync flow.
- **Code Inspected**:
  - [app/globals.css](file:///f:/Nextjs/watch-together/app/globals.css): Tailwind v4 setup and root tokens.
  - [app/layout.tsx](file:///f:/Nextjs/watch-together/app/layout.tsx): HTML wrapper, metadata, body classes.
  - [app/page.tsx](file:///f:/Nextjs/watch-together/app/page.tsx): Landing page with room creation & join cards.
  - [app/room/[code]/page.tsx](file:///f:/Nextjs/watch-together/app/room/%5Bcode%5D/page.tsx): Main watch room layout, header, link copying, mobile dropdown menu, and buffering banner.
  - [components/player/PlaybackControls.tsx](file:///f:/Nextjs/watch-together/components/player/PlaybackControls.tsx): Play/pause, progress scrubber, volume, fullscreen, and sync status badge.
  - [components/chat/ChatPanel.tsx](file:///f:/Nextjs/watch-together/components/chat/ChatPanel.tsx): Chat list, input box, send button, and mobile bottom sheet.
  - [components/room/ParticipantList.tsx](file:///f:/Nextjs/watch-together/components/room/ParticipantList.tsx): Participant cards, host badges, user avatars.
  - [components/room/AddSourceModal.tsx](file:///f:/Nextjs/watch-together/components/room/AddSourceModal.tsx): Video URL input dialog.
  - [components/room/UserNameModal.tsx](file:///f:/Nextjs/watch-together/components/room/UserNameModal.tsx): Display name dialog.

---

## 3. Decisions & Palette ("Warm Midnight Cinema")
- **Background**: Deep warm espresso charcoal (`#121110` / `#161514`) instead of cold blue-gray or harsh `#000000`.
- **Card Surfaces**: `#1c1b18` with warm hairline borders (`#2b2925`).
- **Inner Elevated Elements (inputs, dropdown rows)**: `#242320` with border `#33312b`.
- **Text**: Warm linen `#f3efe8` for headings; warm muted stone `#a8a49c` for secondary text; placeholder `#737069`.
- **Accents**:
  - Primary action buttons: Crisp warm parchment (`#f5f2eb`) with dark text (`#141312`) in dark mode, or rich amber accents.
  - Highlights / active indicators: Butter-Popcorn Amber (`#f59e0b` / `#fbbf24`).
  - Synced Badge: Refined dark emerald pill (`bg-emerald-950/60 text-emerald-400 border border-emerald-800/50`).
  - Host Badge: Refined dark sky pill (`bg-sky-950/60 text-sky-400 border border-sky-800/50`).
- **Theme Persistence**: Saved in `localStorage` as `"popcorn-theme"` (`"light" | "dark" | "system"`). Default is system preference.
- **Zero FOUC**: An inline blocking `<script>` in `<head>` applies the `dark` class to `<html>` synchronously before browser paint, eliminating any flash of light mode.
- **Sync Safety**: Video playback logic, YouTube adapter, Socket.io communication, and WebRTC screen sharing remain 100% untouched.

---

## 4. Files to Touch & Create

1. **[app/globals.css](file:///f:/Nextjs/watch-together/app/globals.css)**:
   - Configure Tailwind v4 `@custom-variant dark (&:where(.dark, .dark *));`.
   - Update CSS color variables for `--background` and `--foreground` under `:root` and `.dark`.
   - Add smooth color transition helper for interactive theme switching.

2. **[app/layout.tsx](file:///f:/Nextjs/watch-together/app/layout.tsx)**:
   - Add `suppressHydrationWarning` to `<html>`.
   - Inject the lightweight zero-FOUC theme detector script into `<head>`.

3. **[lib/theme.ts](file:///f:/Nextjs/watch-together/lib/theme.ts)** [NEW]:
   - Helper functions: `getStoredTheme()`, `setTheme(theme)`, `applyTheme(theme)`.
   - Custom hook / listener for reactive theme updates across components.

4. **[components/ui/ThemeToggle.tsx](file:///f:/Nextjs/watch-together/components/ui/ThemeToggle.tsx)** [NEW]:
   - Micro-animated Sun/Moon toggle button.
   - Designed to fit neatly in the Watch Room header and on the Landing Page.

5. **[app/page.tsx](file:///f:/Nextjs/watch-together/app/page.tsx)**:
   - Add dark theme styling to landing card, background, input fields, labels, borders, and "+ Create a room" / "Join" buttons.
   - Place `ThemeToggle` in the top right corner.

6. **[app/room/[code]/page.tsx](file:///f:/Nextjs/watch-together/app/room/%5Bcode%5D/page.tsx)**:
   - Apply dark mode classes to the header, room code copy pill, mobile kebab menu & dropdown, video error banner, and peer buffering indicator.
   - Insert `ThemeToggle` in the desktop navigation bar and in the mobile dropdown.

7. **[components/player/PlaybackControls.tsx](file:///f:/Nextjs/watch-together/components/player/PlaybackControls.tsx)**:
   - Update windowed controls container to support dark mode (`dark:bg-[#1c1b18] dark:border-[#2b2925] dark:text-[#f3efe8]`).
   - Style scrubber track (`dark:bg-[#33312b]`, progress `dark:bg-[#f59e0b]`, thumb `dark:bg-[#fbbf24]`).
   - Tune volume slider and sync status badge for dark background.

8. **[components/chat/ChatPanel.tsx](file:///f:/Nextjs/watch-together/components/chat/ChatPanel.tsx)**:
   - Style chat container, participant tab header, message items, author names, input box, and send button for dark mode.

9. **[components/room/ParticipantList.tsx](file:///f:/Nextjs/watch-together/components/room/ParticipantList.tsx)**:
   - Style participant list rows, host badges, and ensure avatar initials remain crisp and high-contrast.

10. **[components/room/AddSourceModal.tsx](file:///f:/Nextjs/watch-together/components/room/AddSourceModal.tsx)** & **[components/room/UserNameModal.tsx](file:///f:/Nextjs/watch-together/components/room/UserNameModal.tsx)**:
    - Style modal backdrop blur, dialog surface, close buttons, input fields, and action buttons for dark mode.

---

## 5. Security & Edge Case Considerations
- **No XSS**: Theme preference string is strictly validated against an allowlist (`['light', 'dark', 'system']`).
- **No Hydration Mismatch**: `suppressHydrationWarning` on `<html>` and client-mounted state ensures server-rendered HTML matches client hydration without errors.
- **Mobile Safe Areas & Inputs**: Preserves existing `16px` font size on inputs to prevent iOS Safari auto-zooming.
- **Drift/Sync Independence**: Pure styling and presentation changes; zero alteration to Socket.io event emitters or video playback adapter loops.

---

## 6. Acceptance Criteria
1. Clicking the Theme Toggle toggles between Dark and Light mode instantly across all components.
2. The chosen theme persists across page reloads and tab navigations with zero white flash during initial page render.
3. In Dark Mode, the Landing Page, Watch Room, Header, Controls Bar, Chat Panel, Modals, and Mobile Dropdowns display the Warm Midnight Cinema aesthetic without un-themed white patches or unreadable low-contrast text.
4. Video playback, play/pause/seek controls, screen sharing, and realtime sync continue to operate without regression.
5. All automated checks (`npm run lint` and `npm run build`) pass cleanly.

---

## 7. Checks to Run
- `npm run lint` (in `f:\Nextjs\watch-together`)
- `npm run build` (in `f:\Nextjs\watch-together`)
- Manual verification of theme toggle, reload persistence, and watch-room experience.

---

## 8. Manual Test Steps
1. Navigate to the Landing Page (`http://localhost:3000`).
2. Click the Sun/Moon toggle in the top-right corner. Verify smooth transition to Warm Midnight Cinema dark mode.
3. Refresh the page; verify zero white flash during loading and that dark mode remains active.
4. Create or join a room (`/room/[code]`). Verify the room header, video container, controls bar, and chat panel are rendered in the warm midnight theme.
5. Open the "+ Add video" modal. Verify dark dialog styling, paste a YouTube link, and play.
6. Verify the scrubber progress bar, volume controls, and "Synced" badge in dark mode.
7. Open the mobile view (under 768px). Open the mobile kebab menu and mobile chat drawer; verify dark styling.
8. Switch back to light mode; confirm light mode still looks faithful to the original mockups.
