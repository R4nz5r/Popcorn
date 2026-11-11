# Implementation Prompt: Render Free Hosting Config, Server Wake-Up & Screen Share Disconnected Notice

## Goal
Prepare the Popcorn realtime sync server (`server/index.ts`) for permanently free, zero-trial-expiration deployment on Render (replacing Railway), add CORS support to the `/health` endpoint for frontend wake-up pings, wake the realtime server proactively when users open the app, and show an informative notice instead of failing silently if someone clicks **"Share screen"** while the realtime server is disconnected or waking up.

---

## Skills Read & Inspected
- `AGENTS.md`:
  - Section 1 & 7: Sync-only platform, no file uploads.
  - Section 5 & 6: Web (Next.js App Router on Vercel) and Realtime Sync Server (Socket.io long-running Node process on Render) remain cleanly separated.
  - Section 10: Type checks, lint checks, and multi-tab verification.
  - Section 12: Keep changes minimal, preserve boundaries, get prompt approval before coding.
- `node_modules/next/dist/docs/index.md`: Verified Next.js App Router client component boundary conventions for client-side `useEffect` hooks and browser `fetch` calls.

---

## Code Inspected
1. `package.json`:
   - Line 11: `"server:start": "tsx server/index.ts"`
   - Line 29: `"tsx": "^4.23.13"` is currently inside `devDependencies`. When Render runs `npm install` or `npm ci` with `NODE_ENV=production`, `devDependencies` are omitted, causing `npm run server:start` to fail with `tsx: not found`.
2. `server/index.ts`:
   - Lines 244–252: `http.createServer` handles `/` and `/health` with `200 OK`, but does not include CORS headers (`Access-Control-Allow-Origin`) or `OPTIONS` handling, and checks exact `req.url === "/health"` (which misses query strings).
   - Lines 254–268: `ALLOWED_ORIGIN` / `ALLOWED_ORIGINS` parsing logic currently lives inside Socket.io's `corsOrigin` callback only.
3. `lib/socket.ts`:
   - Lines 78–106: `getSocket()` resolves `NEXT_PUBLIC_SOCKET_URL` (with LAN hostname fallback) and creates the Socket.io client. Does not expose a reusable `getSocketUrl()` or `wakeRealtimeServer()` helper.
4. `app/page.tsx`:
   - Landing page does not trigger a background `/health` ping on mount, meaning a sleeping free-tier server only starts waking up once a user enters a room.
5. `app/room/[code]/page.tsx`:
   - Lines 281–303: `handleConnect` / `handleDisconnect` / `handleConnectError` update `syncStatus`.
   - Lines 1096–1100: In `handleToggleScreenShare`, when `!socketRef.current?.connected`, it calls `socketRef.current?.connect(); return;` silently with no user feedback, making the **"Share screen"** button look broken when the realtime server is offline or waking up.

---

## Decisions and Assumptions
1. **Move `tsx` to `dependencies` in `package.json` (and sync `package-lock.json`)**:
   - Ensures `npm ci` / `npm install` in production environments on Render installs `tsx` cleanly without needing custom `--include=dev` flags.
2. **Add `render.yaml` Blueprint**:
   - Configures a single free Node web service (`popcorn-realtime`) using `buildCommand: npm ci`, `startCommand: npm run server:start`, `healthCheckPath: /health`, `plan: free`, `NODE_ENV: production`, and `ALLOWED_ORIGIN` (`sync: false`).
3. **CORS-Enabled `/health` Endpoint in `server/index.ts`**:
   - Extract a shared `isOriginAllowed(origin)` helper used by both Socket.io CORS and `http.createServer` HTTP requests (`GET /`, `GET /health`, `OPTIONS`).
   - Parse pathname safely (ignoring query params) so uptime monitors and browser wake-up fetches succeed without CORS errors.
4. **Proactive Server Wake-Up (`lib/socket.ts`, `app/page.tsx`, `app/room/[code]/page.tsx`)**:
   - Export `getSocketUrl()` and `wakeRealtimeServer()` from `lib/socket.ts` with a cooldown (e.g. 15s) to prevent duplicate wake-up requests.
   - Call `wakeRealtimeServer()` on mount in `app/page.tsx` and when disconnected/connecting in `app/room/[code]/page.tsx`.
