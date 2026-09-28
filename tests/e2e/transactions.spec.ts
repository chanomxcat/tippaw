import { expect, test } from "@playwright/test";

import { bootstrapInvite, onboard, registerUser } from "./helpers";

// Serial: a single long scenario against the shared local D1 database for
// this `playwright test` run (see admin.spec.ts for the same reasoning).
test.describe.configure({ mode: "serial" });

const STREAMER_USERNAME = "e2etxncat";
const PASSWORD = "password12345";
const SLUG = "e2e-txn-cat";

test.describe("transactions page + alert replay", () => {
  test("a streamer sees a paid donation row, not a failed one, and can replay its alert", async ({
    page,
    browser,
  }) => {
    bootstrapInvite("TXN-BOOT-1");
    await registerUser(page, { username: STREAMER_USERNAME, password: PASSWORD, inviteCode: "TXN-BOOT-1" });
    await onboard(page, SLUG);
    await expect(page).toHaveURL(/\/dashboard\/transactions$/);
    await expect(page.getByText("ยังไม่มีรายการโดเนท")).toBeVisible();

    await page.goto("/dashboard/profile");
    await page.getByRole("button", { name: "เชื่อมต่อ Stripe" }).click();
    await expect(page.getByText("เชื่อมต่อแล้ว")).toBeVisible();

    // --- Viewer: a fresh, unauthenticated browser context. ---
    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();

    await viewerPage.goto(`/${SLUG}`);
    await viewerPage.getByLabel("ชื่อของคุณ").fill("แมวใจดี");
    await viewerPage.getByLabel("ข้อความถึงสตรีมเมอร์").fill("สู้ๆนะ!");
    await viewerPage.getByLabel("จำนวนเงิน (บาท)").fill("100");
    await viewerPage.getByRole("button", { name: "ชำระเงิน" }).click();
    await expect(viewerPage).toHaveURL(/\/mock\/checkout\//);
    await viewerPage.getByRole("button", { name: "จำลองชำระสำเร็จ" }).click();
    await expect(viewerPage).toHaveURL(new RegExp(`/${SLUG}/result\\?d=`));

    // A second donation that fails payment — must never show up in the transactions list.
    await viewerPage.goto(`/${SLUG}`);
    await viewerPage.getByLabel("ชื่อของคุณ").fill("แมวไม่สำเร็จ");
    await viewerPage.getByLabel("จำนวนเงิน (บาท)").fill("50");
    await viewerPage.getByRole("button", { name: "ชำระเงิน" }).click();
    await expect(viewerPage).toHaveURL(/\/mock\/checkout\//);
    await viewerPage.getByRole("button", { name: "จำลองชำระไม่สำเร็จ" }).click();
    await expect(viewerPage).toHaveURL(new RegExp(`/${SLUG}/result\\?d=`));

    await viewerContext.close();

    // --- Streamer: back on the transactions page. ---
    await page.goto("/dashboard/transactions");
    const row = page.getByRole("row", { name: /แมวใจดี/ });
    await expect(row).toBeVisible();
    await expect(row.getByText("฿100")).toBeVisible();
    await expect(row.getByText("สู้ๆนะ!")).toBeVisible();

    await expect(page.getByText("แมวไม่สำเร็จ")).toHaveCount(0);

    await row.getByRole("button", { name: "Alert ซ้ำ" }).click();
    await expect(page.getByText("ส่ง alert แล้ว")).toBeVisible();
  });
});
