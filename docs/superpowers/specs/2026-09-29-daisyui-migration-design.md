# TipPaw — Migrate UI stack from MUI/Minimal to Tailwind + daisyUI

- วันที่: 2026-09-29
- สถานะ: รอตรวจทาน
- ขอบเขตเอกสาร: แทนที่ข้อ 11 ("UI & Design system") ของ [2026-09-28-tippaw-design.md](2026-09-28-tippaw-design.md) — เอกสารอื่นในสเปกหลักไม่เปลี่ยน

## 1. เหตุผลและเป้าหมาย

สเปกเดิมเลือก Minimal ฟรี (MIT) + MUI เพราะ "template สำเร็จรูป, ฟรี" — เจ้าของโปรเจกต์ต้องการเปลี่ยนไปใช้ [daisyUI](https://daisyui.com/) (Tailwind CSS plugin) แทน เพื่อเลี่ยงความสับสนเรื่องเวอร์ชันเสียเงินของ Minimal และลดน้ำหนักของ dependency (MUI + Emotion + minimal-shared + simplebar + iconify) ที่ตอนนี้ใช้เฉพาะกับส่วนที่ port มาเอง

**เป้าหมาย:** หน้าตา/สี/ฟอนต์เดิมยังคงอยู่ (palette ชมพู-ม่วง-คราม, ฟอนต์ Prompt) แต่เปลี่ยนเทคโนโลยีเบื้องหลังทั้งหมดเป็น Tailwind CSS v4 + daisyUI, ลบ MUI/Minimal ออกจากโปรเจกต์ทั้งหมด, และเพิ่ม dark mode ซึ่งเดิมอยู่นอกขอบเขต MVP (ตอนนี้ทำได้ง่ายด้วย daisyUI theme)

**ไม่ใช่เป้าหมาย:** เปลี่ยน layout/UX ของหน้าใดๆ, เพิ่มหน้าใหม่, แก้ business logic — เป็นการสลับเทคโนโลยี UI เท่านั้น

## 2. ขอบเขตปัจจุบันที่ต้อง migrate

ไฟล์ที่ import `@mui/material` โดยตรง (นอกเหนือจาก `src/ui/minimal`):

```
src/app/(site)/(auth)/login/login-form.tsx
src/app/(site)/(auth)/register/register-form.tsx
src/app/(site)/[slug]/TipForm.tsx
src/app/(site)/[slug]/page.tsx
src/app/(site)/[slug]/result/ResultPoller.tsx
src/app/(site)/[slug]/result/page.tsx
src/app/(site)/admin/invites/[code]/page.tsx
src/app/(site)/admin/invites/invites-client.tsx
src/app/(site)/admin/users/page.tsx
src/app/(site)/dashboard/overlays/alert/AlertSettingsForm.tsx
src/app/(site)/dashboard/profile/profile-client.tsx
src/app/(site)/dashboard/tip-page/tip-page-client.tsx
src/app/(site)/dashboard/transactions/ReplayButton.tsx
src/app/(site)/dashboard/transactions/page.tsx
src/app/(site)/mock/checkout/[sessionId]/CheckoutActions.tsx
src/app/(site)/mock/checkout/[sessionId]/page.tsx
src/app/(site)/onboarding/onboarding-form.tsx
src/app/(site)/page.tsx
src/components/ColorField.tsx
```

Shared layout/theme ที่ port มาจาก Minimal (`src/ui/minimal/**`, ~20 ไฟล์: `theme/`, `layouts/core`, `layouts/dashboard`, `components/{iconify,logo,scrollbar}`) และ `src/ui/providers.tsx`

Dependencies ที่จะถอดออก: `@mui/material`, `@mui/material-nextjs`, `@emotion/react`, `@emotion/styled`, `minimal-shared`, `simplebar-react`, `@iconify/react` — ทั้งหมดใช้เฉพาะใน `src/ui/minimal/**` เท่านั้น ยืนยันแล้วว่าไม่มีที่อื่นอ้างอิง

**สิ่งที่ไม่แตะ:** `src/app/overlay/**` (ใช้ CSS ล้วนอยู่แล้วตามสเปกเดิม ข้อ 11 — "Overlay ไม่ใช้ MUI")

## 3. Stack ใหม่

| เรื่อง | เดิม | ใหม่ |
|---|---|---|
| CSS framework | MUI (CSS-in-JS ผ่าน Emotion) | Tailwind CSS v4 (`@tailwindcss/postcss`) |
| Component library | Minimal ฟรี (port เอง) + MUI components | daisyUI (Tailwind plugin) v5 — ใช้ class ตรงๆ ไม่ port component เพิ่ม |
| Icon | `@iconify/react` (ผ่าน wrapper `Iconify`) | [`lucide-react`](https://lucide.dev/) (MIT, tree-shakeable, ใช้ตรงเป็น React component) |
| Custom scrollbar | `simplebar-react` | scrollbar เบราว์เซอร์ปกติ (Tailwind `overflow-auto`) — ตัด ไม่จำเป็นสำหรับ MVP |
| Theme/palette | MUI `createTheme` (`src/ui/minimal/theme/**`) | daisyUI custom theme ผ่าน CSS `@plugin "daisyui/theme"` ใน `src/app/globals.css` |
| Font | `next/font/google` (Prompt) → MUI `typography.fontFamily` | เหมือนเดิมแต่ผูกกับ Tailwind ผ่าน `@theme { --font-sans: ... }` แทน |
| Dark mode | ไม่มี (นอกขอบเขต MVP เดิม) | daisyUI 2 theme (`tippaw` / `tippaw-dark`) สลับด้วย `data-theme` บน `<html>`, ปุ่ม toggle ใน dashboard header, จำค่าไว้ใน `localStorage` |

## 4. Theme mapping (คงค่าเดิมจากสเปกหลัก ข้อ 11)

```css
/* src/app/globals.css */
@import "tailwindcss";
@plugin "daisyui" {
  themes: tippaw --default, tippaw-dark --prefersdark;
}

@plugin "daisyui/theme" {
  name: "tippaw";
  default: true;
  color-scheme: light;
  --color-primary: #8B639B;         /* primary.main */
  --color-primary-content: #FFFFFF;
  --color-secondary: #F8B2B2;       /* secondary.main */
  --color-secondary-content: #403D88; /* ห้ามใช้ตัวขาวบน secondary — ตามสเปกหลัก */
  --color-accent: #403D88;          /* primary.dark เดิม ใช้เป็น accent */
  --color-neutral: #1C252E;
  --color-base-100: #FFFFFF;
  --color-base-200: #F4F6F8;
  --color-base-300: #DFE3E8;
  --color-info: #00B8D9;
  --color-success: #22C55E;
  --color-warning: #FFAB00;
  --color-error: #FF5630;
  --radius-box: 0.75rem;
  --radius-field: 0.5rem;
}

@plugin "daisyui/theme" {
  name: "tippaw-dark";
  color-scheme: dark;
  --color-primary: #AF719D;         /* primary.light เดิม — คมชัดขึ้นบนพื้นมืด */
  --color-primary-content: #1C252E;
  --color-secondary: #F8B2B2;
  --color-secondary-content: #2A2860;
  --color-accent: #E7D6E3;
  --color-neutral: #F4F6F8;
  --color-base-100: #1C252E;
  --color-base-200: #141A21;
  --color-base-300: #2A323C;
  --color-info: #61F3F3;
  --color-success: #77ED8B;
  --color-warning: #FFD666;
  --color-error: #FFAC82;
}

@theme {
  --font-sans: var(--font-prompt);  /* next/font/google Prompt, ผูกไว้ที่ layout.tsx เหมือนเดิม */
}
```

สี success/warning/error/info/grey อื่นๆ (ที่ไม่ระบุ) ใช้ค่า default ของ daisyUI แทนของ Minimal เดิม — ยอมรับความต่างเล็กน้อยเพราะไม่ใช่ brand color

## 5. Shared layout ใหม่ (แทน `src/ui/minimal/layouts/dashboard/*`)

Component เดียวที่ต้องสร้างใหม่และใช้ร่วมกันทุกหน้า `/dashboard/*`, `/admin/*`:

- `src/components/layout/dashboard-shell.tsx` — daisyUI `drawer` (side nav แบบ responsive: เป็น drawer บนจอเล็ก, static บนจอใหญ่)
- `src/components/layout/dashboard-nav.tsx` — daisyUI `menu` แสดงลิงก์ (เดิม `nav.tsx`) — เมนูรายการเหมือนเดิมทุกอย่าง เปลี่ยนแค่ class
- `src/components/layout/dashboard-header.tsx` — daisyUI `navbar` + `dropdown` (แทน `account-popover.tsx`) + ปุ่ม dark-mode toggle
- `src/components/theme-toggle.tsx` — client component อ่าน/เขียน `localStorage` + toggle `data-theme` (ไม่ผูกกับ session/DB — เป็น preference ฝั่งเบราว์เซอร์ล้วน ตามที่สเปกหลักใช้ `localStorage` กับ "จดจำชื่อ" ผู้บริจาคอยู่แล้ว)

`src/ui/providers.tsx` เหลือแค่ตั้งค่า theme เริ่มต้นจาก `localStorage`/`prefers-color-scheme` ก่อน hydrate (script เล็กๆ กัน flash of wrong theme) — ไม่มี provider ของ MUI อีกต่อไป, อาจไม่ต้องมีไฟล์นี้เลยถ้าใส่ script ตรงใน `layout.tsx` ได้

## 6. ลำดับการ migrate

แต่ละขั้นลบโค้ด MUI ของส่วนนั้นทันทีหลังแก้เสร็จ (ไม่ปล่อยให้สองระบบอยู่คู่กันนาน):

1. ติดตั้ง Tailwind v4 + daisyUI, เขียน `globals.css` ตามข้อ 4, ตั้ง Prompt font ผ่าน Tailwind
2. สร้าง dashboard shell/nav/header/theme-toggle ใหม่ (ข้อ 5)
3. Auth: `login-form.tsx`, `register-form.tsx`, `onboarding-form.tsx`
4. Dashboard: `profile-client.tsx`, `tip-page-client.tsx`, `transactions/page.tsx` + `ReplayButton.tsx`, `overlays/alert/AlertSettingsForm.tsx`, `components/ColorField.tsx`
5. Admin: `admin/invites/invites-client.tsx` + `admin/invites/[code]/page.tsx`, `admin/users/page.tsx`
6. Public: `[slug]/page.tsx`, `TipForm.tsx`, `[slug]/result/page.tsx` + `ResultPoller.tsx`, root `page.tsx` (ถ้ามี MUI)
7. Mock: `mock/checkout/[sessionId]/page.tsx` + `CheckoutActions.tsx`
8. ลบ `src/ui/minimal/**` ทั้งโฟลเดอร์, ถอด `@mui/*`, `@emotion/*`, `minimal-shared`, `simplebar-react`, `@iconify/react` ออกจาก `package.json`, เพิ่ม `tailwindcss`, `@tailwindcss/postcss`, `daisyui`, `lucide-react`
9. อัปเดตข้อ 11 ของ [2026-09-28-tippaw-design.md](2026-09-28-tippaw-design.md) ให้ตรงกับสเปกนี้ (แทนที่ทั้ง section, อ้างอิงเอกสารนี้)

## 7. ผลกระทบต่อการทดสอบ

- **E2E (Playwright):** เลือก element ส่วนใหญ่ผ่าน role/label/text (`getByRole`, `getByLabel`) ซึ่งไม่ผูกกับ MUI markup โดยตรง — คาดว่าผ่านต่อได้เกือบทั้งหมด ยกเว้นจุดที่พึ่งพา MUI-specific behavior เช่น `Select` ที่ render เป็น listbox popup (daisyUI ใช้ `<select>` ปกติหรือ `dropdown` — ต้องตรวจ selector เป็นจุดๆ)
- รัน e2e spec ที่เกี่ยวข้องกับแต่ละ route group หลัง migrate ทันที (ไม่รอจบทั้งหมด) ตามลำดับข้อ 6
- **Unit/Integration:** ไม่เกี่ยวกับ UI component โดยตรง (ทดสอบ business logic/API) — ไม่คาดว่าได้รับผลกระทบ

## 8. Risk / ข้อควรระวัง

- Tailwind v4 + daisyUI v5 ใช้ CSS-first config (ไม่มี `tailwind.config.js` แบบเดิม) — ต้องตรวจว่า `@opennextjs/cloudflare` build ผ่าน PostCSS ได้ปกติบน Cloudflare Workers
- Dark mode เป็นของใหม่ที่ไม่มีในสเปกเดิม — ถ้าพบว่าสี any component (เช่น badge สถานะ, chart) อ่านยากในโหมดมืด ให้ปรับทีละจุดระหว่าง migrate ไม่ต้อง block การ merge
- `next/font/google` (Prompt) ยังใช้ mechanism เดิม เปลี่ยนแค่จุดที่ผูกเข้ากับ CSS variable
