import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { onboard, promoteToAdmin, registerUser } from "./helpers";

// Serial: a single long scenario that logs in/out as different users against
// the one local D1 database shared across this whole `playwright test` run
// (seeded once by tests/e2e/global-setup.ts, via webServer.command).
test.describe.configure({ mode: "serial" });

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const tsxBin = path.join(rootDir, "node_modules", "tsx", "dist", "cli.mjs");

/**
 * Seeds a fresh single-use invite code directly in D1 (same script that
 * seeds `E2E-BOOT`), so this spec doesn't compete with auth.spec.ts for the
 * one `E2E-BOOT` code shared across the whole test run.
 */
function bootstrapInvite(code: string): void {
  execFileSync(
    process.execPath,
    [tsxBin, path.join(rootDir, "scripts", "admin-bootstrap-invite.ts"), "--code", code],
    { stdio: "inherit", cwd: rootDir },
  );
}

const ADMIN_USERNAME = "e2eadmin";
const STREAMER_USERNAME = "e2ecatvip";
const PASSWORD = "password12345";

test.describe("admin CMS", () => {
  test("admin creates an invite code; a streamer redeeming it fills the quota; streamers can't reach /admin", async ({
    page,
  }) => {
    bootstrapInvite("ADM-BOOT");
    await registerUser(page, { username: ADMIN_USERNAME, password: PASSWORD, inviteCode: "ADM-BOOT" });
    await onboard(page, "e2e-admin");
    await expect(page).toHaveURL(/\/dashboard\/transactions$/);

    promoteToAdmin(ADMIN_USERNAME);

    await page.goto("/admin/invites");
    await expect(page).toHaveURL(/\/admin\/invites$/);

    await page.getByRole("button", { name: "สร้างโค้ด" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("กำหนดเอง").click();
    await dialog.getByLabel("โค้ด").fill("E2E-CAT");
    await dialog.getByLabel("โควตา").fill("1");
    await dialog.getByRole("button", { name: "สร้าง", exact: true }).click();

    await expect(page.getByText("E2E-CAT")).toBeVisible();

    // Log the admin out and register a fresh streamer against the new code.
    await page.getByRole("button", { name: "บัญชีผู้ใช้" }).click();
    await page.getByRole("button", { name: "ออกจากระบบ" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await registerUser(page, { username: STREAMER_USERNAME, password: PASSWORD, inviteCode: "E2E-CAT" });
    await onboard(page, "e2e-cat-vip");
    await expect(page).toHaveURL(/\/dashboard\/transactions$/);

    // A streamer can't reach the admin CMS — bounced back to the dashboard.
    await page.goto("/admin/invites");
    await expect(page).toHaveURL(/\/dashboard/);

    // Log the streamer out and back in as the admin to check the quota.
    await page.getByRole("button", { name: "บัญชีผู้ใช้" }).click();
    await page.getByRole("button", { name: "ออกจากระบบ" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel("ชื่อผู้ใช้").fill(ADMIN_USERNAME);
    await page.getByLabel("รหัสผ่าน").fill(PASSWORD);
    await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/admin/invites");
    const row = page.locator("tr", { hasText: "E2E-CAT" });
    await expect(row.getByText("1 / 1")).toBeVisible();
    await expect(row.getByText("เต็ม")).toBeVisible();
  });
});