5. **Clear Feedback When Clicking "Share screen" Offline (`app/room/[code]/page.tsx`)**:
   - Add a `screenShareNotice` banner state (auto-cleared once `socket` connects or after a short timeout, with a dismiss button).
   - When `socketRef.current?.connected` is false, trigger `wakeRealtimeServer()` + `socketRef.current?.connect()` and display: `"Connecting to the realtime server — please try again in a few seconds."`
   - If `startScreenShare()` throws a non-user-cancellation, non-unsupported error (e.g., OS permission error), display its message in the notice rather than only logging to console.
6. **No Breaking Changes**:
   - Keep YouTube playback, sync protocol, voice party, chat, and local dev commands (`npm run dev` and `npm run server:dev`) unchanged.

---

## Files to Touch
1. `package.json` & `package-lock.json`:
   - Move `tsx` from `devDependencies` to `dependencies` and regenerate lockfile cleanly.
2. `render.yaml` (New file):
   - Render Blueprint definition for the free Node.js realtime sync service.
3. `server/index.ts`:
   - Share origin validation helper between Socket.io and HTTP `/health` handler, add CORS headers and `OPTIONS` preflight handling, and match pathname without query string.
4. `lib/socket.ts`:
   - Export `getSocketUrl()` and `wakeRealtimeServer()`.
5. `app/page.tsx`:
   - Trigger `wakeRealtimeServer()` in a `useEffect` on mount.
6. `app/room/[code]/page.tsx`:
   - Trigger `wakeRealtimeServer()` on connect errors / disconnected screen share attempts.
   - Display an informative notice banner when **"Share screen"** is clicked while disconnected or when a capture error occurs, and clear it automatically upon socket connection.

---

## Requirements
- `npm run server:start` must execute cleanly even when `devDependencies` are not installed.
- `GET /health` must respond `200 OK` with valid CORS headers for configured `ALLOWED_ORIGIN` values (or `*` when unset).
- Clicking **"Share screen"** while the realtime server is disconnected or waking up must display a clear user-facing notice instead of silently doing nothing.
- Desktop and mobile screen sharing behavior when connected must remain unchanged.

---

## Security Considerations
- HTTP `/health` CORS follows the same `ALLOWED_ORIGIN` / `ALLOWED_ORIGINS` allowlist as Socket.io.
- `render.yaml` contains no secrets (`ALLOWED_ORIGIN` is marked `sync: false`).
- `/health` exposes only `{ status: "ok", activeRooms }` (no user IDs or room codes).

---

## Acceptance Criteria
1. `tsx` is listed in `dependencies` in `package.json` and `package-lock.json` is in sync.
2. `render.yaml` exists at the repository root configured for Render's `free` plan with `/health` health check.
3. `GET /health` on `server/index.ts` returns `200` JSON and proper `Access-Control-Allow-Origin` headers.
4. Clicking **"Share screen"** when the Socket.io server is stopped/offline shows a visible notice banner and attempts reconnection instead of doing nothing.
5. `npx tsc --noEmit` and `npm run lint` pass with 0 errors.

---

## Checks to Run
- `npx tsc --noEmit`
- `npm run lint`
- Verify `curl -i http://localhost:3001/health` returns `200` with CORS headers.

---

## Manual Test Steps
1. Stop the realtime server (`server:dev`) while keeping the Next.js app running (`npm run dev`), then open a room at `http://localhost:3000/room/<code>`.
2. Click **"Share screen"** and confirm a clear notice appears explaining the app is connecting to the realtime server (rather than failing silently).
3. Start the realtime server (`npm run server:dev`), wait for the room badge to show **Host** / **Synced**, confirm the notice clears automatically, and click **"Share screen"** again to verify the screen picker opens normally.
4. Commit and push to GitHub, deploy the Blueprint or Web Service on **Render** (setting `ALLOWED_ORIGIN` to your Vercel URL), update `NEXT_PUBLIC_SOCKET_URL` in **Vercel** to the Render URL, and redeploy Vercel.
5. Optionally add a free **UptimeRobot** HTTP monitor pinging `https://<your-render-service>.onrender.com/health` every 10 minutes to prevent Render's 15-minute idle sleep.

