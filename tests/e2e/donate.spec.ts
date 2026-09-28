import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { onboard, registerUser } from "./helpers";

// Serial: a single long scenario against the shared local D1 database for
// this `playwright test` run (see admin.spec.ts for the same reasoning).
test.describe.configure({ mode: "serial" });

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const tsxBin = path.join(rootDir, "node_modules", "tsx", "dist", "cli.mjs");

/**
 * Seeds a fresh single-use invite code directly in D1, so this spec doesn't
 * compete with auth.spec.ts / settings.spec.ts for the shared `E2E-BOOT` code.
 */
function bootstrapInvite(code: string): void {
  execFileSync(
    process.execPath,
    [tsxBin, path.join(rootDir, "scripts", "admin-bootstrap-invite.ts"), "--code", code],
    { stdio: "inherit", cwd: rootDir },
  );
}

const STREAMER_USERNAME = "e2edonatecat";
const OTHER_USERNAME = "e2edonateunready";
const PASSWORD = "password12345";
const SLUG = "e2e-donate-cat";
const OTHER_SLUG = "e2e-donate-unready";

test.describe("public tip page + mock checkout + result", () => {
  test("a viewer tips a streamer through the mock checkout, sees the result, and a not-yet-accepting streamer shows the closed message", async ({
    page,
    browser,
  }) => {
    // --- Streamer 1: onboard and connect payout. ---
    bootstrapInvite("DON-BOOT-1");
    await registerUser(page, { username: STREAMER_USERNAME, password: PASSWORD, inviteCode: "DON-BOOT-1" });
    await onboard(page, SLUG);
    await expect(page).toHaveURL(/\/dashboard\/transactions$/);

    await page.goto("/dashboard/profile");
    await page.getByRole("button", { name: "เชื่อมต่อ Stripe" }).click();
    await expect(page.getByText("เชื่อมต่อแล้ว")).toBeVisible();

    await page.getByRole("button", { name: "บัญชีผู้ใช้" }).click();
    await page.getByRole("button", { name: "ออกจากระบบ" }).click();
    await expect(page).toHaveURL(/\/login$/);

    // --- Streamer 2: onboard only, never connects payout. ---
    bootstrapInvite("DON-BOOT-2");
    await registerUser(page, { username: OTHER_USERNAME, password: PASSWORD, inviteCode: "DON-BOOT-2" });
    await onboard(page, OTHER_SLUG);
    await expect(page).toHaveURL(/\/dashboard\/transactions$/);

    // --- Viewer: a fresh, unauthenticated browser context. ---
    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();

    // Uppercase slug in the URL still resolves (normalized before lookup).
    await viewerPage.goto(`/${SLUG.toUpperCase()}`);
    await expect(viewerPage.getByText(STREAMER_USERNAME)).toBeVisible();

    await viewerPage.getByLabel("ชื่อของคุณ").fill("แมวใจดี");
    await viewerPage.getByLabel("จดจำชื่อ").check();
    await viewerPage.getByLabel("ข้อความถึงสตรีมเมอร์").fill("สู้ๆนะ!");
    await viewerPage.getByLabel("จำนวนเงิน (บาท)").fill("100");
    await viewerPage.getByRole("button", { name: "ชำระเงิน" }).click();

    await expect(viewerPage).toHaveURL(/\/mock\/checkout\//);
    await expect(viewerPage.getByText("โหมดทดสอบ")).toBeVisible();
    await viewerPage.getByRole("button", { name: "จำลองชำระสำเร็จ" }).click();

    await expect(viewerPage).toHaveURL(new RegExp(`/${SLUG}/result\\?d=`));
    await expect(viewerPage.getByText("ขอบคุณสำหรับการสนับสนุนนะ")).toBeVisible();

    // Reopening the tip page: the donor name was remembered.
    await viewerPage.goto(`/${SLUG}`);
    await expect(viewerPage.getByLabel("ชื่อของคุณ")).toHaveValue("แมวใจดี");

    // A second donation, this time simulating a failed payment.
    await viewerPage.getByLabel("จำนวนเงิน (บาท)").fill("50");
    await viewerPage.getByRole("button", { name: "ชำระเงิน" }).click();
    await expect(viewerPage).toHaveURL(/\/mock\/checkout\//);
    await viewerPage.getByRole("button", { name: "จำลองชำระไม่สำเร็จ" }).click();

    await expect(viewerPage).toHaveURL(new RegExp(`/${SLUG}/result\\?d=`));
    await expect(viewerPage.getByText("การชำระเงินไม่สำเร็จ")).toBeVisible();
    await viewerPage.getByRole("button", { name: "ลองอีกครั้ง" }).click();
    await expect(viewerPage).toHaveURL(new RegExp(`/${SLUG}$`));

    // The other streamer hasn't connected a payout account yet.
    await viewerPage.goto(`/${OTHER_SLUG}`);
    await expect(viewerPage.getByText("ยังไม่เปิดรับโดเนท")).toBeVisible();

    await viewerContext.close();
  });
});
