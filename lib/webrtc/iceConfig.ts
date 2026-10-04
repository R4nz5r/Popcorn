/**
 * Centralized WebRTC ICE (STUN & TURN) Configuration.
 * 
 * Provides Google STUN servers and Open Relay (Metered) TURN servers to pierce
 * Carrier-Grade NAT (CGNAT), symmetric NATs, mobile cellular networks, and
 * restrictive corporate/firewall networks (e.g. between international peers).
 * 
 * Also supports custom TURN server credentials via NEXT_PUBLIC_TURN_* environment variables.
 */

export function getRTCConfiguration(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [
    // Google Public STUN servers
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ];

  // Check if custom TURN credentials are provided via environment variables
  const customTurnUrls = process.env.NEXT_PUBLIC_TURN_URLS || process.env.NEXT_PUBLIC_TURN_URL;
  const customTurnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const customTurnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  if (customTurnUrls) {
    const urls = customTurnUrls.split(",").map((u) => u.trim()).filter(Boolean);
    const customServer: RTCIceServer = { urls };
    if (customTurnUsername) customServer.username = customTurnUsername;
    if (customTurnCredential) customServer.credential = customTurnCredential;
    iceServers.push(customServer);
  } else {
    // Default: Free public TURN servers from Open Relay (Metered) to pierce Carrier-Grade NAT / mobile cellular / firewalls
    iceServers.push({
      urls: [
        "stun:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelay",
      credential: "openrelay",
    });
  }

  return {
    iceServers,
    iceCandidatePoolSize: 10,
  };
}
