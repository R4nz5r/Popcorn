export interface AnonymousUser {
  userId: string;
  displayName: string;
  avatarColor: string;
  hasCustomName?: boolean;
}

const AVATAR_COLORS = [
  "#93c5fd", // Soft blue (matches RS in mockup)
  "#c4b5fd", // Soft purple (matches TA in mockup)
  "#fcd34d", // Soft amber/orange (matches +2 in mockup)
  "#86efac", // Soft green
  "#fca5a5", // Soft rose
  "#fdba74", // Soft peach
];

const STORAGE_KEY = "wt_anonymous_user";

export function getOrCreateAnonymousUser(): AnonymousUser {
  if (typeof window === "undefined") {
    return {
      userId: "server_anon",
      displayName: "Guest",
      avatarColor: AVATAR_COLORS[0],
      hasCustomName: false,
    };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.userId && parsed.displayName && parsed.avatarColor) {
        return parsed;
      }
    }
  } catch {
    // Ignore JSON or localStorage access errors
  }

  // Generate new anonymous identity
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const colorIndex = Math.floor(Math.random() * AVATAR_COLORS.length);
  const user: AnonymousUser = {
    userId: `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    displayName: `Guest ${randomSuffix}`,
    avatarColor: AVATAR_COLORS[colorIndex],
    hasCustomName: false,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage quota errors
  }

  return user;
}

export function updateUserName(newName: string): AnonymousUser {
  const user = getOrCreateAnonymousUser();
  const trimmed = newName.trim().slice(0, 30);
  if (trimmed) {
    user.displayName = trimmed;
    user.hasCustomName = true;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      } catch {
        // Ignore storage errors
      }
    }
  }
  return user;
}

export function hasCustomName(): boolean {
  if (typeof window === "undefined") return false;
  const user = getOrCreateAnonymousUser();
  return Boolean(user?.hasCustomName && !user.displayName.startsWith("Guest "));
}
