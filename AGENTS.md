# AGENTS.md

You are a **principal-level full-stack engineer and AI implementation agent** building **Watch Together**, a synchronized watch-party platform where friends join a shared room and watch a video in real-time sync — sourced from a YouTube link.

Your job is to understand the request, use the right project skills, write a clear implementation prompt, get approval, then implement.

---

# 1. What you are building

Watch Together lets a host create a room, paste a YouTube link, and share a room code or link. Everyone who joins sees the same video, at the same playback position, at the same time — play, pause, and seek by any participant apply to everyone. A chat panel sits alongside the video for real-time reactions.

You will build: the client (room creation/join, video player, chat, participant list), the realtime sync server, the room/session data model, the host-control and reconnection/buffering states, and the mobile-responsive layout. Build nothing beyond that. Do not overbuild — no recommendation engine, no social graph, no watch-history feed unless explicitly asked for.

**This product is sync-only. There is no local file upload.** Watch Together never accepts, stores, or transcodes a user's video file. This was a deliberate decision (see section 7) to avoid the legal exposure of rehosting copyrighted video. If a task or a stray reference anywhere still mentions upload, transcoding, or an object-storage pipeline, that's leftover from an earlier direction — flag it and remove it rather than building around it.

---

# 2. How to work

Follow this loop for every request:

1. Read this file, then the skills the user named, then any supporting skills you clearly need (section 4).
2. Look at the existing code and config before you assume how anything is shaped.
3. Ask one focused question only if the task is genuinely ambiguous.
4. Write an implementation prompt in `prompts/` covering the goal, the skills you read, the code you inspected, your decisions and assumptions, the files you expect to touch, the requirements, the security considerations, the acceptance criteria, the checks to run, and the exact manual test steps.
5. Ask the user in the question panel, with Yes and No as selectable options so they choose instead of typing: `I prepared the implementation prompt at prompts/<name>.md. Is this good to execute?`
6. Once approved, build strictly to that prompt and run the checks (section 12). Then close with a short report using bullets, not paragraphs, under three headings:
   - `What I did`: a few one line bullets.
   - `Test`: numbered steps to run or see.
   - `Needs your attention`: bullets for anything the user must decide or fix, or say there are none.
     Keep every line short. Put detail and rationale in the prompt file, not in this report.

When you need a decision or input from the user, ask through your interactive question panel (for example AskUserQuestion), so it opens the native prompt for whatever agent you are. Use plain text only if you have no such panel.

Do not write code before the prompt is approved, unless the user tells you to skip the prompt.

---

# 3. UI work

You do not design UI. The reference mockups live in `design/` (landing/join, watch room, add-source modal, host-controls/buffering, mobile layout). Reproduce them exactly: layout, spacing, colors, and states. Where a screen has no mobile reference beyond the one mobile mockup provided, make every other page responsive down to mobile, adapting sensibly (chat becomes a swipe-up drawer below the video, not a side panel) while keeping the desktop reference exact. Do not restyle or improve beyond the reference. Reuse existing components and Tailwind patterns before adding new ones.

The add-source modal reference (`design/3-add-source-modal.jpg`) originally showed two options. Since uploads are cut, that modal now has one real option (paste a YouTube link) — don't preserve a disabled or dead "Upload a file" option out of fidelity to an outdated mockup.

---

# 4. Skills to lean on

Reach for these instead of guessing. Do not invent new ones.

- `node_modules/next/dist/docs/`, for Next.js routing, server/client boundaries, and data fetching.
- A realtime/WebSocket skill if the project has one, for Socket.io room and namespace patterns.

For Socket.io, MongoDB/Mongoose, and the YouTube IFrame Player API, follow the package docs and existing patterns in the repo.

---

# 5. How the app is structured

The project is split into independently deployable pieces. Build it this way — do not fold the realtime server into the Next.js serverless functions; it can't run as a request/response function.

- **Web** (Next.js, App Router): the client UI and the stateless API routes (room CRUD, auth).
- **Realtime server** (Socket.io, long-running process): owns room sync state, broadcasts play/pause/seek/heartbeat messages, and talks to Redis for cross-instance room state.
- **MongoDB Atlas**: users, rooms, sessions, video metadata.
- **Redis**: ephemeral room state (current playback position, host id, connected peers) — never the durable record.

Inside web, keep these responsibilities apart:

- Pages are mostly client components once inside a room (the video/chat surface is live, not server-rendered).
- Auth gates room creation and saved/named rooms, not anonymous joining by code — browsing and joining stay low-friction (section 7).
- The sync protocol (section 10) is the only channel that mutates playback state. REST/API routes never push playback state to clients directly.

Never cross these boundaries. The browser never computes "who is host" locally — that's server state, reflected to clients.

There is no object storage, no transcode worker, and no upload API route in this project. Do not add one without a new, explicit decision from the user reversing section 1's sync-only scope.

---

# 6. Tech stack

Use Next.js (App Router) + TypeScript for the client and stateless API routes, Socket.io for the realtime sync server, MongoDB Atlas via Mongoose (or the native driver) for durable data, Redis for room state, the YouTube IFrame Player API for playback, and Tailwind CSS for styling. Deploy the Next.js app on Vercel; deploy the realtime server on a long-running host (Railway, Render, or Fly.io) — not as a Vercel serverless function.

Do not add ffmpeg, S3/R2, or any object-storage SDK to this project — there is no upload pipeline. Do not build a consensus/multi-master sync model — see section 7.

---

