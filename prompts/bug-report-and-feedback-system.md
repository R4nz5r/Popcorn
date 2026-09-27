# Bug Report & Feedback System with Discord Webhook & MongoDB

## Goal
Implement a feedback and bug reporting system for Popcorn:
1. Users in a room or on the landing page can click a subtle "Feedback & Bug Report" button to report bugs, sync issues, audio problems, or feature suggestions.
2. The modal auto-captures diagnostic context (room code, active video ID, browser/OS device info) along with user-selected category, message, and optional email.
3. The report is securely saved to MongoDB Atlas and dispatched in real-time to the developer's Discord channel via Discord Webhook as a rich embed card.

## Context & Skills Read
- `AGENTS.md` (stateless API routes in App Router, MongoDB Atlas via Mongoose, responsive tokens, prompt-first workflow).
- Inspected code:
  - `lib/mongodb.ts`: Database connection utility.
  - `lib/models/Room.ts`: Mongoose schema and model patterns.
  - `app/api/rooms/route.ts`: API route structure with IP rate limiting.
  - `app/room/[code]/page.tsx`: Desktop navbar and mobile action dropdown menu.
  - `app/page.tsx`: Landing page layout and top bar.

## Decisions & Assumptions
- Use the Discord Webhook URL provided by the user (`https://discord.com/api/webhooks/1553801050409148608/...`) configured as `DISCORD_WEBHOOK_URL` in `.env.local`.
- Use a hybrid storage approach: save each report in MongoDB (`feedbacks` collection) and forward to Discord. If the Discord Webhook is missing or temporarily unavailable, reports are still safely preserved in MongoDB.
- Protect the feedback API route with sliding-window IP rate limiting (max 5 submissions per IP per minute) and input length bounds (message: 5-2000 chars) to prevent spam.
- Auto-attach client diagnostics: Browser/Device (navigator.userAgent), screen resolution, current room code, and current YouTube video ID without requiring the user to type them.
- Follow the Popcorn design system: warm cream light mode (`#fbf9f5`, `#1f1f1d`) and warm dark mode (`#1c1b18`, `#f3efe8`), matching modal styling from `design/3-add-source-modal.jpg`.

## Files to Touch
- `.env.local` and `.env.example`: add `DISCORD_WEBHOOK_URL`.
- `lib/models/Feedback.ts`: Mongoose schema for persistent feedback records.
- `app/api/feedback/route.ts`: API route for receiving feedback, rate limiting, MongoDB insert, and Discord webhook dispatch.
- `components/feedback/FeedbackModal.tsx`: Reusable feedback modal with category chips, text area, optional email, auto-diagnostics, and animated success state.
- `app/room/[code]/page.tsx`: Add trigger icon button to desktop header and item in mobile dropdown.
- `app/page.tsx`: Add trigger button to landing page top bar and footer link.

## Requirements
1. **Feedback Modal**:
   - Categories:
     - 🐞 `Bug / Glitch` (default)
     - ⏱️ `Playback / Sync`
     - 🎙️ `Voice / Audio`
     - 💡 `Idea / Feature`
     - ❓ `Other`
   - Inputs:
     - Category selector (pill buttons).
     - Message textarea with placeholder and validation.
     - Optional email input for follow-ups.
     - Diagnostic summary pill showing current room / video / browser.
   - States: Idle, Submitting (spinner/disabled), Success (confirmation checkmark + message, auto-close after 2s), Error message.
   - Backdrop click and Escape key dismissal.
2. **Backend API (`/api/feedback`)**:
   - Validate payload (`category`, `message` length between 3 and 2000 characters).
   - Rate limit by IP (5 requests / 60 seconds).
   - Store record in MongoDB Atlas.
   - If `DISCORD_WEBHOOK_URL` is set, format a rich Discord Embed:
     - Color-coded by category (Red for Bug/Sync, Amber for Audio, Green for Feature, Gray for Other).
     - Fields: Category, Room Code, Video Link, Browser/OS, User Email.
     - Message in description.
     - Timestamp footer.
   - Return `{ success: true }`.
3. **Placements**:
   - Watch Room desktop header: subtle icon button beside ThemeToggle with tooltip "Feedback & Bug Report".
   - Watch Room mobile dropdown: "Report Bug / Feedback" option with icon.
   - Landing page top bar: feedback icon button next to ThemeToggle.

## Security Considerations
- Sanitize and trim inputs; enforce maximum length on message (2000) and email (200).
- Strip any markdown injection that could break Discord embed formatting.
- Rate limiting prevents denial of service or Discord webhook rate exhaustion (Discord limit is 30 req/min per webhook).

## Acceptance Criteria
- [ ] Clicking the feedback button opens the modal cleanly in both light and dark mode.
- [ ] Submitting a report sends a formatted embed message directly to the `#popcorn-reports` Discord channel.
- [ ] Submitting a report persists the feedback in MongoDB Atlas.
- [ ] Room code, active video URL, and device/browser are accurately attached in the Discord notification.
- [ ] Empty or invalid messages show inline validation errors without submitting.
- [ ] Rate limiting kicks in if spammed.
- [ ] Modal displays an animated success confirmation and closes cleanly.

## Checks to Run
- `npx tsc --noEmit`
- `npx eslint components/feedback/FeedbackModal.tsx app/api/feedback/route.ts`
- Live test submission to confirm Discord webhook ping.

## Manual Test Steps
1. Open a room (`/room/[code]`).
2. Click the feedback icon in the top header.
3. Select "🐞 Bug / Glitch", enter "Testing bug report sync from room", enter optional email, and click Submit.
4. Verify success confirmation in UI.
5. Check your `#popcorn-reports` channel in Discord — verify the formatted embed card arrived with the room code and device details.
6. Verify mobile dropdown also has the "Report Bug / Feedback" item.
