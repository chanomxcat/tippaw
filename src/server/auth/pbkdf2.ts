/**
 * PBKDF2-SHA256 password hashing via WebCrypto. Better Auth's default scrypt
 * is too CPU-heavy for the Workers CPU budget; WebCrypto PBKDF2 runs natively.
 *
 * Format: `pbkdf2$sha256$100000$<saltB64>$<hashB64>` (16-byte salt, 32-byte key).
 */
const ALGORITHM = "pbkdf2";
const DIGEST = "sha256";
const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return [ALGORITHM, DIGEST, String(ITERATIONS), toBase64(salt), toBase64(hash)].join("$");
}

export async function verifyPassword({
  hash,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  const parts = hash.split("$");
  if (parts.length !== 5) return false;
  const [algorithm, digest, iterationsRaw, saltB64, hashB64] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];
  if (algorithm !== ALGORITHM || digest !== DIGEST || iterationsRaw !== String(ITERATIONS)) {
    return false;
  }

  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = fromBase64(saltB64);
    expected = fromBase64(hashB64);
  } catch {
    return false;
  }
  if (salt.length !== SALT_BYTES || expected.length !== KEY_BYTES) return false;

  const actual = await derive(password, salt, ITERATIONS);
  return constantTimeEqual(actual, expected);
}
