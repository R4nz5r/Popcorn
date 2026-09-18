# Implementation Prompt: Fix Host Auto-Pause and Unsolicited Play Loop

## 1. Goal
Fix the playback instability where the host player repeatedly pauses and then unexpectedly resumes playing by itself:
1. In `server/index.ts`: Prevent transient player startup buffering (normal 50–300ms pre-roll) from pausing the room. Only sustained stalls (continuous buffering > 1500ms) should trigger an auto-pause, and the server must automatically resume playback once the stalled peer finishes buffering.
2. In `server/index.ts`: Fix peer drift calculation during host heartbeats so uninitialized peers (`lastReportedTime === 0`) do not trigger continuous unsolicited correction floods.
3. In `app/room/[code]/page.tsx`: Prevent programmatic playback transitions from being mistaken for user iframe interactions in `onStateChange`, stopping peers from emitting rogue `play` events back to the server when catching up.
4. In `app/room/[code]/page.tsx`: Restrict the user interaction unlock listener to a one-time activation (`{ once: true }`) so regular clicks across the interface do not trigger unexpected `play()` invocations.
5. In `app/room/[code]/page.tsx`: Ensure peers periodically report their current playback position during heartbeats so drift tracking on the server is accurate.

---

## 2. Skills & References Read
- `AGENTS.md`:
  - Section 7: "Buffering pauses the room, not just the buffering client. When a peer can't keep up, the UI shows 'others are paused for you' — do not let the room silently drift ahead of someone stuck buffering."
  - Section 9: Host-authoritative sync protocol and message flow.
- YouTube IFrame API: Lifecycle of `BUFFERING` state during playback start and seek operations.

---

## 3. Code Inspected
- `server/index.ts`:
  - Line 273: `if (isBuffering && room.isPlaying)` immediately paused the entire room on any 50ms buffer event, broadcasting `isPlaying: false`.
  - Line 295: When buffering finished (`!isBuffering`), the server cleared buffering state but never resumed the paused room.
  - Line 246: Drift was calculated as `Math.abs(expectedTime - otherPeer.lastReportedTime)`. Because peers never sent heartbeats, `lastReportedTime` was always 0, triggering infinite `correction` dispatches.
- `app/room/[code]/page.tsx`:
  - Line 615: `onStateChange` fired on remote buffer recovery and emitted `play` to the server because `desiredPlayStateRef.current` had been overwritten by the buffering pause.
  - Line 306: `window.addEventListener("pointerdown", onUserInteraction)` remained active continuously, calling `play()` on every click anywhere on the page.

---

## 4. Decisions and Assumptions
1. **Debounced Buffering Pause with Auto-Resume in Server (`server/index.ts`)**:
   - Do not pause on momentary buffer spikes. When a client reports `isBuffering: true`, start a 1500ms timer (`bufferTimer`).
   - If the peer is still buffering after 1500ms and the room is playing, pause the room and record `pausedByBuffering = true`.
   - When all peers report `isBuffering: false`, if the room was `pausedByBuffering`, automatically resume the room (`room.isPlaying = true`) and broadcast `sync_state: isPlaying: true`.
2. **Accurate Peer Position Reporting (`server/index.ts` & `page.tsx`)**:
   - In `app/room/[code]/page.tsx`: Both host and peers emit periodic `heartbeat` with current `mediaTime` when playing (every 2s).
   - In `server/index.ts`: Only calculate drift for peers who have reported a position (`otherPeer.lastReportedTime > 0`).
3. **Explicit Programmatic Action Guard (`app/room/[code]/page.tsx`)**:
   - Use `isProgrammaticActionRef = useRef<boolean>(false)`.
   - When `adapter.play()`, `adapter.pause()`, or `adapter.seekTo()` is invoked by code, set `isProgrammaticActionRef.current = true`.
   - In `onStateChange`, if `isProgrammaticActionRef.current` is true, ignore the event for socket emission and reset the flag. Only user clicks inside YouTube's iframe emit events.
4. **One-Time User Activation Listener**:
   - Remove the permanent `pointerdown` listener and use `{ once: true }` so it only runs on the very first document click to unlock browser audio.

---

## 5. Files Expected to Touch
- `server/index.ts` (MODIFY: debounce buffer stalls to >1.5s, auto-resume after buffer resolution, fix drift check)
- `app/room/[code]/page.tsx` (MODIFY: programmatic action guard in onStateChange, one-time interaction unlock, peer heartbeat)

---

## 6. Requirements
- Clicking Play on Host starts playback cleanly without immediately auto-pausing.
- Clicking Pause on Host pauses playback cleanly and remains paused without unprompted auto-playing.
- Seeking on Host seeks smoothly without causing repeated pause/play ping-pong.
- Peers follow Host play, pause, and seek commands in lockstep.
- Zero TypeScript errors (`npx tsc --noEmit`).
- Zero ESLint errors (`npm run lint`).
- Successful Next.js build (`npm run build`).

---

## 7. Security Considerations
- Validate numeric bounds for heartbeat timestamps and media times.
- Clean up server buffer timers when peers disconnect.

---

## 8. Acceptance Criteria
- [ ] Host clicking Play stays playing (no immediate pause spike).
- [ ] Host clicking Pause stays paused (no unsolicited auto-play).
- [ ] Peer stays in sync with Host without bouncing state back and forth.
- [ ] Stalls (>1.5s) pause the room and auto-resume once resolved.
- [ ] `npx tsc --noEmit` passes with 0 errors.
- [ ] `npm run lint` passes with 0 errors.
- [ ] `npm run build` succeeds without errors.

---

## 9. Checks to Run
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- Multi-client sync verification test

---

## 10. Exact Manual Test Steps
1. Restart the server (`npm run server:dev`).
2. Open Host tab at `http://localhost:3000/room/[code]`.
3. Open Peer tab (Incognito) at the same room URL.
4. On Host tab, click Play:
   - Verify video starts playing on Host and does NOT immediately stutter or pause.
   - Verify video starts playing on Peer in sync.
5. On Host tab, click Pause:
   - Verify video pauses on Host and stays paused (does NOT randomly start playing again).
   - Verify video pauses on Peer.
6. Click Play again, then Pause again:
   - Verify both play and pause commands respond reliably on the first click.
