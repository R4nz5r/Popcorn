# Implementation Prompt: Room Creation and Join-by-Code Flow

## 1. Goal
Build the room creation and join-by-code flow for Watch Together:
- The landing page reproducing `design/1-landing.jpg` exactly in layout, colors, typography, and states.
- The Room Mongoose model adhering to AGENTS.md data modeling specifications.
- The room creation API route (`POST /api/rooms`).
- The room lookup/join verification API route (`GET /api/rooms/[code]`).
- Anonymous by default identity handling (no auth wall for creating or joining a room).
- A room landing destination page (`app/room/[code]/page.tsx`) to complete the user flow.

---

## 2. Skills & References Read
- `AGENTS.md`: Full specification, core loop, UI match rules (Section 3), tech stack (Section 6), decisions (Section 7), data model (Section 9), checks (Section 12).
- `node_modules/next/dist/docs/`: Next.js 16 App Router routing, server/client boundaries, Route Handlers (`app/api/.../route.ts`), asynchronous route parameters (`params: Promise<{ code: string }>`).
- `design/1-landing.jpg`: Reference mockup for landing page and join card.
- `design/2-watch-room.jpg` through `design/5-mobile-watch-room.jpg`: Design tokens, color palette (`#f3efe8`), typography, and styling consistency.

---

## 3. Code Inspected
- `package.json`: Next.js 16.3.5, React 19.2.8, Tailwind CSS v4 (`@tailwindcss/postcss` & `tailwindcss`), TypeScript 5. Mongoose not yet installed.
- `app/layout.tsx`: Root HTML and Body using Geist sans font.
- `app/globals.css`: Tailwind v4 import and base styles.
- `app/page.tsx`: Default Next.js starter template.
- `tsconfig.json`: `@/*` path alias configured pointing to `./*`.

---

## 4. Decisions and Assumptions (Refined with Feedback)
1. **Durable Data Store & Fail-Fast Configuration**:
   - Install `mongoose`.
   - Implement `lib/mongodb.ts` with connection caching (`global._mongooseCache`) for Next.js hot-reloads.
   - **Fail fast**: If `MONGODB_URI` is not defined in environment variables, throw an immediate, clear error rather than using a silent in-memory fallback. Misconfigurations must fail loudly.
2. **Room Code Format**:
   - Generate uppercase, human-friendly 6-character alphanumeric codes (e.g., `K8M2X9`) using an unambiguous alphabet (`23456789ABCDEFGHJKMNPQRSTUVWXYZ`, excluding `0`, `O`, `1`, `I`, `L`).
   - Store normalized uppercase in MongoDB; lookups are case-insensitive so users can type uppercase or lowercase interchangeably.
3. **Room Schema (Mongoose)**:
   - `code`: String, required, unique, uppercase, indexed.
   - `hostId`: String, required (ephemeral user ID).
   - `participants`: Array of strings (initialized with `hostId`).
   - `persistentSlug`: String, optional, sparse index (for authenticated named rooms).
   - `activeVideo`: Subdocument `{ type: 'youtube' | 'upload', videoId: String, duration: Number, transcodeStatus: String }`.
   - `status`: String, enum `['active', 'closed']`, default `'active'`.
   - Timestamps: `createdAt`, `updatedAt`.
4. **Explicit Separation: REST vs Realtime Sync Participant Tracking**:
   - REST API `POST /api/rooms` creates the room document and records `hostId`.
   - REST API `GET /api/rooms/[code]` verifies room existence and returns metadata before navigation.
   - Active ephemeral participant presence (connected peers, leaves, heartbeats) is explicitly deferred to the Socket.io realtime server and Redis per AGENTS.md Section 5 & 9 ("Redis: ephemeral room state... connected peers — never the durable record").
5. **Anonymous Identity**:
   - Implement `lib/identity.ts` for browser-side ephemeral identity in `localStorage` (`userId`, `displayName`, `avatarColor`).
   - If not present, auto-generates on first visit so every visitor has an anonymous ID without an account.
