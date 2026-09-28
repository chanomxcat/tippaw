/**
 * CLI entry point for tests/e2e/global-setup.ts's `resetE2EState()` — run as
 * the first step of playwright.config.ts's `webServer.command`, before
 * `next build`/`preview` starts. See that file for why this isn't wired up
 * as Playwright's own `globalSetup` option instead.
 */
import { resetE2EState } from "../tests/e2e/global-setup";

resetE2EState().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
