import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  // Restores the developer's real .dev.vars once tests finish (see
  // tests/e2e/global-setup.ts / global-teardown.ts). Safe to wire up here
  // unlike the reset itself — it only needs to run once, at the very end.
  globalTeardown: "./tests/e2e/global-teardown.ts",
  // The local wrangler/OpenNext preview server can be slow on first
  // request (cold Worker compile), especially on Windows.
  timeout: 60_000,
  // A one-time retry in CI absorbs whatever genuine latency variance is
  // left after the fixes below, without masking a real regression by
  // retrying locally too.
  retries: process.env.CI ? 1 : 0,
  // What actually caused the "mock-checkout" flake seen across several
  // full-suite runs (donate.spec.ts, transactions.spec.ts, golden-path.spec.ts)
  // was not slowness: with `stdout: "pipe"` below, a failing run's wrangler
  // log showed the button's expected `POST /mock/checkout/<session>` never
  // arriving at the server at all, at any timeout — a real hydration race
  // (CheckoutActions.tsx's buttons were server-rendered enabled with only
  // an `onClick`, so a click landing before React attached that handler did
  // nothing). That's fixed at the source now (`useHydrated()` in
  // src/ui/use-hydrated.ts keeps the button disabled — and thus unclickable
  // by Playwright's own actionability wait — until hydration finishes); see
  // CheckoutActions.tsx, TipForm.tsx, and ReplayButton.tsx. This is a small
  // remaining margin for the ordinary latency of a real D1 write + Next.js
  // render on a local dev server, not a workaround for that race.
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:8787",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      // Reset local D1 state + env vars (see tests/e2e/global-setup.ts) before
      // the build even starts, then build and serve the real Worker.
      command: "npx tsx scripts/e2e-reset.ts && npm run build && npm run preview",
      url: "http://localhost:8787",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      // Piped (rather than the default "ignore") so `[wrangler:info] METHOD
      // path STATUS (ms)` request logs and any app-side console.error are
      // visible when a run fails — this is what made the settings.spec.ts /
      // donate.spec.ts flakes traceable in the first place.
      stdout: "pipe",
    },
    {
      // Runs only once the entry above is accepting connections (Playwright
      // starts array entries in order, waiting on each one's own readiness
      // before starting the next). Pays the preview server's one-time
      // cold-start cost (see scripts/e2e-warmup.ts) up front, under its own
      // timeout, instead of leaving it to land inside the first real test's
      // per-test timeout.
      command: "npx tsx scripts/e2e-warmup.ts",
      reuseExistingServer: false,
      stdout: "pipe",
      wait: { stdout: /E2E_WARMUP_DONE/ },
      timeout: 60_000,
    },
  ],
});