6. **Exact UI Reproduction (`design/1-landing.jpg`)**:
   - Background: `#f3efe8` warm neutral background.
   - Card: centered white card, `rounded-3xl`, subtle border `#e8e4dc`, padding, soft shadow.
   - Title: "Watch together" (bold, dark charcoal `#1f1f1d`).
   - Subtitle: "Sync any video with friends, live" (`#6b6b66`).
   - Button: "+ Create a room" (dark charcoal `#262624`, white text, rounded-xl, hover `#1a1a18`, loading state).
   - Divider: thin line with "or" centered.
   - Join controls: "Enter room code" input + "Join" button.
   - Inline error display if room is not found or connection fails.
7. **Room Destination (`app/room/[code]/page.tsx`)**:
   - Verifies the room code, displays room code in clean header, copy button, and preparation container for the watch room UI.

---

## 5. Files Expected to Touch
- `package.json` (add `mongoose`)
- `.env.example` (document `MONGODB_URI`)
- `lib/mongodb.ts` (MongoDB Atlas connection manager with fail-fast validation)
- `lib/models/Room.ts` (Mongoose Room schema and TypeScript interface)
- `lib/identity.ts` (anonymous user identity helper)
- `lib/code-generator.ts` (uppercase room code generator with unambiguous character set)
- `app/api/rooms/route.ts` (POST room creation endpoint)
- `app/api/rooms/[code]/route.ts` (GET room lookup/validation endpoint)
- `app/page.tsx` (landing page UI matching `design/1-landing.jpg`)
- `app/room/[code]/page.tsx` (room destination page)

---

## 6. Requirements
- Anonymous room creation and joining without any auth gate.
- Uppercase 6-character room codes; case-insensitive lookup.
- Fast failure when `MONGODB_URI` is unset, with descriptive configuration error.
- Landing page visually and functionally mirrors `design/1-landing.jpg`.
- Mobile responsive layout adapting gracefully down to mobile screens.
- Zero TypeScript errors, zero lint errors, successful production build.

---

## 7. Security Considerations
- Input validation: Sanitize and validate room codes (length check, alphanumeric characters only).
- Database credentials: Read strictly from `process.env.MONGODB_URI` on the server, never exposed to client.
- Code collision prevention: Database unique index + generation retry logic.

---

## 8. Acceptance Criteria
- [ ] Landing page matches `design/1-landing.jpg` (colors, spacing, typography, states).
- [ ] Clicking "+ Create a room" creates a room in MongoDB, generates an uppercase 6-char code, and navigates to `/room/[code]`.
- [ ] Entering a valid room code (in uppercase or lowercase) and clicking "Join" verifies the room and navigates to `/room/[code]`.
- [ ] Entering a nonexistent room code displays a clean inline error ("Room not found") without crashing.
- [ ] Mongoose Room model matches AGENTS.md schema requirements.
- [ ] Missing `MONGODB_URI` fails fast with a clear error message.
- [ ] `npm run lint` passes with 0 errors.
- [ ] `npx tsc --noEmit` passes with 0 errors.
- [ ] `npm run build` succeeds.

---

## 9. Checks to Run
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- API verification: test `POST /api/rooms` and `GET /api/rooms/[code]`
- Manual browser verification against `design/1-landing.jpg` and join flow

---

## 10. Exact Manual Test Steps
1. Run `npm run dev` to start the local Next.js server.
2. Open `http://localhost:3000` in the browser.
3. Verify visual design against `design/1-landing.jpg`.
4. Click "+ Create a room":
   - Observe button enters loading state.
   - Confirm redirection to `/room/[code]`.
   - Confirm uppercase room code is displayed.
5. Copy the generated code, navigate back to `http://localhost:3000`.
6. Enter code in lowercase or uppercase and click "Join":
   - Confirm redirection to `/room/[code]`.
7. Enter a nonexistent code (e.g. `ZZZZZZ`) and click "Join":
   - Confirm inline error "Room not found".
