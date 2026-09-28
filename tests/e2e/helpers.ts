import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, type Page } from "@playwright/test";

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

/**
 * Clicks the mock checkout's "จำลองชำระสำเร็จ"/"จำลองชำระไม่สำเร็จ" button and
 * waits for it to redirect to the donor result page.
 *
 * Traced a real (not just slow) flake here across donate.spec.ts,
 * transactions.spec.ts, and golden-path.spec.ts full-suite runs: the click
 * would sometimes never produce the POST the button's handler makes —
 * confirmed absent from wrangler's own request log, not just slow to
 * arrive — meaning the click landed before the checkout page's client
 * bundle had finished hydrating (Playwright's actionability checks don't
 * wait on React hydration specifically, only on the element being visible/
 * stable/enabled) and was silently swallowed by the still-inert
 * server-rendered button. It reproduced more on a checkout page reached by
 * client-side `router.push` (a second donation in the same test) than by a
 * full `page.goto()`, and more under the sustained load of a full-suite
 * run than in isolation — consistent with hydration simply taking longer
 * to finish in those conditions. Retrying the click once, after giving up
 * on the expected navigation within a short window, is safe here: a
 * swallowed click has no observable side effect for the retry to conflict
 * with.
 */
export async function simulateMockCheckout(
  page: Page,
  outcome: "succeeded" | "failed",
  resultUrlPattern: RegExp,
): Promise<void> {
  const buttonName = outcome === "succeeded" ? "จำลองชำระสำเร็จ" : "จำลองชำระไม่สำเร็จ";
  await page.getByRole("button", { name: buttonName }).click();
  try {
    await expect(page).toHaveURL(resultUrlPattern, { timeout: 5_000 });
    return;
  } catch {
    // Possibly a hydration-race click that never reached the server — retry
    // once now that the page has had more time to finish hydrating.
  }
  await page.getByRole("button", { name: buttonName }).click();
  await expect(page).toHaveURL(resultUrlPattern);
}

/** Promotes `username` to admin by shelling out to `scripts/admin-promote.ts` against the local D1 database. */
export function promoteToAdmin(username: string): void {
  execFileSync(
    process.execPath,
    [tsxBin, path.join(rootDir, "scripts", "admin-promote.ts"), username],
    { stdio: "inherit", cwd: rootDir },
  );
}
