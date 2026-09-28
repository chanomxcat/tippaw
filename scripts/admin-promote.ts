/**
 * Promotes an existing user to the admin role by username.
 *
 * Usage: npx tsx scripts/admin-promote.ts <username> [--remote]
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const USERNAME_FORMAT = /^[a-zA-Z0-9_.]{3,30}$/;

const wranglerBin = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js",
);

function parseArgs(argv: string[]): { username?: string; remote: boolean } {
  let remote = false;
  let username: string | undefined;
  for (const arg of argv) {
    if (arg === "--remote") {
      remote = true;
    } else if (!arg.startsWith("--") && username === undefined) {
      username = arg;
    }
  }
  return { username, remote };
}

function runD1(sql: string, remote: boolean): void {
  // See admin-bootstrap-invite.ts for why this calls wrangler's JS
  // entrypoint directly instead of the npx/wrangler .cmd shim.
  execFileSync(
    process.execPath,
    [wranglerBin, "d1", "execute", "tippaw-db", remote ? "--remote" : "--local", "--command", sql],
    { stdio: "inherit" },
  );
}

function main(): void {
  const { username, remote } = parseArgs(process.argv.slice(2));

  if (!username || !USERNAME_FORMAT.test(username)) {
    console.error("usage: admin-promote <username> [--remote]  (username must match ^[a-zA-Z0-9_.]{3,30}$)");
    process.exit(1);
  }

  // Validated above against ^[a-zA-Z0-9_.]{3,30}$, so it's safe to
  // interpolate directly — no quotes or other SQL-special characters.
  const sql = `UPDATE user SET role = 'admin' WHERE username = '${username}';`;
  runD1(sql, remote);

  console.log(`promoted '${username}' to admin`);
}

main();
