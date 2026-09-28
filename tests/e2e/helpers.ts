import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Page } from "@playwright/test";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const tsxBin = path.join(rootDir, "node_modules", "tsx", "dist", "cli.mjs");

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

/** Promotes `username` to admin by shelling out to `scripts/admin-promote.ts` against the local D1 database. */
export function promoteToAdmin(username: string): void {
  execFileSync(
    process.execPath,
    [tsxBin, path.join(rootDir, "scripts", "admin-promote.ts"), username],
    { stdio: "inherit", cwd: rootDir },
  );
}
