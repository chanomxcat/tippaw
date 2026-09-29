# daisyUI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace TipPaw's MUI + Minimal (free) UI stack with Tailwind CSS v4 + daisyUI everywhere except the OBS overlay pages, keeping the same palette/font/behavior and adding dark mode.

**Architecture:** Set up Tailwind/daisyUI and the shared dashboard chrome first, then rewrite each route group (auth → public tip flow → dashboard settings → alert settings → transactions → admin) one at a time, deleting that group's MUI code as it's replaced and running its e2e spec immediately. A final cleanup task removes `src/ui/minimal` and the MUI/Emotion dependencies once nothing references them.

**Tech Stack:** Tailwind CSS v4 (`@tailwindcss/postcss`, CSS-first config), daisyUI v5 plugin, `lucide-react` for icons, existing Next.js 16 App Router / React 19 / Vitest / Playwright setup (unchanged).

**Spec:** [docs/superpowers/specs/2026-09-29-daisyui-migration-design.md](../specs/2026-09-29-daisyui-migration-design.md)

## Global Constraints

- Tailwind CSS v4 via `@tailwindcss/postcss`; daisyUI config is CSS-first (`@plugin` directives in `globals.css`), no `tailwind.config.js`.
- Palette values are fixed (spec §11 of the main design, carried into the migration spec §4): primary lighter `#E7D6E3`, light `#AF719D`, main `#8B639B`, dark `#403D88`, darker `#2A2860`; secondary main `#F8B2B2` with contrast text `#403D88` — **never white text on `#F8B2B2`**.
- Font stays Prompt via `next/font/google` (`src/app/(site)/layout.tsx`), exposed as `--font-prompt` and wired to Tailwind's `--font-sans`.
- `src/app/overlay/**` is out of scope — do not modify.
- By the end of the plan, `src/ui/minimal/**` is deleted and `package.json` no longer lists `@mui/material`, `@mui/material-nextjs`, `@emotion/react`, `@emotion/styled`, `minimal-shared`, `simplebar-react`, `@iconify/react`.
- Two daisyUI themes: `tippaw` (default, light) and `tippaw-dark`, switched via `data-theme` on `<html>` + `localStorage`.
- No layout/UX/business-logic changes — this is a technology swap. Existing accessible names (labels, button text, roles) that Playwright specs assert on must be preserved exactly.
- Run the e2e spec(s) covering a route group immediately after that group's task, not only at the end.

## Review Focus

- Admin invite-create dialog must keep `role="dialog"` and the exact labels `getByLabel("กำหนดเอง")`, `getByLabel("โค้ด")`, `getByLabel("โควตา")` that `tests/e2e/admin.spec.ts` and `tests/e2e/golden-path.spec.ts` assert on directly.
- `ColorField`'s hex text input must keep the accessible name `"สีข้อความ"` matched with `exact: true` in `tests/e2e/alert-settings.spec.ts` — don't let it collide with the native color-swatch input's own accessible name.
- The reset-overlay-token confirmation button text `"ยืนยันรีเซ็ต"` (currently an MUI `Dialog`) must survive the move into the shared daisyUI modal in `tests/e2e/alert-settings.spec.ts` / `tests/e2e/overlay.spec.ts`.
- The dark-mode toggle (new, no spec precedent) must not be reachable/clickable before Task 9 finishes, since pages still on MUI won't respond to `data-theme` and would render half-light/half-dark — Task 2 wires the mechanism but the toggle stays hidden behind `MOCK_MODE`-independent code review until Task 9 confirms full coverage (see Task 2 Step notes and Task 9).
- `admin/invites-client.tsx`'s enable/disable `Switch` and the three `TextField select` + `MenuItem` dropdowns in `AlertSettingsForm` have no current e2e coverage locking in their exact behavior (only manual/visual verification) — Tasks 8 and 6 must manually exercise them via `pnpm dev` since a regression there wouldn't fail CI.

---

## Task 1: Tailwind v4 + daisyUI setup, theme tokens, dark-mode mechanism

**Files:**
- Modify: `package.json` (add `tailwindcss`, `@tailwindcss/postcss`, `daisyui`, `lucide-react`)
- Create: `postcss.config.mjs`
- Modify: `src/app/globals.css` (replace contents)
- Create: `src/lib/theme.ts`
- Modify: `src/app/(site)/layout.tsx` (add no-flash inline theme script; keep existing `Providers`/MUI wiring untouched for now)

