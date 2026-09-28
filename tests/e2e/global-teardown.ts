/**
 * Playwright's `globalTeardown` hook: runs once after all tests finish (and
 * before the `webServer` is stopped — Playwright tears down tasks in
 * reverse setup order). Restores whatever `.dev.vars` the developer had
 * before `tests/e2e/global-setup.ts`'s `resetE2EState()` swapped in the E2E
 * env vars. See that file for why this is a backup/restore rather than
 * pointing the preview server at `.dev.vars.e2e` directly.
 *
 * Unlike `resetE2EState()`, this *is* safe to wire up as Playwright's own
 * `globalTeardown` (see playwright.config.ts) — there's no equivalent
 * "runs after the server already started" hazard for teardown, since it
 * only needs to run once, at the very end.
 */
import { restoreDevVars } from "./global-setup";

export default async function globalTeardown(): Promise<void> {
  restoreDevVars();
}
