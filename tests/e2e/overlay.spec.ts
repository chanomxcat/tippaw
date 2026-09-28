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

const USERNAME = "e2eoverlay1";
const PASSWORD = "password12345";

test.describe("alert overlay (OBS browser source)", () => {
  test("plays a test alert on the overlay page, then goes invalid after a token reset", async ({ page, context }) => {
    bootstrapInvite("OVERLAY-BOOT-1");
    await registerUser(page, { username: USERNAME, password: PASSWORD, inviteCode: "OVERLAY-BOOT-1" });
    await onboard(page, "e2e-overlay-cat");
    await expect(page).toHaveURL(/\/dashboard\/transactions$/);

    await page.goto("/dashboard/overlays/alert");

    // Reveal the overlay URL (it's a password-masked, read-only field) and open it in a second page.
    await page.getByRole("button", { name: "แสดง URL" }).click();
    const overlayUrl = await page.getByLabel("Overlay URL", { exact: true }).inputValue();
    expect(overlayUrl.length).toBeGreaterThan(0);

    const overlayPage = await context.newPage();
    await overlayPage.goto(overlayUrl);
    await expect(overlayPage.getByText("TipPaw โดเนท 100 บาท")).not.toBeVisible();

    await page.getByRole("button", { name: "ทดสอบ Alert" }).click();

    await expect(overlayPage.getByText("TipPaw โดเนท 100 บาท")).toBeVisible({ timeout: 5_000 });
    await expect(overlayPage.getByText("นี่คือการทดสอบ alert")).toBeVisible();

    // Default variant duration is 8s; plus the 500ms in/out transitions it should be gone well within 12s.
    await expect(overlayPage.getByText("TipPaw โดเนท 100 บาท")).not.toBeVisible({ timeout: 12_000 });

    await page.getByRole("button", { name: "รีเซ็ต URL" }).click();
    await expect(page.getByText("URL เดิมจะใช้ไม่ได้ทันที")).toBeVisible();
    await page.getByRole("button", { name: "ยืนยันรีเซ็ต" }).click();
    await expect(page.getByText("รีเซ็ต URL แล้ว")).toBeVisible();

    await overlayPage.reload();
    await expect(overlayPage.getByText("Overlay URL ไม่ถูกต้องหรือถูกรีเซ็ตแล้ว")).toBeVisible();
  });
});