**Interfaces:**
- Produces: `src/lib/theme.ts` exports `type ThemeName = "tippaw" | "tippaw-dark"`, `THEME_STORAGE_KEY = "tippaw-theme"`, `getStoredTheme(): ThemeName | null`, `applyTheme(theme: ThemeName): void` (sets `document.documentElement.dataset.theme` and `localStorage`). Later tasks (2, 9) import these.
- Produces: daisyUI theme names `"tippaw"` / `"tippaw-dark"` and the CSS custom-theme token set from spec §4, available globally once `globals.css` loads.

- [ ] **Step 1: Install dependencies**

Run: `pnpm add tailwindcss @tailwindcss/postcss daisyui lucide-react`
Expected: `package.json` and lockfile updated, no peer-dependency errors.

- [ ] **Step 2: Create `postcss.config.mjs`**

```js
export default {
  plugins: { "@tailwindcss/postcss": {} },
};
```

- [ ] **Step 3: Replace `src/app/globals.css`**

Write the two daisyUI custom themes (`tippaw`, `tippaw-dark`) exactly as specified in the migration spec §4, plus `@import "tailwindcss";`, `@plugin "daisyui" { themes: tippaw --default, tippaw-dark --prefersdark; }`, and `@theme { --font-sans: var(--font-prompt); }`. Keep a `@layer base { html, body { margin: 0; padding: 0; } }` rule (Tailwind preflight already resets most of this).

- [ ] **Step 4: Write `src/lib/theme.ts`**

Implement the four exports listed in Interfaces above. `getStoredTheme` reads `localStorage.getItem(THEME_STORAGE_KEY)` and returns it only if it's one of the two valid `ThemeName`s, else `null`. `applyTheme` writes both the DOM attribute and `localStorage`.

- [ ] **Step 5: Add the no-flash inline script to `src/app/(site)/layout.tsx`**

Inside `<html lang="th" className={prompt.variable}>`, before `<body>`, add a `<script dangerouslySetInnerHTML>` that reads `localStorage.getItem("tippaw-theme")`, falls back to `window.matchMedia("(prefers-color-scheme: dark)")`, and sets `document.documentElement.dataset.theme` synchronously (inline, not importing `theme.ts`, since it must run before any bundle — duplicate the tiny logic literally).

- [ ] **Step 6: Verify the build compiles, including the Cloudflare/OpenNext packaging step**

