# Implementation Prompt: Fix Mobile Hydration and Room Page Suspense Hang

## Goal
Resolve the two root causes preventing mobile devices from joining watch rooms:
1. Eliminate `crypto-browserify` bundling on the homepage caused by `import crypto from "crypto"` in `lib/code-generator.ts`, which breaks client script evaluation and React hydration on mobile browsers over HTTP.
2. Replace `use(params)` in `app/room/[code]/page.tsx` with Next.js's standard `useParams()` hook, preventing the client component from suspending indefinitely without a Suspense boundary and allowing `useEffect` / `fetchRoom()` to run immediately.

---

## Skills Read & Inspected
- `AGENTS.md`:
  - Section 2: Implementation loop (read docs, inspect code, write prompt in `prompts/`, get user approval, execute, verify, report).
  - Section 4 & 5: Client/server boundaries and Next.js App Router rules.
  - Section 10: Multi-device verification, type checks, lint checks.

---

## Code Inspected
1. `lib/code-generator.ts`:
   - Line 1: `import crypto from "crypto";`
   - When `sanitizeRoomCode` is imported in `app/page.tsx` (`"use client"`), Turbopack bundles Node's `crypto-browserify` polyfill. On mobile browsers over local HTTP (`http://192.168.0.116:3000`), evaluating this polyfill fails or blocks React hydration, leaving `<button type="button">Join</button>` with no attached click listener so tapping does nothing.
   - Using standard `globalThis.crypto.getRandomValues` requires 0 Node module imports and runs natively in both Node 18+ and all mobile web browsers.
2. `app/room/[code]/page.tsx`:
   - Line 44: `const { code } = use(params);` where `params` is a `Promise`.
   - In Next.js App Router Client Components (`"use client"`), wrapping dynamic params in React 19 `use()` without an outer `<Suspense>` boundary causes the component to suspend indefinitely during client hydration.
   - As a result, `useEffect` never executes, `setIsLoading(false)` is never reached, and the page remains stuck on `Loading room {code}...` forever.
   - `useParams<{ code: string }>()` from `next/navigation` is synchronous, never suspends, and provides the room code immediately.

---

## Decisions and Assumptions
1. **Remove Node built-in from `code-generator.ts`**:
   - Replace Node `crypto.randomBytes` with `globalThis.crypto.getRandomValues(new Uint8Array(6))` (with a fallback to `Math.random` if ever unavailable).
   - Completely removes `crypto-browserify` from all client chunks.
2. **Standardize Client Route Param Retrieval in `RoomPage`**:
   - Replace `use(params)` with `useParams<{ code: string }>()` from `next/navigation`.
   - Remove unused `use` import from `react`.
   - `fetchRoom()` in `useEffect` will fire immediately on mount, set room state, and transition `isLoading` to `false`.

---

## Files to Touch
1. `lib/code-generator.ts`
   - Rewrite `generateRoomCode` to use universal `globalThis.crypto` and remove `import crypto`.
2. `app/room/[code]/page.tsx`
   - Use `useParams()` from `next/navigation` and remove `use(params)`.

---

## Security Considerations
- Cryptographically secure pseudo-random values remain enforced via `globalThis.crypto.getRandomValues`.
- Room code generation and sanitization logic remains identical.

---

## Acceptance Criteria
1. On a mobile phone navigating to `http://192.168.0.116:3000`:
   - React hydration succeeds; tapping "Join" immediately triggers `handleJoinRoom`.
2. When navigating to `/room/[code]` on mobile (either via "Join" or direct URL):
   - The room loads immediately (the spinner and "Loading room..." disappear and the room UI renders).
   - Socket connection is established on port 3001.
3. `npx tsc --noEmit` and `npx eslint app/room/[code]/page.tsx lib/code-generator.ts` pass with 0 errors and 0 warnings.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit`
- `npx eslint app/room/[code]/page.tsx lib/code-generator.ts app/page.tsx`

### Manual Test Steps
1. On mobile phone, open `http://192.168.0.116:3000`.
2. Enter your name, enter `Q28K88`, tap "Join".
3. Verify that the mobile browser transitions to `/room/Q28K88` and displays the watch room interface (video player, participant list, chat) without hanging on "Loading room...".
