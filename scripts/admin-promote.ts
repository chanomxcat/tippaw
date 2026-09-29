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

export function parseArgs(argv: string[]): { username?: string; remote: boolean } {
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

/** Better Auth's `username` plugin stores usernames lowercased, so matching must too, or a mixed-case arg silently promotes nobody. */
export function normalizeUsername(username: string): string {
  return username.toLowerCase();
}

type D1QueryResult = { results: unknown[]; success: boolean; meta: Record<string, unknown> };

/** Reads the row count changed by the immediately preceding statement from `SELECT changes() AS changed;`'s result (the last statement run). */
export function parseChangedCount(rows: D1QueryResult[]): number {
  const last = rows[rows.length - 1];
  const value = (last?.results?.[0] as { changed?: unknown } | undefined)?.changed;
  return typeof value === "number" ? value : 0;
}

function runD1Json(sql: string, remote: boolean): D1QueryResult[] {
  // See admin-bootstrap-invite.ts for why this calls wrangler's JS
  // entrypoint directly instead of the npx/wrangler .cmd shim. `--json`
  // gives us clean JSON on stdout (no banner) so we can check how many rows
  // actually changed instead of trusting wrangler's own success message.
  const output = execFileSync(
    process.execPath,
    [wranglerBin, "d1", "execute", "tippaw-db", remote ? "--remote" : "--local", "--command", sql, "--json"],
    { encoding: "utf8" },
  );
  return JSON.parse(output) as D1QueryResult[];
}

export function main(): void {
  const { username, remote } = parseArgs(process.argv.slice(2));

  if (!username || !USERNAME_FORMAT.test(username)) {
    console.error("usage: admin-promote <username> [--remote]  (username must match ^[a-zA-Z0-9_.]{3,30}$)");
    process.exit(1);
  }

  const normalized = normalizeUsername(username);

  // Validated above against ^[a-zA-Z0-9_.]{3,30}$ (case-insensitively), so
  // it's safe to interpolate directly — no quotes or other SQL-special
  // characters. `SELECT changes()` runs as a second statement in the same
  // batch so we can tell 0-row updates apart from real promotions.
  const sql = `UPDATE user SET role = 'admin' WHERE username = '${normalized}'; SELECT changes() AS changed;`;
  const rows = runD1Json(sql, remote);
  const changed = parseChangedCount(rows);

  if (changed === 0) {
    console.error(
      `ไม่พบผู้ใช้ '${normalized}' หรือไม่มีแถวที่เปลี่ยนแปลง — ยังไม่ได้เลื่อนเป็น admin (no user matched '${normalized}', 0 rows changed)`,
    );
    process.exit(1);
  }

  console.log(`promoted '${normalized}' to admin`);
}

const isDirectRun = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "");
if (isDirectRun) {
  main();
}
