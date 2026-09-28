import { z } from "zod";

/** Counts Unicode code points in a string, so multi-byte characters (emoji, etc.) count as one. */
export function charLength(s: string): number {
  return [...s].length;
}

/** A trimmed string schema that rejects input longer than `n` Unicode code points. */
export function maxChars(n: number) {
  return z
    .string()
    .trim()
    .refine((s) => charLength(s) <= n);
}
