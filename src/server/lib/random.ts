/**
 * Random tokens and invite codes, built on the Web Crypto API so this module
 * runs unchanged on Cloudflare Workers as well as Node.
 */

const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_FORMAT = /^[A-Z0-9-]{4,32}$/;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A 32-byte cryptographically random token, base64url-encoded (43 characters). Used for overlay tokens. */
export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/**
 * Draws one uniformly-random index in [0, alphabetLength) using rejection
 * sampling, so the result is not biased toward the low end of the alphabet.
 */
function randomAlphabetIndex(alphabetLength: number): number {
  const limit = Math.floor(256 / alphabetLength) * alphabetLength;
  const byteArray = new Uint8Array(1);
  let byte: number;
  do {
    crypto.getRandomValues(byteArray);
    byte = byteArray[0]!;
  } while (byte >= limit);
  return byte % alphabetLength;
}

/** An 8-character invite code drawn uniformly from an unambiguous alphabet (no I/O/0/1). */
export function randomInviteCode(): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_ALPHABET[randomAlphabetIndex(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Normalizes a user-typed invite code (trim + uppercase) and validates it
 * against `^[A-Z0-9-]{4,32}$`. Returns null when the input doesn't match.
 */
export function normalizeInviteCode(input: string): string | null {
  const normalized = input.trim().toUpperCase();
  return INVITE_CODE_FORMAT.test(normalized) ? normalized : null;
}