Run: `pnpm build` (this project's `build` script runs `opennextjs-cloudflare build`, which itself calls `next build` — this is the same pipeline used for deploy, addressing the CSS-first Tailwind/PostCSS config risk noted in the migration spec §8)
Expected: build succeeds (MUI pages still render via `Providers`/Emotion; Tailwind/daisyUI CSS is additionally generated — no PostCSS errors, `.open-next/` produced).

- [ ] **Step 7: Verify theme tokens are in the compiled CSS**

Run: `grep -r "8B639B" .next/static/css/*.css` (or the equivalent output path `next build` reports)
Expected: at least one match, confirming the custom theme reached the compiled stylesheet.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml postcss.config.mjs src/app/globals.css src/lib/theme.ts "src/app/(site)/layout.tsx"
git commit -m "feat: add Tailwind v4 + daisyUI setup with tippaw/tippaw-dark themes"
```

---

## Task 2: Shared dashboard shell (nav, header, account popover, theme toggle)

**Files:**
- Create: `src/components/layout/dashboard-shell.tsx`
- Create: `src/components/layout/dashboard-nav.tsx`
- Create: `src/components/layout/dashboard-header.tsx`
- Create: `src/components/layout/theme-toggle.tsx`
- Modify: `src/ui/nav-config.ts` (change `NavItem.icon` from `string` to a `lucide-react` icon component reference)
- Modify: `src/app/(site)/dashboard/layout.tsx` (import path only)
- Modify: `src/app/(site)/admin/layout.tsx` (import path only)
- Delete: `src/ui/minimal/layouts/dashboard/nav.tsx`, `account-popover.tsx`, `menu-button.tsx`, `dashboard-shell.tsx`, `content.tsx`, `css-vars.ts`, `src/ui/minimal/layouts/core/*`, `src/ui/minimal/components/logo/**` (confirmed unused outside `src/ui/minimal` by grep), `src/ui/minimal/layouts/dashboard/index.ts`

**Interfaces:**
- Consumes: `applyTheme`, `getStoredTheme`, `ThemeName` from `src/lib/theme.ts` (Task 1).
- Produces: `DashboardShell` component with the exact same props as today — `{ nav: NavItem[]; user: { name: string }; children: React.ReactNode }` (drop the MUI-only `layoutQuery` prop; the daisyUI `drawer` handles its own breakpoint via a CSS media query, no JS breakpoint prop needed) — imported as `import { DashboardShell } from "@/components/layout/dashboard-shell"`.
- Produces: `NavItem = { title: string; path: string; icon: LucideIcon }` (from `"lucide-react"`), replacing the iconify-string field. `STREAMER_NAV` and `ADMIN_NAV` keep their same titles/paths; icons map to: ธุรกรรม→`Receipt`, หน้า Tip→`Heart`, Alert→`Bell`, โปรไฟล์→`User`, Invite codes→`Ticket`, ผู้ใช้→`Users`.

- [ ] **Step 1: Update `src/ui/nav-config.ts`**

Change `NavItem`'s `icon` field type to `import type { LucideIcon } from "lucide-react"`, import the six icons listed above, and assign them directly (no string keys).

- [ ] **Step 2: Write `dashboard-nav.tsx`**

Export `DashboardNav({ nav, className }: { nav: NavItem[]; className?: string })` rendering a daisyUI `menu` (`<ul className="menu">`) of `next/link` items, each showing `<item.icon size={20} />` + `item.title`, highlighting the active route via `usePathname()`.

- [ ] **Step 3: Write `dashboard-header.tsx`**

Export `DashboardHeader({ user }: { user: { name: string } })`: a daisyUI `navbar` containing (a) a mobile drawer-toggle button (`<label htmlFor="dashboard-drawer" className="btn btn-square btn-ghost lg:hidden"><Menu /></label>`), (b) the account dropdown (daisyUI `dropdown` replacing MUI `Popover`) showing `user.name`, a "บัญชีผู้ใช้" label, and "ออกจากระบบ" logout action (reuse whatever server action/link the current `account-popover.tsx` calls for sign-out — read it before removing), (c) the `ThemeToggle`.

- [ ] **Step 4: Write `theme-toggle.tsx`**

Client component: on mount, read `getStoredTheme()` (falling back to the current `data-theme`) into state; render a daisyUI `swap` checkbox toggle (sun/moon) that calls `applyTheme()` on change.

- [ ] **Step 5: Write `dashboard-shell.tsx`**

Export `DashboardShell({ nav, user, children })` using daisyUI's `drawer` pattern: a checkbox input `id="dashboard-drawer"`, `drawer-content` holding `DashboardHeader` + `<main>{children}</main>`, `drawer-side` holding `DashboardNav`.

- [ ] **Step 6: Update the two layout files' import**

In `src/app/(site)/dashboard/layout.tsx` and `src/app/(site)/admin/layout.tsx`, change the import to `@/components/layout/dashboard-shell` and drop any now-unused `layoutQuery` usage (there is none passed today, so this is import-path-only).

- [ ] **Step 7: Delete the replaced Minimal layout files**

Delete exactly the files listed above under "Delete" — leave `src/ui/minimal/theme/**`, `components/iconify/**`, and `components/scrollbar/**` in place (still used elsewhere until later tasks/Task 9).

- [ ] **Step 8: Manually verify nav/header/toggle in the browser**

Run: `pnpm dev`, sign in, open `/dashboard` and `/admin` (as admin user)
Expected: nav renders both route groups' items with lucide icons, mobile drawer opens/closes, account dropdown shows name + logout, theme toggle flips `data-theme` on `<html>` (visual effect is partial until later tasks — that's expected per Review Focus).

- [ ] **Step 9: Run affected e2e specs**

Run: `pnpm exec playwright test tests/e2e/auth.spec.ts tests/e2e/settings.spec.ts`
Expected: PASS (these log in and reach dashboard pages through the new shell; the pages themselves are still MUI and unchanged).

- [ ] **Step 10: Commit**

```bash
git add src/components/layout src/ui/nav-config.ts "src/app/(site)/dashboard/layout.tsx" "src/app/(site)/admin/layout.tsx" src/ui/minimal
git commit -m "feat: rebuild dashboard shell/nav/header with daisyUI, add theme toggle"
```

---

## Task 3: Auth, onboarding, and home pages

**Files:**
- Modify: `src/app/(site)/(auth)/login/login-form.tsx`
- Modify: `src/app/(site)/(auth)/register/register-form.tsx`
- Modify: `src/app/(site)/onboarding/onboarding-form.tsx`
- Modify: `src/app/(site)/page.tsx`

**Interfaces:**
- Consumes: nothing new from prior tasks (these forms use plain `useState` + an inline `Alert` for errors, no toast/dialog needed).
- Produces: nothing consumed by later tasks — these are leaf pages.

- [ ] **Step 1: Rewrite `login-form.tsx`**

Swap `Card`/`Container`/`Stack`/`TextField`/`Button`/`Alert`/`Divider`/`Typography`/`Link`/`Box` for daisyUI `card`, Tailwind layout (`flex flex-col gap-4`), daisyUI `input`/`label` pairs (keep every existing `htmlFor`/label text unchanged), `btn btn-primary`, a daisyUI `divider`, and `role="alert"` + `alert alert-error` for the error state. Keep the Streamlabs OAuth button's text/behavior identical.

- [ ] **Step 2: Rewrite `register-form.tsx`**

Same pattern as Step 1, preserving the invite-code field's label text exactly (e2e/integration tests may reference it).

- [ ] **Step 3: Rewrite `onboarding-form.tsx`**

Same pattern; preserve the channel-name and first-link field labels.

- [ ] **Step 4: Rewrite `src/app/(site)/page.tsx`**

Replace `Box`/`Button`/`Typography` with Tailwind equivalents; no behavior to preserve beyond the visible copy and link targets.

- [ ] **Step 5: Manual smoke check**

Run: `pnpm dev`, visit `/login`, `/register`, `/onboarding`, `/`
Expected: forms render, submit, and show inline errors as before.

- [ ] **Step 6: Run affected e2e spec**

Run: `pnpm exec playwright test tests/e2e/auth.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(site)/(auth)" "src/app/(site)/onboarding" "src/app/(site)/page.tsx"
git commit -m "feat: migrate auth, onboarding, and home pages to daisyUI"
```

---

## Task 4: Public tip flow + mock checkout

**Files:**
- Modify: `src/app/(site)/[slug]/TipForm.tsx`
- Modify: `src/app/(site)/[slug]/page.tsx`
- Modify: `src/app/(site)/[slug]/result/page.tsx`
- Modify: `src/app/(site)/[slug]/result/ResultPoller.tsx`
- Modify: `src/app/(site)/mock/checkout/[sessionId]/page.tsx`
- Modify: `src/app/(site)/mock/checkout/[sessionId]/CheckoutActions.tsx`

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces: nothing consumed later.

- [ ] **Step 1: Rewrite `TipForm.tsx`**

Replace `Card`/`Box`/`Stack`/`TextField`/`Button`/`Alert` as in Task 3's pattern. Replace the `Checkbox` + `FormControlLabel` "remember me" pairing with a daisyUI `<label className="label cursor-pointer gap-2"><input type="checkbox" className="checkbox" />...</label>`, keeping the same visible label text and `checked`/`onChange` wiring to `localStorage` untouched.

- [ ] **Step 2: Rewrite `[slug]/page.tsx`**

Replace `Alert`/`Box`/`Button`/`Card`/`Container`/`Stack`/`Typography`; preserve the "ยังไม่เปิดรับโดเนท" (not-yet-active) message path.

- [ ] **Step 3: Rewrite `result/ResultPoller.tsx`**

Replace `CircularProgress` with a daisyUI `<span className="loading loading-spinner" />`; keep the polling logic (`useState`/`useEffect`/interval) untouched — only the JSX/markup changes.

- [ ] **Step 4: Rewrite `result/page.tsx`**

Replace the `Container` wrapper with a Tailwind equivalent.

- [ ] **Step 5: Rewrite mock checkout page + actions**

Replace `Box`/`Card`/`Chip`/`Container`/`Stack`/`Typography` in `page.tsx` and `Alert`/`Button`/`Stack` in `CheckoutActions.tsx`; keep the "จำลองสำเร็จ" / "จำลองไม่สำเร็จ" button text exact.

- [ ] **Step 6: Manual smoke check**

Run: `pnpm dev` with `MOCK_MODE=true`, visit a streamer's `/{slug}` page, submit a donation, complete mock checkout, land on `/{slug}/result`
Expected: full flow renders and behaves as before.

- [ ] **Step 7: Run affected e2e specs**

Run: `pnpm exec playwright test tests/e2e/donate.spec.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(site)/[slug]" "src/app/(site)/mock"
git commit -m "feat: migrate public tip flow and mock checkout to daisyUI"
```

---

## Task 5: Dashboard settings pages (profile, tip page) + shared toast primitive

**Files:**
- Create: `src/components/ui/toast.tsx`
- Modify: `src/app/(site)/layout.tsx` (mount `ToastProvider`)
- Modify: `src/app/(site)/dashboard/profile/profile-client.tsx`
- Modify: `src/app/(site)/dashboard/tip-page/tip-page-client.tsx`

**Interfaces:**
- Produces: `src/components/ui/toast.tsx` exports `ToastProvider({ children })` and `useToast(): { show: (message: string, variant?: "success" | "error") => void }`. Renders a fixed daisyUI `toast` stack of `alert alert-{variant}` items that auto-dismiss after ~4s. Later tasks (6, 7, 8) import `useToast` from this file — do not redefine it.
- Consumes: nothing new.

- [ ] **Step 1: Write `src/components/ui/toast.tsx`**

Implement `ToastProvider` (holds a list of `{ id, message, variant }` in state, exposes `show` via context, renders the stack) and `useToast()` (reads the context, throws if used outside `ToastProvider`).

- [ ] **Step 2: Mount `ToastProvider` in the root layout**

In `src/app/(site)/layout.tsx`, wrap `<Providers>{children}</Providers>` as `<Providers><ToastProvider>{children}</ToastProvider></Providers>` (MUI `Providers` stays until Task 9).

- [ ] **Step 3: Rewrite `profile-client.tsx`**

Replace `Card`/`Chip`/`IconButton`/`Snackbar`/`Stack`/`TextField`/`Typography`/`Link`/`Alert` with daisyUI equivalents (`badge` for `Chip`, `btn btn-ghost btn-square btn-sm` for `IconButton`); replace the `Snackbar` success/error notifications with `useToast().show(...)` calls at the same call sites.

- [ ] **Step 4: Rewrite `tip-page-client.tsx`**

Same pattern; preserve the "Slug" field label and the "แสดง URL" reveal-button text exactly (asserted in `tests/e2e/settings.spec.ts`).

- [ ] **Step 5: Manual smoke check**

Run: `pnpm dev`, edit profile and tip-page settings, confirm the toast appears on save
Expected: matches prior Snackbar behavior visually (transient, auto-dismissing).

- [ ] **Step 6: Run affected e2e spec**

Run: `pnpm exec playwright test tests/e2e/settings.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/toast.tsx "src/app/(site)/layout.tsx" "src/app/(site)/dashboard/profile" "src/app/(site)/dashboard/tip-page"
git commit -m "feat: add toast primitive, migrate profile and tip-page settings to daisyUI"
```

---

## Task 6: Alert settings (most complex page) + ColorField + shared modal primitive

**Files:**
- Create: `src/components/ui/modal.tsx`
- Modify: `src/components/ColorField.tsx`
- Modify: `src/app/(site)/dashboard/overlays/alert/AlertSettingsForm.tsx`

**Interfaces:**
- Consumes: `useToast` from `src/components/ui/toast.tsx` (Task 5).
- Produces: `src/components/ui/modal.tsx` exports `Modal({ open, title, children, onClose }: { open: boolean; title: string; children: React.ReactNode; onClose: () => void })`, a thin wrapper around a daisyUI `<dialog className="modal">` (using the native `<dialog>` element's `showModal()`/`close()` via a `ref` + `useEffect` keyed on `open`, which preserves `role="dialog"` for free). Task 8 imports this — do not redefine it.
- Produces: `ColorField` keeps its existing props signature (read the current file's prop types before editing) — only the internals change to Tailwind/daisyUI, and the hex `<input>`'s accessible name stays exactly `"สีข้อความ"` per Review Focus.

- [ ] **Step 1: Write `src/components/ui/modal.tsx`**

Implement as described in Interfaces; the confirm/cancel buttons are left as `children` (each call site supplies its own button labels, e.g. "ยืนยันรีเซ็ต" / cancel), so this component only owns open/close plumbing and the `<dialog>` chrome.

- [ ] **Step 2: Rewrite `ColorField.tsx`**

Replace the MUI `TextField` + native `<input type="color">` pairing with a daisyUI `input` (`type="text"`, keeping hex validation logic untouched) plus the native color-swatch input, both inside one `label` group — keep the text input's `aria-label`/label text exactly `"สีข้อความ"` and make sure the color swatch has a *different* accessible name so `exact: true` matching still resolves to one element.

- [ ] **Step 3: Rewrite `AlertSettingsForm.tsx` — layout and simple fields**

Replace `Card`/`Box`/`Stack`/`TextField`/`Typography`/`Alert`/`IconButton`/`InputAdornment`/`Iconify` with daisyUI/Tailwind + `lucide-react` equivalents, keeping every field label text unchanged.

- [ ] **Step 4: Replace the three `TextField select` + `MenuItem` dropdowns**

Convert each to a native `<select className="select">` with `<option>` children carrying the same values/labels as the current `MenuItem`s (read the current option lists before converting — copy them verbatim).

- [ ] **Step 5: Replace the `Slider`**

Convert to `<input type="range" className="range" min=... max=... step=...>` using the same min/max/step/default values as the current `Slider` props.

- [ ] **Step 6: Replace the reset-URL confirm `Dialog` with the shared `Modal`**

Use `Modal` from Step 1; keep the confirmation button's exact text `"ยืนยันรีเซ็ต"` and the cancel button's current text.

- [ ] **Step 7: Replace `Snackbar` with `useToast`**

Same pattern as Task 5 Step 3.

- [ ] **Step 8: Manual smoke check for the un-covered widgets (Review Focus)**

Run: `pnpm dev`, open `/dashboard/overlays/alert`, exercise all three `<select>` dropdowns and the range slider, save, and confirm the saved values round-trip correctly on reload
Expected: behavior matches the pre-migration MUI form (no e2e spec locks this in, so this manual pass is the only check).

- [ ] **Step 9: Run affected e2e specs**

Run: `pnpm exec playwright test tests/e2e/alert-settings.spec.ts tests/e2e/overlay.spec.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/components/ui/modal.tsx src/components/ColorField.tsx "src/app/(site)/dashboard/overlays"
git commit -m "feat: migrate alert settings form and ColorField to daisyUI"
```

---

## Task 7: Transactions page

**Files:**
- Modify: `src/app/(site)/dashboard/transactions/page.tsx`
- Modify: `src/app/(site)/dashboard/transactions/ReplayButton.tsx`

**Interfaces:**
- Consumes: `useToast` from `src/components/ui/toast.tsx` (Task 5).

- [ ] **Step 1: Rewrite `page.tsx`**

Replace `Card`/`Link`/`Stack`/`Typography` and the MUI `Table`/`TableBody`/`TableCell`/`TableContainer`/`TableHead`/`TableRow` set with a plain semantic `<table>` styled via daisyUI's `table` class — Playwright's `getByRole("row", ...)` / `getByRole("button", { name: "Alert ซ้ำ" })` selectors rely on real `<table>/<tr>/<td>` semantics, which this preserves.

- [ ] **Step 2: Rewrite `ReplayButton.tsx`**

Replace `Button`/`Snackbar` with `btn` + `useToast().show(...)`, keeping the "Alert ซ้ำ" button text exact.

- [ ] **Step 3: Manual smoke check**

Run: `pnpm dev`, open `/dashboard/transactions`, click "Alert ซ้ำ" on a row
Expected: toast confirms the replay, table pagination still works.

- [ ] **Step 4: Run affected e2e spec**

Run: `pnpm exec playwright test tests/e2e/transactions.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(site)/dashboard/transactions"
git commit -m "feat: migrate transactions page to daisyUI"
```

---

## Task 8: Admin pages (invites, users)

**Files:**
- Modify: `src/app/(site)/admin/invites/invites-client.tsx`
- Modify: `src/app/(site)/admin/invites/[code]/page.tsx`
- Modify: `src/app/(site)/admin/users/page.tsx`

**Interfaces:**
- Consumes: `useToast` from Task 5, `Modal` from Task 6.

- [ ] **Step 1: Rewrite `invites-client.tsx` — table and layout**

Replace `Card`/`Box`/`Stack`/`Typography`/`Link`/`IconButton` and the MUI `Table` set with the same semantic-`<table>` + daisyUI `table` pattern as Task 7.

- [ ] **Step 2: Replace the create-code `Dialog` with `Modal`**

Use `Modal` from Task 6; the dialog must keep `role="dialog"` (the `Modal` component already guarantees this via the native `<dialog>` element).

- [ ] **Step 3: Replace `RadioGroup`/`Radio` (generated vs. custom code)**

Convert to daisyUI `radio` inputs grouped by `name`; keep the exact label text `"กำหนดเอง"` for the custom-code option (asserted by e2e) and whatever the generated-code option's current label is.

- [ ] **Step 4: Replace the `Switch` (enable/disable) and remaining `TextField`s**

Convert `Switch` to a daisyUI `toggle` input; convert `TextField`s ("โค้ด", "โควตา", and any others) to daisyUI `input` + `label`, keeping label text exact.

- [ ] **Step 5: Replace `Snackbar` with `useToast`**

Same pattern as prior tasks.

- [ ] **Step 6: Rewrite `admin/invites/[code]/page.tsx` and `admin/users/page.tsx`**

Same `Card`/`Stack`/`Typography`/table-to-daisyUI pattern as Task 7 Step 1 (both are read-only server-rendered tables, no forms).

- [ ] **Step 7: Manual smoke check for the switch (Review Focus)**

Run: `pnpm dev` as an admin user, open `/admin/invites`, toggle an invite code's enabled state
Expected: state persists and reflects correctly (no e2e coverage for this control).

- [ ] **Step 8: Run affected e2e spec**

Run: `pnpm exec playwright test tests/e2e/admin.spec.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(site)/admin"
git commit -m "feat: migrate admin invite and user pages to daisyUI"
```

---

## Task 9: Cleanup — remove MUI/Minimal, finalize dark mode, update design doc

**Files:**
- Delete: `src/ui/minimal/**` (remaining: `theme/**`, `components/iconify/**`, `components/scrollbar/**`, and any leftover files)
- Modify: `package.json` (remove `@mui/material`, `@mui/material-nextjs`, `@emotion/react`, `@emotion/styled`, `minimal-shared`, `simplebar-react`, `@iconify/react`)
- Modify or Delete: `src/ui/providers.tsx` (remove MUI `ThemeProvider`/`AppRouterCacheProvider`; if nothing remains, delete the file and drop its import from `src/app/(site)/layout.tsx`)
- Modify: `docs/superpowers/specs/2026-09-28-tippaw-design.md` (replace §11 to describe the daisyUI stack, referencing this plan's spec)

**Interfaces:**
- Consumes: everything produced by Tasks 1–8. No further consumers.

- [ ] **Step 1: Confirm no remaining MUI imports**

Run: `grep -rl "@mui/material\|@emotion\|minimal-shared\|simplebar-react\|@iconify/react" src`
Expected: no matches outside `src/ui/minimal/**` (if any app file still matches, migrate it before continuing — a task was missed).

- [ ] **Step 2: Delete `src/ui/minimal/**`**

Delete the entire directory.

- [ ] **Step 3: Simplify or delete `src/ui/providers.tsx`**

If the file's only remaining job was the MUI theme, delete it and update `src/app/(site)/layout.tsx` to drop the `<Providers>` wrapper (keeping `<ToastProvider>` from Task 5 mounted directly).

- [ ] **Step 4: Remove the MUI/Emotion/Minimal dependencies**

Run: `pnpm remove @mui/material @mui/material-nextjs @emotion/react @emotion/styled minimal-shared simplebar-react @iconify/react`
Expected: `package.json`/lockfile updated, no other package still requires them.

- [ ] **Step 5: Full build and test suite**

Run: `pnpm build && pnpm test && pnpm exec playwright test`
Expected: build succeeds (Cloudflare/OpenNext packaging included); all unit, integration, and e2e specs (including `tests/e2e/golden-path.spec.ts`, which exercises the full cross-role journey) PASS.

- [ ] **Step 6: Update the main design doc**

Replace §11 ("UI & Design system") of `docs/superpowers/specs/2026-09-28-tippaw-design.md` with a short section describing the Tailwind + daisyUI stack, the `tippaw`/`tippaw-dark` themes, and a pointer to `docs/superpowers/specs/2026-09-29-daisyui-migration-design.md` for full detail.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove MUI/Minimal, finalize daisyUI migration, update design doc"
```
