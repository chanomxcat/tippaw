import { expect, test } from "@playwright/test";

import { bootstrapInvite, onboard, promoteToAdmin, registerUser } from "./helpers";

// One long scenario covering the whole golden path end to end (spec §8):
// admin creates an invite code in the CMS, a streamer redeems it, sets a
// slug, connects payout, opens the overlay in one tab and donates from
// another, sees the alert on the overlay + the result page + the
// transactions list, then replays the alert. Serial for the same reason as
// the other specs: one long story against the shared local D1 database for
// this `playwright test` run.
test.describe.configure({ mode: "serial" });

const ADMIN_USERNAME = "e2egoldadmin";
const STREAMER_USERNAME = "e2egoldcat";
const PASSWORD = "password12345";
const SLUG = "e2e-gold-cat";
const BOOTSTRAP_CODE = "GOLD-BOOT-1";
const INVITE_CODE = "GOLD-CAT";
const DONOR_NAME = "แมวทองคำ";
const DONOR_MESSAGE = "ขอบคุณที่ทำคอนเทนต์ดีๆนะ!";
const HEADLINE_TEXT = `${DONOR_NAME} โดเนท 100 บาท`;

test.describe("golden path", () => {
  test("admin creates an invite, a streamer redeems it end to end, and a real donation alerts + replays", async ({
    page,
    browser,
  }) => {
    // --- Admin: bootstrap, onboard, promote, then create an invite code through the CMS. ---
    bootstrapInvite(BOOTSTRAP_CODE);
    await registerUser(page, { username: ADMIN_USERNAME, password: PASSWORD, inviteCode: BOOTSTRAP_CODE });
    await onboard(page, "e2e-gold-admin");
    await expect(page).toHaveURL(/\/dashboard\/transactions$/);

    promoteToAdmin(ADMIN_USERNAME);

    await page.goto("/admin/invites");
    await expect(page).toHaveURL(/\/admin\/invites$/);

    await page.getByRole("button", { name: "สร้างโค้ด" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("กำหนดเอง").click();
    await dialog.getByLabel("โค้ด").fill(INVITE_CODE);
    await dialog.getByLabel("โควตา").fill("1");
    await dialog.getByRole("button", { name: "สร้าง", exact: true }).click();
    await expect(page.getByText(INVITE_CODE)).toBeVisible();

    await page.getByRole("button", { name: "บัญชีผู้ใช้" }).click();
    await page.getByRole("button", { name: "ออกจากระบบ" }).click();
    await expect(page).toHaveURL(/\/login$/);

    // --- Streamer: redeem the code, set a slug, connect payout. ---
    await registerUser(page, { username: STREAMER_USERNAME, password: PASSWORD, inviteCode: INVITE_CODE });
    await onboard(page, SLUG);
    await expect(page).toHaveURL(/\/dashboard\/transactions$/);

    await page.goto("/dashboard/profile");
    await page.getByRole("button", { name: "เชื่อมต่อ Stripe" }).click();
    await expect(page.getByText("เชื่อมต่อแล้ว")).toBeVisible();

    // --- Streamer: reveal the overlay URL and open it in its own tab. ---
    await page.goto("/dashboard/overlays/alert");
    await page.getByRole("button", { name: "แสดง URL" }).click();
    const overlayUrl = await page.getByLabel("Overlay URL", { exact: true }).inputValue();
    expect(overlayUrl.length).toBeGreaterThan(0);

    const overlayContext = await browser.newContext();
    const overlayPage = await overlayContext.newPage();
    await overlayPage.goto(overlayUrl);

    // --- Viewer: a fresh, unauthenticated tab donates at the public tip page. ---
    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();

    await viewerPage.goto(`/${SLUG}`);
    await expect(viewerPage.getByText(STREAMER_USERNAME)).toBeVisible();
    await viewerPage.getByLabel("ชื่อของคุณ").fill(DONOR_NAME);
    await viewerPage.getByLabel("ข้อความถึงสตรีมเมอร์").fill(DONOR_MESSAGE);
    await viewerPage.getByLabel("จำนวนเงิน (บาท)").fill("100");
    await viewerPage.getByRole("button", { name: "ชำระเงิน" }).click();

    await expect(viewerPage).toHaveURL(/\/mock\/checkout\//);
    await viewerPage.getByRole("button", { name: "จำลองชำระสำเร็จ" }).click();

    // --- Overlay: the alert plays with the donor's name, amount, and message. ---
    // This is the first real alert this overlay tab has ever received, so
    // unlike the replay check below (where the realtime WebSocket has long
    // been open), it can race the Durable Object's first-ever cold start
    // for this test run (this is the only spec that opens an overlay tab
    // *and* triggers a real, non-test alert through it). No explicit
    // per-call timeout here — it inherits playwright.config.ts's global
    // `expect.timeout`, generous enough to absorb that one-time cost
    // without hiding an actually-broken alert path (which would still
    // never arrive, however long we wait).
    await expect(overlayPage.getByText(HEADLINE_TEXT)).toBeVisible();
    await expect(overlayPage.getByText(DONOR_MESSAGE)).toBeVisible();

    // --- Viewer: the result page shows the success message. ---
    await expect(viewerPage).toHaveURL(new RegExp(`/${SLUG}/result\\?d=`));
    await expect(viewerPage.getByText("ขอบคุณสำหรับการสนับสนุนนะ")).toBeVisible();

    // Let the first alert finish its own exit animation (default duration
    // 8s + 500ms in/out transitions) before replaying it, so the replay's
    // reappearance is unambiguous rather than the same alert still showing.
    await expect(overlayPage.getByText(HEADLINE_TEXT)).not.toBeVisible({ timeout: 12_000 });

    // --- Streamer: the transactions page lists the paid donation. ---
    await page.goto("/dashboard/transactions");
    const row = page.getByRole("row", { name: new RegExp(DONOR_NAME) });
    await expect(row).toBeVisible();
    await expect(row.getByText("฿100")).toBeVisible();
    await expect(row.getByText(DONOR_MESSAGE)).toBeVisible();

    // --- Streamer: replaying the alert plays it on the overlay again. ---
    await row.getByRole("button", { name: "Alert ซ้ำ" }).click();
    await expect(page.getByText("ส่ง alert แล้ว")).toBeVisible();
    await expect(overlayPage.getByText(HEADLINE_TEXT)).toBeVisible();
    await expect(overlayPage.getByText(DONOR_MESSAGE)).toBeVisible();

    await overlayContext.close();
    await viewerContext.close();
  });
});
