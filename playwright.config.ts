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
  timeout: 90_000,
  // Was flaky under a single failure locally (see scripts/e2e-warmup.ts for
  // the cold-start root cause this and that script address together); a
  // one-time retry in CI absorbs whatever's left after that fix, without
  // masking a real regression by retrying locally too.
  retries: process.env.CI ? 1 : 0,
  // Traced a real flake here across several full-suite runs: the mock
  // checkout's button round-trips through a Next.js server action
  // (simulatePayment -> handleWebhookRequest: one or two cheap D1
  // statements, no DO/crypto work on the "failed" path) and then a
  // client-side `router.push` to the result page — normally well under a
  // second. It occasionally blew even a 15s budget, but only ever in a
  // full-suite run, at a different spec each time (donate.spec.ts,
  // transactions.spec.ts, ...) and never when the same spec was re-run
  // alone — i.e. it's not any one spec's bug, and scripts/e2e-warmup.ts's
  // one-time cold-start fix doesn't reach it either. It tracks with
  // sustained load on this single long-lived local wrangler/workerd
  // process over a whole ~2.5-5 minute serial run (dozens of D1 writes,
  // several WebSocket/Durable-Object connections from the overlay specs,
  // one Worker isolate the entire time) rather than any single request
  // being slow by itself. A genuinely broken flow still fails outright
  // (the result page never appears, at any timeout), so widening this
  // further doesn't hide a real regression — it buys margin for that
  // occasional whole-process pause instead.
  expect: { timeout: 30_000 },
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
