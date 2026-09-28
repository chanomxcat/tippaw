/**
 * Creates a single-use invite code without requiring an existing admin
 * account — used to bootstrap the very first user (who then redeems it,
 * gets promoted with admin-promote.ts, and can create further invites
 * through the admin UI).
 *
 * Usage: npx tsx scripts/admin-bootstrap-invite.ts [--remote] [--code CODE]
 *
 * `invite_code.created_by` has a NOT NULL foreign key to `user.id`, but no
 * real user exists yet at bootstrap time. We satisfy the FK with a sentinel
 * `system` user (id 'system') that has no credential or OAuth account, so
 * nobody can ever sign in as it — it exists purely to own bootstrap invites.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { normalizeInviteCode, randomInviteCode } from "../src/server/lib/random";

const wranglerBin = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js",
);

type Args = { remote: boolean; code?: string };

function parseArgs(argv: string[]): Args {
  let remote = false;
  let code: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--remote") {
      remote = true;
    } else if (arg === "--code") {
      code = argv[++i];
    }
  }
  return { remote, code };
}

function runD1(sql: string, remote: boolean): void {
  // Invoke wrangler's JS entrypoint directly with `node` rather than through
  // the npx/wrangler .cmd shim — spawning a .cmd file via execFileSync needs
  // a shell on Windows, and shell-quoting a multi-word --command value there
  // is unreliable.
  execFileSync(
    process.execPath,
    [wranglerBin, "d1", "execute", "tippaw-db", remote ? "--remote" : "--local", "--command", sql],
    { stdio: "inherit" },
  );
}

function main(): void {
  const { remote, code: rawCode } = parseArgs(process.argv.slice(2));

  let code: string;
  if (rawCode !== undefined) {
    const normalized = normalizeInviteCode(rawCode);
    if (!normalized) {
      console.error("invalid --code: must match ^[A-Z0-9-]{4,32}$ after trim + uppercase");
      process.exit(1);
    }
    code = normalized;
  } else {
    code = randomInviteCode();
  }

  const now = Date.now();

  // Validated above (or generated) against ^[A-Z0-9-]{4,32}$, so it's safe
  // to interpolate directly — no quotes or other SQL-special characters.
  const ensureSystemUser =
    "INSERT OR IGNORE INTO user (id, name, email, email_verified, created_at, updated_at, role) " +
    `VALUES ('system', 'system', 'system@users.tippaw.invalid', 0, ${now}, ${now}, 'streamer');`;
  const insertInvite =
    "INSERT INTO invite_code (code, note, max_uses, used_count, expires_at, disabled_at, created_by, created_at) " +
    `VALUES ('${code}', 'bootstrap', 1, 0, NULL, NULL, 'system', ${now});`;

  runD1(ensureSystemUser, remote);
  runD1(insertInvite, remote);

  console.log(code);
}

main();
