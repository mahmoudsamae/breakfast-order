import { createHash, timingSafeEqual } from "crypto";

/** Compare two secrets without leaking their length or contents through timing. */
export function secretsEqual(given, expected) {
  const a = createHash("sha256").update(String(given ?? ""), "utf8").digest();
  const b = createHash("sha256").update(String(expected ?? ""), "utf8").digest();
  return timingSafeEqual(a, b);
}
