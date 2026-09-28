import { expect, test } from "@playwright/test";

import { onboard, registerUser } from "./helpers";

test.describe.configure({ mode: "serial" });

const USERNAME = "e2esettings";
const PASSWORD = "password12345";

test.describe("profile + tip page settings", () => {
  test("onboards, edits tip page settings (persisted across reload), and connects payout", async ({ page }) => {
    await registerUser(page, { username: USERNAME, password: PASSWORD, inviteCode: "E2E-BOOT" });
    await onboard(page, "e2e-settings-cat");
    await expect(page).toHaveURL(/\/dashboard\/transactions$/);

    await page.goto("/dashboard/tip-page");
    await page.getByLabel("ชื่อช่อง").fill("แมวจอมป่วน");
    await page.getByRole("button", { name: "เพิ่มลิงก์" }).click();
    await page.getByLabel("ชื่อลิงก์").fill("Twitter");
    await page.getByLabel("URL").fill("https://twitter.com/example");
    await page.getByRole("button", { name: "บันทึก" }).click();

    await page.reload();
    await expect(page.getByLabel("ชื่อช่อง")).toHaveValue("แมวจอมป่วน");
    await expect(page.getByLabel("ชื่อลิงก์")).toHaveValue("Twitter");
    await expect(page.getByLabel("URL")).toHaveValue("https://twitter.com/example");

    await page.goto("/dashboard/profile");
    await expect(page.getByText("ยังไม่ได้เชื่อมต่อ")).toBeVisible();
    await page.getByRole("button", { name: "เชื่อมต่อ Stripe" }).click();
    await expect(page.getByText("เชื่อมต่อแล้ว")).toBeVisible();
  });
});
