# Implementation Prompt: Production Hardening (OpenGraph Social Cards, CORS Lockdown, Rate Limiting)

## 1. Goal
Harden the Popcorn platform for production by:
1. Adding rich OpenGraph and Twitter social preview metadata in `app/layout.tsx` so room links shared on WhatsApp, Discord, iMessage, and Twitter render engaging cards.
2. Hardening Socket.io CORS in `server/index.ts` to support an `ALLOWED_ORIGIN` / `ALLOWED_ORIGINS` environment variable while retaining local development support.
3. Adding an IP-based rate limiter to `app/api/rooms/route.ts` (max 15 rooms per minute per IP) to protect MongoDB Atlas from automated bot spam.

---

## 2. Skills & Code Inspected
- **Skills**: Next.js App Router Metadata API, Socket.io CORS configuration, Next.js API Route rate limiting.
- **Code Inspected**:
  - [app/layout.tsx](file:///f:/Nextjs/watch-together/app/layout.tsx): Current metadata object with basic title/description/icon.
  - [server/index.ts](file:///f:/Nextjs/watch-together/server/index.ts): Current `Server(server, { cors: { origin: "*" } })`.
  - [app/api/rooms/route.ts](file:///f:/Nextjs/watch-together/app/api/rooms/route.ts): `POST /api/rooms` handler.

---

## 3. Decisions & Assumptions
- **OpenGraph & Twitter Card**: Use standard OpenGraph and Twitter summary cards referencing `/icon.svg` and tagline: *"Watch YouTube videos in real-time sync with friends. Synchronized playback, live chat, and screen sharing."*
- **CORS Configuration**: Read `process.env.ALLOWED_ORIGIN` or `process.env.ALLOWED_ORIGINS` (comma-separated). If unset, fallback gracefully to `*` to ensure local development and testing never break.
- **Rate Limiting**: Lightweight in-memory Map with automatic sliding-window timestamp pruning. Allows up to 15 room creations per IP every 60 seconds. Exceeding returns `429 Too Many Requests`.

---

## 4. Files to Touch
1. **[app/layout.tsx](file:///f:/Nextjs/watch-together/app/layout.tsx)**:
   - Expand `export const metadata: Metadata` with `openGraph`, `twitter`, `keywords`, and `applicationName`.
2. **[server/index.ts](file:///f:/Nextjs/watch-together/server/index.ts)**:
   - Configure dynamic `origin` in `Server` constructor with `ALLOWED_ORIGIN` support.
3. **[app/api/rooms/route.ts](file:///f:/Nextjs/watch-together/app/api/rooms/route.ts)**:
   - Add IP extraction and rate-limiting check before creating room documents.

---

## 5. Security & Edge Case Considerations
- **IP Spoofing**: Use `x-forwarded-for` first IP, fallback to `x-real-ip`.
- **Memory Safety**: Clean up old rate-limit entries when map exceeds threshold to prevent memory leaks in long-running processes.
- **Zero Breaking Changes**: When no environment variables are set, behavior is 100% backwards-compatible.

---

## 6. Acceptance Criteria
1. Social card meta tags (`og:title`, `og:description`, `og:image`, `twitter:card`) are served in HTML `<head>`.
2. Socket.io accepts connections from origins configured in `ALLOWED_ORIGIN` or `*` when unset.
3. API route `/api/rooms` enforces max 15 requests per 60s per client IP, returning HTTP 429 when exceeded.
4. `npm run lint` and `npm run build` pass with 0 errors.

---

## 7. Checks to Run
- `npm run lint`
- `npm run build`
- Verify OpenGraph meta tags via curl / Invoke-WebRequest.
- Verify rate limiting via rapid API calls.

---

## 8. Manual Test Steps
1. Request `http://localhost:3000` and inspect `<meta property="og:title">` and `<meta name="twitter:card">`.
2. Test `POST /api/rooms` to confirm normal creation returns HTTP 201.
3. Connect socket client to confirm realtime sync functions without CORS errors.
