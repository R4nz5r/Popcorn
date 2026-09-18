# Implementation Prompt: Host Left Status and Independent Guest Playback

## Goal
When a room host disconnects (leaves the room, closes the tab, or navigates to another room), remaining guests should not be left in a misleading "Synced" state. Instead:
1. Detect host disconnection with a 3-second grace period (to avoid flashing during normal page refreshes).
2. Broadcast a `host_status` event to remaining peers indicating that the host is offline (`isHostOnline: false`).
3. Display a distinct amber **`Host Left`** badge in the playback controls bar on the guest UI.
4. Unlock local playback control (play, pause, seek scrubber) for guests while the host is absent so they are not frozen or locked out.
5. Automatically return to **`Synced`** and realign playback if the host returns to the room.

---

## Skills Read & Inspected
- `AGENTS.md`: Section 5 (realtime server vs web boundary, server authoritative state), Section 7 (host authority, manual transfer in v1), Section 9 (sync protocol and message types), Section 10 (checks to run).
- Socket.io and Next.js client component patterns in `app/room/[code]/page.tsx`, `server/index.ts`, `lib/socket.ts`, and `components/player/PlaybackControls.tsx`.

---

## Code Inspected
- `server/index.ts`: Examined `disconnect` handler (lines 444-489) and `join_room` (lines 75-145). Currently, host departure only removes the socket from `room.peers` without broadcasting host presence status.
- `lib/socket.ts`: Socket client interfaces and event payload definitions.
- `app/room/[code]/page.tsx`: Sync status management (`syncStatus: "synced" | "syncing" | "disconnected"`), `handleSyncState`, `handlePlayPause`, and seek permissions.
- `components/player/PlaybackControls.tsx`: Status badge rendering (lines 296-335) and scrubber drag guard (`if (!isHost) return;`).

---

## Decisions and Assumptions
1. **Grace Period**: 3 seconds. When the host socket disconnects, a 3000ms timer starts. If the host reconnects before the timer fires, no `host_left` status is emitted. If the timer expires, the server broadcasts `{ isHostOnline: false, hostId }`.
2. **Badge Label & Styling**: In `PlaybackControls`, when `syncStatus === "host-left"`, display an amber pill badge with text **`Host Left`** and a small amber dot matching the design system styling.
3. **Guest Playback Autonomy**: When the host is away, guests can play, pause, and seek locally using the scrubber bar without throwing errors or attempting forbidden host-only socket emits.
4. **Resync on Host Return**: If the host joins back, `host_status` with `isHostOnline: true` is emitted, host's current position is synchronized, and the guest badge returns to `Synced`.
5. **Initial Room State**: If a guest joins a room where the host is currently offline, `sync_state` will report `isHostOnline: false` immediately.

---

## Files to Touch
1. `lib/socket.ts`
   - Add `isHostOnline?: boolean` to `SyncStatePayload`.
   - Export `HostStatusPayload` interface: `{ isHostOnline: boolean; hostId?: string }`.
2. `server/index.ts`
   - Add `hostDisconnectTimeout?: NodeJS.Timeout | null` to `RoomSyncState`.
   - In `disconnect`: if departing peer is host and room still has other peers, start 3s timer to broadcast `host_status: { isHostOnline: false, hostId }`.
   - In `join_room`: if connecting peer is host, cancel any pending `hostDisconnectTimeout` and broadcast `host_status: { isHostOnline: true, hostId }`. Include `isHostOnline` in `sync_state`.
3. `components/player/PlaybackControls.tsx`
   - Expand `syncStatus` prop type: `"synced" | "syncing" | "disconnected" | "host-left"`.
   - Allow scrubber interaction for guests when `syncStatus === "host-left"`.
   - Render amber **`Host Left`** badge when `syncStatus === "host-left"`.
4. `app/room/[code]/page.tsx`
   - Track `isHostOnline` state.
   - Listen to `host_status` event and handle `isHostOnline` from `sync_state`.
   - Update `syncStatus` to `"host-left"` when `!isHostOnline && syncStatus !== "disconnected"`.
   - Allow local seek scrubber dragging when `!isHostOnline`.

---

## Security & Architectural Considerations
- Preserves the host-authoritative rule: guests do not take over server clock source or mutate room records; they merely enjoy unlocked local playback while the host is absent.
- No sensitive user data exposed in `host_status` payload.
- Proper cleanup of `hostDisconnectTimeout` prevents memory leaks when rooms are emptied.

---

## Acceptance Criteria
1. When host navigates away or closes tab, guest badge changes from `Synced` to amber `Host Left` after 3 seconds.
2. If host merely reloads the page (reconnecting within 3s), guest badge remains `Synced` without flickering `Host Left`.
3. When `Host Left` is active, guest can click Play/Pause and scrub the timeline locally.
4. When host reconnects to the room, guest badge smoothly reverts to `Synced` (or `Syncing`), and playback synchronizes with the host.
5. `npx tsc --noEmit` and Next.js build pass with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit` to verify type safety across client and server.
- Health check `curl.exe http://localhost:3001/health`.

### Manual Multi-Tab Verification
1. Open Host in Tab A (`/room/Z4YFMU`) and Guest in Tab B (`/room/Z4YFMU`). Verify both show green `Host` / `Synced`.
2. In Tab A (Host), navigate to home `/` or close the tab.
3. Observe Tab B (Guest): after 3 seconds, badge switches from green `Synced` to amber `Host Left`.
4. In Tab B (Guest): click Play/Pause and drag the scrubber. Confirm local video responds and does not error.
5. In Tab A, open `/room/Z4YFMU` again as Host.
6. Observe Tab B: badge immediately transitions back to green `Synced`.