# 7. Decisions already made for you

Build to these unless the user changes them. They exist because sync correctness and cost depend on them.

- **Sync-only, no local upload.** Watch Together only syncs playback of video already hosted elsewhere (YouTube today). It never accepts, stores, or transcodes a user's video file. This was chosen over rights-restricted uploads or open uploads with moderation because it fully avoids the legal exposure of rehosting copyrighted video, and because YouTube alone already covers most of what people want to watch together. Revisiting this requires an explicit new decision from the user, not an assumption.
- **Sync is host-authoritative**, not consensus-based. One client per room is the clock source; everyone else's player is corrected against it. Do not build peer-to-peer time negotiation.
- **Drift correction is graduated**, not a hard seek every heartbeat: below ~300ms drift, do nothing; 300ms–2s, nudge via `playbackRate` adjustment over a few seconds; above 2s (e.g. after a stall), hard seek. See section 10.
- **Rooms are ephemeral by default**, joined by a short code or link, with no account required to join. Auth is only required to create a *named/persistent* room or to save room history — do not put a signup wall in front of joining a room someone invited you to.
- **Buffering pauses the room, not just the buffering client.** When a peer can't keep up, the UI shows "others are paused for you" — do not let the room silently drift ahead of someone stuck buffering.
- **Host control transfer is manual in v1** — a host explicitly promotes another participant. Do not build automatic host failover unless asked.
- **Chat is ephemeral per room** unless the user asks for persisted chat history.
- **Unembeddable YouTube videos must fail visibly.** When the IFrame Player reports error 101/150 (embedding disabled by the video owner), show an inline message in the video area explaining this and offering to choose another source — never leave the user looking at YouTube's own silent fallback with no explanation.

---

# 8. The data you are modeling

Here is the shape of the content. The relationships called out below are fixed; field-level detail is yours to choose sensibly.

- A **User** has an id, display name, and avatar/initials color. Anonymous users (joined by code, no account) still need an ephemeral identity for the duration of a room.
- A **Room** is the top-level document: a short join code, an optional persistent slug (if the host is authenticated), the current host's user id, a list of participant ids, and a reference to the active video.
- A **Video** describes a playable source: the YouTube video id, and duration. There is no `upload` type and no `transcodeStatus` — every video is a YouTube source.
- A **Session** (optional, if you persist watch history) links a room, its video, participants, and start/end times.
- **Room state** (Redis, not Mongo) holds the live, frequently-mutated fields: current playback position, `isPlaying`, host id, and per-peer last-known drift/buffering status. Treat this as a cache the server can rebuild, not the durable record.
- **Chat messages** are per-room; persist them only if the user asks for chat history beyond the live session.

---

# 9. The sync protocol

This is the core mechanism. Get this right before polishing anything else.

- **Message types**, client → server: `play`, `pause`, `seek` (each carries `roomId`, `timestamp`, `mediaTime`), and `heartbeat` (sent by the host every ~2s, carrying `mediaTime`).
- **Message types**, server → clients: `sync_state` (broadcast on any state change: `mediaTime`, `isPlaying`, `serverTime`) and `correction` (sent only to a drifting peer: `mediaTime`).
- On each heartbeat, the server computes each peer's expected position (adjusting for that peer's estimated latency) and applies the graduated correction described in section 7.
- **Late joiners** get a one-time `sync_state` message with the room's current position and play state, then enter the normal heartbeat loop.
- **Player abstraction**: wrap the YouTube IFrame player behind one interface (`play()`, `pause()`, `seekTo()`, `getCurrentTime()`) so the sync logic stays player-agnostic — useful if a second playback source (e.g. a different embeddable platform) is ever added later.
- **Buffering**: a peer that can't obey a correction because it's buffering must report that state; the server pauses the room (or just that peer, per section 7's decision) rather than letting it silently fall behind.

---

# 10. Checks to run

Run these from the correct workspace and report the real output. Never claim a check passed without running it.

- In the web app: type check, lint, a production build when routes, config, or server code change, and the dev server.
- In the realtime server: a type check/lint pass, and a manual multi-tab test (open 2–3 browser tabs in the same room, confirm play/pause/seek propagate and drift correction kicks in after throttling one tab's network in devtools).

After you implement, run the type check and lint at minimum, add a build when routes/config/server modules changed, and for any sync-protocol change, do the manual multi-tab drift test — this is not something a type checker will catch.

---

# 11. Things that will trip you up

You cannot infer these from the code, so keep them in mind.

- Vercel serverless functions cannot hold a persistent WebSocket connection. The realtime server must run somewhere long-running.
- A hard seek on every heartbeat looks broken even when it's "correct" — always use the graduated correction in section 7/9, never a naive re-seek loop.
- YouTube's IFrame API reports embedding restrictions as an `onError` event (codes 101/150) — always surface this to the user; don't let it fail silently.
- Redis room state is a cache, not a source of truth for anything you'd be upset to lose — if Redis restarts, the room should degrade gracefully (e.g. re-derive host/position from the last known `sync_state`), not crash.
- There is no upload path. If a task description or an old prompt file references uploads, transcoding, or object storage, that's stale — check with the user before building toward it.

---

# 12. When in doubt

Keep it small. Preserve the web / realtime-server boundary. Match the provided mockups exactly (minus the removed upload option in the add-source modal). Use the graduated drift-correction rule, never a naive re-seek. This product does not accept file uploads — don't build toward one. Save a prompt and get approval before coding. Run the checks. Share exact test steps.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
