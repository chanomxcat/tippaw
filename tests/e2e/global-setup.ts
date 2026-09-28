/**
 * Resets local Cloudflare Workers dev state for a clean E2E run: wipes the
 * local D1 database, installs the E2E env vars, re-applies migrations, and
 * seeds a fixed bootstrap invite code (`E2E-BOOT`) that auth.spec.ts uses
 * to register its first user.
 *
 * This is NOT wired up as Playwright's own `globalSetup` option. Playwright
 * schedules the `webServer` plugin's own setup (start the server, wait for
 * it to answer) ahead of user `globalSetup` hooks, so a `globalSetup` here
 * would only run once `next build`/`preview` is already serving — wiping
 * `.wrangler/state` out from under a live server. Instead this module's
 * `resetE2EState()` is invoked from `scripts/e2e-reset.ts`, which
 * `playwright.config.ts` runs as the first step of `webServer.command`,
 * before the server starts.
 *
 * `restoreDevVars()` (the counterpart, run from `global-teardown.ts`, which
 * *is* wired up as Playwright's own `globalTeardown` — that hook runs once
 * at the very end, after all tests, with no equivalent ordering hazard) is
 * why this doesn't just overwrite a developer's real `.dev.vars` for good:
 * `resetE2EState()` backs it up to `.dev.vars.backup-e2e` first (a
 * developer's `.dev.vars` can hold real Google/Streamlabs secrets, and
 * `.dev.vars` is gitignored, so overwriting it with no way back would lose
 * them permanently), and `restoreDevVars()` puts it back.
 *
 * (I looked for a way to point `opennextjs-cloudflare preview`/`wrangler
 * dev` at `.dev.vars.e2e` directly instead of touching `.dev.vars` at all —
 * `wrangler dev --env-file <path>` exists and skips `.dev.vars` entirely,
 * but `opennextjs-cloudflare preview`'s CLI silently drops a forwarded
 * `--env-file` flag before it reaches the `wrangler dev` subprocess it
 * spawns (confirmed by instrumenting its `preview.js` locally — every other
 * unknown flag survives the forwarding, only this one doesn't). Backup +
 * restore was the reliable option.)
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const wranglerBin = path.join(rootDir, "node_modules", "wrangler", "bin", "wrangler.js");
const tsxBin = path.join(rootDir, "node_modules", "tsx", "dist", "cli.mjs");

const devVarsPath = path.join(rootDir, ".dev.vars");
const devVarsE2ePath = path.join(rootDir, ".dev.vars.e2e");
const devVarsBackupPath = path.join(rootDir, ".dev.vars.backup-e2e");

function runWrangler(args: string[]): void {
  execFileSync(process.execPath, [wranglerBin, ...args], { stdio: "inherit", cwd: rootDir });
}

function runTsxScript(scriptRelPath: string, args: string[]): void {
  execFileSync(process.execPath, [tsxBin, path.join(rootDir, scriptRelPath), ...args], {
    stdio: "inherit",
    cwd: rootDir,
  });
}

/**
 * Backs up any existing `.dev.vars` to `.dev.vars.backup-e2e` (so
 * `restoreDevVars()` can put it back once tests finish), then installs the
 * E2E env vars in its place. Refuses to run if a backup already exists —
 * that means a previous E2E run's `restoreDevVars()` never ran (crash,
 * Ctrl-C, etc.), and overwriting it now would silently discard whatever it
 * was protecting.
 */
function installE2EDevVars(): void {
  if (existsSync(devVarsBackupPath)) {
    throw new Error(
      `${devVarsBackupPath} already exists — a previous E2E run's cleanup (restoreDevVars) ` +
        "didn't complete. Refusing to overwrite it: check whether .dev.vars.backup-e2e holds " +
        "a real .dev.vars that needs restoring, then remove the backup file and re-run.",
    );
  }
  if (existsSync(devVarsPath)) {
    renameSync(devVarsPath, devVarsBackupPath);
  }
  copyFileSync(devVarsE2ePath, devVarsPath);
}

/** Restores the developer's original `.dev.vars` (or removes the E2E one, if there wasn't one). */
export function restoreDevVars(): void {
  if (existsSync(devVarsBackupPath)) {
    rmSync(devVarsPath, { force: true });
    renameSync(devVarsBackupPath, devVarsPath);
  } else if (existsSync(devVarsPath)) {
    rmSync(devVarsPath, { force: true });
  }
}

export async function resetE2EState(): Promise<void> {
  const d1StateDir = path.join(rootDir, ".wrangler", "state", "v3", "d1");
  if (existsSync(d1StateDir)) {
    rmSync(d1StateDir, { recursive: true, force: true });
  }

  installE2EDevVars();

  runWrangler(["d1", "migrations", "apply", "tippaw-db", "--local"]);

  runTsxScript("scripts/admin-bootstrap-invite.ts", ["--code", "E2E-BOOT"]);
}
