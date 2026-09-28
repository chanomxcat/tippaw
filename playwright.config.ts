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
  webServer: {
    // Reset local D1 state + env vars (see tests/e2e/global-setup.ts) before
    // the build even starts, then build and serve the real Worker.
    command: "npx tsx scripts/e2e-reset.ts && npm run build && npm run preview",
    url: "http://localhost:8787",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
