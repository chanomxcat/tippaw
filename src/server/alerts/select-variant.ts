/**
 * Selects which alert variant to show for a donation amount.
 *
 * Rule: keep only variants whose `minAmountSatang` is at or below the
 * donation amount, narrow to the tier with the highest `minAmountSatang`
 * among those, then pick one at random weighted by `weight`. If every
 * variant in that tier has `weight` 0, pick uniformly among them instead.
 * Returns null when no variant qualifies.
 */
export function selectVariant<T extends { minAmountSatang: number; weight: number }>(
  variants: T[],
  amountSatang: number,
  rng: () => number = Math.random,
): T | null {
  const eligible = variants.filter((v) => v.minAmountSatang <= amountSatang);
  if (eligible.length === 0) return null;

  const maxMin = Math.max(...eligible.map((v) => v.minAmountSatang));
  const tier = eligible.filter((v) => v.minAmountSatang === maxMin);

  const totalWeight = tier.reduce((sum, v) => sum + v.weight, 0);

  if (totalWeight === 0) {
    const index = Math.floor(rng() * tier.length);
    return tier[index] ?? null;
  }

  const r = rng() * totalWeight;
  let cumulative = 0;
  for (const variant of tier) {
    cumulative += variant.weight;
    if (r < cumulative) return variant;
  }
  // Floating-point edge case (r rounds up to totalWeight): fall back to the last entry.
  return tier[tier.length - 1] ?? null;
}
