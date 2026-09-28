import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { onboard, registerUser } from "./helpers";

test.describe.configure({ mode: "serial" });

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const tsxBin = path.join(rootDir, "node_modules", "tsx", "dist", "cli.mjs");

/** Seeds a fresh single-use invite code directly in D1, own code so this spec doesn't collide with others. */
function bootstrapInvite(code: string): void {
  execFileSync(
    process.execPath,
    [tsxBin, path.join(rootDir, "scripts", "admin-bootstrap-invite.ts"), "--code", code],
    { stdio: "inherit", cwd: rootDir },
  );
}

const USERNAME = "e2ealertset";
const PASSWORD = "password12345";

test.describe("alert overlay settings", () => {
  test("edits template, color, and animation (persisted across reload), then resets the overlay URL", async ({
    page,
  }) => {
    bootstrapInvite("ALERT-BOOT-1");
    await registerUser(page, { username: USERNAME, password: PASSWORD, inviteCode: "ALERT-BOOT-1" });
    await onboard(page, "e2e-alert-cat");
    await expect(page).toHaveURL(/\/dashboard\/transactions$/);

    await page.goto("/dashboard/overlays/alert");

    // The dashboard is a normal MUI page (CssBaseline sets a real body background) —
    // it must never pick up the overlay's transparent-body reset (see AlertPlayer.tsx).
    const dashboardBodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(dashboardBodyBg).not.toBe("rgba(0, 0, 0, 0)");

    await page.getByLabel("ข้อความ template").fill("{name} ให้กำลังใจ {amount} บาท!");
    await page.getByLabel("สีข้อความ", { exact: true }).fill("#00FF00");
    await page.getByRole("button", { name: "บันทึก" }).click();
    await expect(page.getByText("บันทึกแล้ว")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("ข้อความ template")).toHaveValue("{name} ให้กำลังใจ {amount} บาท!");
    await expect(page.getByLabel("สีข้อความ", { exact: true })).toHaveValue("#00FF00");

    const urlField = page.getByLabel("Overlay URL", { exact: true });
    const originalUrl = await urlField.inputValue();
    expect(originalUrl.length).toBeGreaterThan(0);

    await page.getByRole("button", { name: "รีเซ็ต URL" }).click();
    await expect(page.getByText("URL เดิมจะใช้ไม่ได้ทันที")).toBeVisible();
    await page.getByRole("button", { name: "ยืนยันรีเซ็ต" }).click();
    await expect(page.getByText("รีเซ็ต URL แล้ว")).toBeVisible();

    await expect(urlField).not.toHaveValue(originalUrl);
  });
});
