import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Setup files run outside per-test-file storage isolation and may run more
// than once; `applyD1Migrations()` only applies migrations that haven't been
// applied yet, so calling it here is safe. `drizzle/` doesn't exist until
// Task 2 adds the schema, so `TEST_MIGRATIONS` may be an empty array — guard
// against that instead of calling `applyD1Migrations` with nothing to do.
const migrations = (env as unknown as { TEST_MIGRATIONS?: unknown[] })
  .TEST_MIGRATIONS;

if (migrations && migrations.length > 0) {
  await applyD1Migrations(env.DB, migrations as never);
}
