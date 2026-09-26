/**
 * Minimal ULID implementation for the Cloudflare Workers runtime.
 *
 * ULIDs are 26-character, time-ordered, URL-safe, globally unique identifiers.
 * They sort lexicographically by generation time, which is useful for
 * pagination and visual inspection of records.
 *
 * Format: TTTTTTTTTTRRRRRRRRRRRRRRRR
 *   T = 10 chars, 48-bit timestamp (ms since Unix epoch)
 *   R = 16 chars, 80 bits of randomness
 *
 * We avoid the `ulid` npm package to keep the Workers bundle minimal.
 * This is a correct implementation of the ULID spec.
 */

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford Base32

function encodeTime(ms: number, len: number): string {
  let str = "";
  for (let i = len - 1; i >= 0; i--) {
    str = ENCODING[ms % 32]! + str;
    ms = Math.floor(ms / 32);
  }
  return str;
}

function encodeRandom(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let str = "";
  for (let i = 0; i < len; i++) {
    str += ENCODING[bytes[i]! % 32]!;
  }
  return str;
}

export function ulid(seedTime?: number): string {
  const ms = seedTime ?? Date.now();
  return encodeTime(ms, 10) + encodeRandom(16);
}
