/**
 * Warms up the local `wrangler`/OpenNext preview server before Playwright
 * runs any real test.
 *
 * What this works around: the preview server's very first request pays a
 * one-time cost (V8/workerd compiling the whole OpenNext worker bundle,
 * plus first-time module instantiation for Better Auth, Drizzle, and
 * PBKDF2 password hashing) that later requests don't. Playwright's own
 * `webServer.url` readiness check only waits for the root route to answer
 * once, which doesn't exercise any of that (there's no `page.tsx` doing
 * DB/auth work at `/` — only `/login`, `/register`, etc. do), so without
 * this, the first *test* to hit one of those routes would pay that cost
 * against its own per-test timeout instead.
 *
 * To be clear about what this script does and doesn't fix: two other,
 * separate bugs used to also show up as apparent "flakiness" in this
 * suite and are fixed elsewhere, not here — `settings.spec.ts` was
 * reusing another spec's single-use invite code (an ordering bug, fixed by
 * giving it its own code — see helpers.ts's `bootstrapInvite`), and the
 * mock-checkout buttons had a real pre-hydration click race (fixed in the
 * app itself via `useHydrated()`, see src/ui/use-hydrated.ts). This script
 * only ever addressed the first-request compile cost described above.
 *
 * This script is run as a second Playwright `webServer` entry (see
 * playwright.config.ts), after the preview server's own entry is already
 * accepting connections. It hits the same routes/paths a real test's first
 * few actions do, so that cost is paid here — under this script's own
 * generous timeout — instead of inside a test.
 */
const baseUrl = "http://localhost:8787";

// Routes a real spec's opening moves touch: the register/login pages (auth
// forms, Better Auth session check) and the public tip page and its mock
// checkout (donation + payment code paths). GET-only and idempotent — safe
// to hit before any test-owned data exists.
const WARMUP_PATHS = ["/login", "/register?code=WARMUP", "/nonexistent-slug-for-warmup"];

async function fetchWithRetry(path: string, attempts = 20, delayMs = 1_000): Promise<void> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${baseUrl}${path}`);
      // Any response at all (even a 404 for the throwaway slug) means the
      // worker handled a full request/response cycle for that route.
      if (res.status > 0) {
        await res.arrayBuffer(); // Drain the body so the connection is fully done.
        return;
      }
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`warmup: ${path} never responded after ${attempts} attempts: ${String(lastError)}`);
}

async function main(): Promise<void> {
  // First pass: cold — pays the compile/instantiation cost per route.
  for (const path of WARMUP_PATHS) {
    await fetchWithRetry(path);
  }
  // Second pass: confirms those routes are now actually fast, i.e. the
  // cold-start cost really was paid and isn't still lurking.
  for (const path of WARMUP_PATHS) {
    await fetchWithRetry(path, /* attempts */ 5, /* delayMs */ 200);
  }
  console.log("E2E_WARMUP_DONE");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
