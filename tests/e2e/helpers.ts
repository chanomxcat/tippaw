import type { Page } from "@playwright/test";

/** Fills and submits the register form (`/register?code=...`). Leaves the browser wherever the app redirects to next (normally `/onboarding`). */
export async function registerUser(
  page: Page,
  options: { username: string; password: string; inviteCode: string },
): Promise<void> {
  await page.goto(`/register?code=${encodeURIComponent(options.inviteCode)}`);
  await page.getByLabel("ชื่อผู้ใช้").fill(options.username);
  // MUI's required-field marker adds to the label's accessible name (e.g.
  // "รหัสผ่าน *"), so `exact: true` never matches; a substring match (still
  // unambiguous here) is what works.
  await page.getByLabel("รหัสผ่าน").fill(options.password);
  await page.getByLabel("Invite code").fill(options.inviteCode);
  await page.getByRole("button", { name: "สมัครสมาชิก" }).click();
}

/** Fills and submits the slug step of `/onboarding` (assumes any invite-code step, if shown, was already filled). */
export async function onboard(page: Page, slug: string): Promise<void> {
  await page.getByLabel("Slug").fill(slug);
  await page.getByRole("button", { name: "บันทึก" }).click();
}
