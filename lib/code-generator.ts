// Unambiguous uppercase alphanumeric characters (no 0/O, 1/I/L)
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;

export function generateRoomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < CODE_LENGTH; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

export function sanitizeRoomCode(input: string): string {
  if (!input) return "";
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
