import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig, defineProject } from "vitest/config";

export default defineConfig(async () => {
  const migrationsPath = path.join(import.meta.dirname, "drizzle");
  // `drizzle/` doesn't exist yet (Task 2 adds the schema + migrations), so
  // `readD1Migrations` would throw on the missing directory. Guard it so the
  // integration project can still boot with an empty migrations list.
  const migrations = await readD1Migrations(migrationsPath).catch(() => []);

  const alias = {
    "@": path.join(import.meta.dirname, "src"),
  };

  return {
    resolve: { alias },
    test: {
      projects: [
        {
          resolve: { alias },
          test: {
            name: "unit",
            environment: "node",
            include: ["tests/unit/**/*.test.ts"],
          },
        },
        defineProject({
          resolve: { alias },
          plugins: [
            cloudflareTest({
              main: "./tests/integration/test-worker.ts",
              wrangler: { configPath: "./wrangler.jsonc" },
              miniflare: {
                bindings: {
                  TEST_MIGRATIONS: migrations,
                  MOCK_WEBHOOK_SECRET: "test-secret",
                  BETTER_AUTH_SECRET: "test-secret",
                  BETTER_AUTH_URL: "http://localhost:8787",
                },
              },
            }),
          ],
          test: {
            name: "integration",
            include: ["tests/integration/**/*.test.ts"],
            setupFiles: ["./tests/integration/setup.ts"],
          },
        }),
      ],
    },
  };
});
