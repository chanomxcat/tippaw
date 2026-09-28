import { expect, test } from "@playwright/test";

import { onboard, registerUser } from "./helpers";

// Serial: these tests share one local D1 database seeded once by
// tests/e2e/global-setup.ts (via webServer.command), and the first test
// consumes the single-use `E2E-BOOT` invite code.
test.describe.configure({ mode: "serial" });

const USERNAME = "e2ecat";
const PASSWORD = "password12345";

test.describe("auth + onboarding", () => {
  test("register with a valid invite, onboard without seeing the invite field, reach the dashboard", async ({
    page,
  }) => {
    await registerUser(page, { username: USERNAME, password: PASSWORD, inviteCode: "E2E-BOOT" });

    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByLabel("Invite code")).toHaveCount(0);

    await onboard(page, "e2e-cat");

    await expect(page).toHaveURL(/\/dashboard\/transactions$/);
    await expect(page.getByText("ยังไม่มีรายการโดเนท")).toBeVisible();
  });

  test("registering with a bogus invite code shows an error", async ({ page }) => {
    await registerUser(page, { username: "e2ebogus", password: PASSWORD, inviteCode: "BOGUS-CODE" });

    await expect(page.getByText("invite code ไม่ถูกต้อง")).toBeVisible();
  });

  test("logging out then opening /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("ชื่อผู้ใช้").fill(USERNAME);
    await page.getByLabel("รหัสผ่าน").fill(PASSWORD);
    await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole("button", { name: "บัญชีผู้ใช้" }).click();
    await page.getByRole("button", { name: "ออกจากระบบ" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("Streamlabs sign-in reaches onboarding with the invite field, and /dashboard bounces back to /onboarding", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "เข้าสู่ระบบด้วย Streamlabs" }).click();

    await expect(page.getByLabel("ชื่อผู้ใช้ Streamlabs")).toBeVisible();
    await page.getByLabel("ชื่อผู้ใช้ Streamlabs").fill("slcat");
    await page.getByRole("button", { name: "อนุญาต" }).click();

    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByLabel("Invite code")).toBeVisible();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/onboarding$/);
  });
});
