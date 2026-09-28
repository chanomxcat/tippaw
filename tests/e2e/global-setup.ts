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
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const wranglerBin = path.join(rootDir, "node_modules", "wrangler", "bin", "wrangler.js");
const tsxBin = path.join(rootDir, "node_modules", "tsx", "dist", "cli.mjs");

function runWrangler(args: string[]): void {
  execFileSync(process.execPath, [wranglerBin, ...args], { stdio: "inherit", cwd: rootDir });
}

function runTsxScript(scriptRelPath: string, args: string[]): void {
  execFileSync(process.execPath, [tsxBin, path.join(rootDir, scriptRelPath), ...args], {
    stdio: "inherit",
    cwd: rootDir,
  });
}

export async function resetE2EState(): Promise<void> {
  const d1StateDir = path.join(rootDir, ".wrangler", "state", "v3", "d1");
  if (existsSync(d1StateDir)) {
    rmSync(d1StateDir, { recursive: true, force: true });
  }

  copyFileSync(path.join(rootDir, ".dev.vars.e2e"), path.join(rootDir, ".dev.vars"));

  runWrangler(["d1", "migrations", "apply", "tippaw-db", "--local"]);

  runTsxScript("scripts/admin-bootstrap-invite.ts", ["--code", "E2E-BOOT"]);
}
