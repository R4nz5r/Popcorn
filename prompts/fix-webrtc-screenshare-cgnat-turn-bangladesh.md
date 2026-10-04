# Implementation Prompt: Fix WebRTC Screen Share Black Screen for Bangladesh / International Peers (CGNAT & TURN Support)

## Goal
Fix the black screen issue when sharing screens with friends in Bangladesh (or other regions behind Carrier-Grade NAT, symmetric NAT, or strict mobile/broadband firewalls) while users in the Netherlands/Europe can view normally. Provide reliable WebRTC NAT traversal via TURN relay servers, fix candidate queuing race conditions over high-latency cross-continent links, adapt video sender bandwidth, and add connecting/buffering feedback in the screen share player.

---

## Skills Read & Inspected
- `AGENTS.md`:
  - Section 1 & 7: "This product is sync-only. There is no local file upload." Screen sharing uses ephemeral browser-to-browser WebRTC streams; no video files are recorded, stored, or rehosted.
  - Section 5: Realtime server vs web app responsibilities. Socket.io relays signaling messages; browsers establish direct or TURN-relayed peer connections.
  - Section 10: Multi-tab manual verification and type checks.
  - Section 12: Preserve existing boundaries; don't break existing features.

---

## Code Inspected & Root Cause Analysis
1. `lib/webrtc/WebRTCManager.ts`:
   - Lines 3-11: `RTC_CONFIGURATION` only contains Google STUN servers:
     ```ts
     const RTC_CONFIGURATION: RTCConfiguration = {
       iceServers: [
         { urls: "stun:stun.l.google.com:19302" },
         ...
       ],
     };
     ```
   - STUN only works for direct peer-to-peer UDP hole-punching (Full Cone / Restricted Cone NAT). In Western Europe / Netherlands, residential ISPs commonly support public IPv4 or IPv6 and less restrictive NAT, allowing STUN connections to succeed.
   - In Bangladesh, residential broadband and mobile ISPs (AmberIT, Carnival, Link3, Dot, Grameenphone, Banglalink, Robi) use Carrier-Grade NAT (CGNAT, RFC 6598) and Symmetric NAT. Under Symmetric NAT, STUN cannot establish direct P2P connections without a TURN relay server. Without TURN, the ICE connection fails (`checking` -> `failed`), no video packets are received, and the receiver's video surface remains pitch black.
   - Line 259: `this.viewerCandidateQueue = [];` clears the candidate queue when receiving an offer. Over cross-continent, high-latency links (e.g. Netherlands to Bangladesh, ~160-220ms RTT), ICE candidates can arrive slightly ahead of or during offer processing. Clearing the queue causes early candidates to be permanently lost.
   - No `iceCandidatePoolSize`: Slows down initial candidate discovery.
   - Video senders lack degradation preference and bitrate capping, which can overwhelm international bandwidth and cause video decoder stalls.
2. `lib/webrtc/VoiceCallManager.ts`:
   - Lines 10-21: Voice calls were already configured with free Open Relay (Metered) TURN servers (`openrelay.metered.ca`) and `iceCandidatePoolSize: 10`, which is why voice call architecture accounted for CGNAT while screen sharing did not.
3. `components/player/ScreenSharePlayer.tsx`:
   - Renders a plain `<video>` element with no visual connecting / loading feedback. If ICE is establishing or packets take time to arrive across high-latency links, viewers only see a black box with zero indication of whether the connection is initializing or failed.

---

## Decisions and Assumptions
1. **Centralized ICE Server Configuration (`lib/webrtc/iceConfig.ts`)**:
   - Create a single, shared ICE configuration used by both `WebRTCManager.ts` and `VoiceCallManager.ts`.
   - Include Google STUN servers and Open Relay (Metered) TURN servers (UDP 80/443 and TCP 443).
   - Support optional environment variables (`NEXT_PUBLIC_TURN_URLS`, `NEXT_PUBLIC_TURN_USERNAME`, `NEXT_PUBLIC_TURN_CREDENTIAL`) so developers or users can specify their own custom or paid TURN servers (e.g. Metered, Twilio, Coturn) while falling back seamlessly to free Open Relay TURN servers with zero configuration required ($0 cost).
   - Set `iceCandidatePoolSize: 10` to pre-warm candidate gathering.
2. **Robust ICE Candidate Queuing**:
   - In `WebRTCManager.ts`, use a `Map<string, RTCIceCandidateInit[]>` keyed by socket ID for candidate queues.
   - Never wipe out queued candidates before processing; flush buffered candidates immediately after `setRemoteDescription` resolves.
3. **Bandwidth & Video Degradation Tuning**:
   - Configure video senders with `degradationPreference: "balanced"` and sensible maximum bitrate (~2.5-3.5 Mbps) to prevent packet loss over international submarine cable routing while preserving crisp text readability.
4. **Player Loading & Connection UX**:
   - In `ScreenSharePlayer.tsx`, display a subtle loading/connecting spinner while the stream is initializing (`video.readyState < 2` or `isLoading`).
   - If peer connection fails, display an informative status and a "Retry Connection" button.
5. **No Breaking Changes**:
   - Retain full compatibility with YouTube video sync, voice calls, room state, chat, and existing mobile controls.

---

## Files to Touch
1. `lib/webrtc/iceConfig.ts` (New file):
   - Export `getRTCConfiguration(): RTCConfiguration` providing STUN + Open Relay TURN servers (and custom env overrides if present).
2. `lib/webrtc/WebRTCManager.ts`:
   - Use `getRTCConfiguration()`.
   - Fix candidate queueing race condition with Map-based buffering.
   - Add stream track fallback handling.
   - Apply video sender parameters (`degradationPreference`, max bitrate).
   - Expose connection state and retry method.
3. `lib/webrtc/VoiceCallManager.ts`:
   - Import and use `getRTCConfiguration()` from `lib/webrtc/iceConfig.ts` for consistency.
4. `components/player/ScreenSharePlayer.tsx`:
   - Add video loading / connecting state indicators and safe play/retry handling.
5. `.env.example`:
   - Add documentation for optional custom TURN server environment variables.

---

## Security Considerations
- Screen capture still requires explicit user consent through the browser's native `getDisplayMedia` dialog.
- TURN relay traffic is end-to-end encrypted (DTLS-SRTP); the TURN server only relays encrypted packets and cannot decrypt the video or audio payload.
- No audio or video data is ever stored on any server.

---

## Acceptance Criteria
1. WebRTC screen sharing connections successfully pierce Carrier-Grade NAT (CGNAT) and symmetric firewalls via TURN relay candidates.
2. Viewers connecting from Bangladesh (and other symmetric NAT environments) can see the presenter's shared screen clearly instead of a black screen.
3. ICE candidates arriving out-of-order over high-latency international connections are preserved and applied cleanly.
4. Screen share player displays a loading state during connection setup and recovers gracefully if renegotiation is requested.
5. Both automated type check (`npx tsc --noEmit`) and lint (`npm run lint`) pass with 0 errors.

---

## Verification Plan
### Automated Checks
- `npx tsc --noEmit`
- `npm run lint`

### Manual Test Steps
1. Open Watch Together in two browser sessions.
2. In Host session, click **"Share screen"** and select a window or tab.
3. In Viewer session:
   - Verify connection indicator appears briefly, followed by the live screen video stream without staying black.
   - In Chrome DevTools `chrome://webrtc-internals`, verify ICE candidate pairs include `relay` candidates and connection state reaches `connected`.
4. Test audio sharing along with video to verify high-fidelity audio continues to work.
