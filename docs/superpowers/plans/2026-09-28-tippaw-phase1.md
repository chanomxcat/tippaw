# TipPaw เฟส 1 (Vertical slice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สตรีมเมอร์สมัคร (ด้วย invite code) → ตั้งหน้า Tip → ใส่ Alert overlay URL ใน OBS → ผู้ชมโดเนทผ่าน mock payment → alert เด้งใน overlay ทันที และรายการขึ้นในหน้าธุรกรรม

**Architecture:** Next.js App Router ตัวเดียว deploy เป็น Cloudflare Worker ผ่าน `@opennextjs/cloudflare`; `worker.ts` เป็น custom entry ที่ดัก `/api/realtime/*` ส่งเข้า Durable Object `StreamerRoom` (1 ต่อสตรีมเมอร์) ส่วน request อื่นส่งให้ OpenNext; ข้อมูลอยู่ใน D1 ผ่าน Drizzle; Stripe/Streamlabs เป็น adapter ที่เฟสนี้ใช้ mock

**Tech Stack:** pnpm, TypeScript (strict), Next.js (App Router), `@opennextjs/cloudflare`, wrangler, D1 + drizzle-orm/drizzle-kit, Better Auth (username, admin, genericOAuth plugins + Google), MUI + Minimal free (port), Zod, Vitest + `@cloudflare/vitest-pool-workers`, Playwright

**Spec:** `docs/superpowers/specs/2026-09-28-tippaw-design.md`

## Global Constraints

- Next.js: ใช้เวอร์ชันล่าสุดที่ `@opennextjs/cloudflare` รองรับ ณ วันติดตั้ง; `compatibility_flags: ["nodejs_compat"]`, `compatibility_date` = วันติดตั้ง
- ห้ามใช้ `next-on-pages` และห้าม `export const runtime = 'edge'`
- เงินเก็บเป็น **สตางค์ (INTEGER)** เสมอ; UI รับยอดเป็นบาทจำนวนเต็ม; ค่าเริ่มต้น `MIN_DONATION_THB=10`, `MAX_DONATION_THB=10000`
- ชื่อผู้โดเนท ≤ 50, ข้อความ ≤ 200 **ตัวอักษรนับเป็น code point** (`[...s].length`) — ไม่ใช่ `.length`
- slug: `^[a-z0-9-]{3,30}$`, แปลงเป็นตัวพิมพ์เล็ก+trim ก่อนตรวจ, ห้ามอยู่ในรายการคำจอง (Task 3)
- Invite code: สุ่ม 8 ตัวจาก `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`; พิมพ์เอง `^[A-Z0-9-]{4,32}$` หลัง `trim().toUpperCase()`
- Overlay token: 32 bytes สุ่ม → base64url (43 ตัว)
- URL รูป/เสียง/ลิงก์ที่ผู้ใช้กรอก: ต้องขึ้นต้น `https://` (เสียงอนุญาต `preset:<key>` ด้วย)
- ID ทุกตาราง: `crypto.randomUUID()`; เวลา: INTEGER unix ms (`integer({ mode: 'timestamp_ms' })`)
- Service ใน `src/server/**` **ห้ามเรียก `getCloudflareContext()` เอง** — รับ `deps: Deps` เป็นพารามิเตอร์ (ให้ทดสอบใน vitest-pool-workers ได้); มีแค่ `src/server/env.ts#getDeps()` ที่อ่าน context
- **ห้าม Worker fetch HTTP กลับเข้าหาตัวเอง** (production ใช้ไม่ได้) — mock webhook และ mock Streamlabs token/userinfo ต้องเรียกฟังก์ชันตรงใน process
- `/mock/*` และ `/api/mock/*` ตอบ 404 เมื่อ `MOCK_MODE !== 'true'`
- API route: ตรวจ session → ตรวจ input ด้วย Zod → เรียก service → response JSON `{ error: string }` เมื่อผิดพลาด (400 input, 401 ไม่ล็อกอิน, 403 สิทธิ์ไม่พอ, 404, 409 ชน, 429 rate limit)
- UI copy เป็นภาษาไทย; ฟอนต์ Prompt; palette ตามสเปกข้อ 11; overlay ไม่ใช้ MUI
- Commit message แบบ conventional (`feat:`, `test:`, `chore:`) ลงท้ายด้วย `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

1. **ชื่อ/ข้อความภาษาไทยที่มีสระ/วรรณยุกต์** — ชื่อไทย 50 ตัวอักษร (code point) ต้องผ่าน, 51 ต้องไม่ผ่าน; emoji นับตาม code point → เทสใน Task 3 (`donationInputSchema`)
2. **Webhook มาช้าหรือซ้ำหลัง donation จบแล้ว** (ผู้ชมกด "จำลองสำเร็จ" สองครั้ง หรือกดสำเร็จแล้วกดไม่สำเร็จ) — ต้องไม่เปลี่ยนสถานะซ้ำและไม่ publish alert ครั้งที่สอง → เทสใน Task 7
3. **slug ตัวพิมพ์ใหญ่** — ผู้ใช้ตั้ง `MyChannel` ต้องได้ `mychannel`; เปิด `/MyChannel` ต้องเจอหน้าเดียวกัน → เทสใน Task 3 และ Task 14
4. **Worker เรียกตัวเองใน production** — mock checkout และ mock Streamlabs ต้องไม่ `fetch` URL ของตัวเอง → เทสใน Task 9 (genericOAuth ใช้ `getToken`/`getUserInfo` ใน process) และ Task 14 (mock checkout action เรียก `handleWebhookRequest` ตรง)
5. **Overlay เปิดค้างใน OBS ข้าม deploy / DO ถูก evict** — socket หลุดแล้วต้องต่อใหม่เองด้วย backoff 1s→30s และรีเซ็ตเมื่อเชื่อมสำเร็จ → เทสใน Task 17

---

## File Structure (เฟส 1)

```
worker.ts                              custom entry: realtime route → DO, ที่เหลือ → OpenNext; export StreamerRoom
wrangler.jsonc                         D1 (DB), DO (STREAMER_ROOM), ratelimits, vars
open-next.config.ts
next.config.ts
drizzle.config.ts
drizzle/                               migrations (drizzle-kit generate)
vitest.config.ts                       projects: unit (node) + integration (workers pool)
playwright.config.ts
scripts/admin-bootstrap-invite.ts      สร้าง invite code แรกผ่าน wrangler d1 execute
scripts/admin-promote.ts               ตั้ง role admin
scripts/generate-preset-sounds.ts      สร้าง WAV preset 3 เสียง
public/presets/sounds/{chime,coin,pop}.wav
src/
  worker/realtime-route.ts             handleRealtimeRequest(request, env)
  server/
    env.ts                             AppEnv type, Deps type, getDeps()
    http.ts                            jsonError(), parseJson(schema, req), clientIp(req)
    db/schema.ts                       ตาราง TipPaw
    db/auth-schema.ts                  ตาราง Better Auth (generate จาก CLI)
    db/client.ts                       createDb(d1)
    lib/money.ts                       thbToSatang, formatThb
    lib/text.ts                        charLength
    lib/slug.ts                        normalizeSlug, validateSlug, RESERVED_SLUGS
    lib/random.ts                      randomToken, randomInviteCode
    auth/pbkdf2.ts                     hashPassword, verifyPassword
    auth/auth.ts                       createAuth(env, db)
    auth/session.ts                    requireSession, requireOnboarded, requireAdmin
    auth/mock-streamlabs.ts            buildAuthorizeRedirect, exchangeCode, userInfo
    invites/invites.ts                 checkInvite, redeemInvite, createInvite, setInviteDisabled, listInvites, listInviteUsers
    onboarding/onboarding.ts           getOnboardingState, completeOnboarding
    profile/profile.ts                 updateSlug, connectPayout, getProfile
    tip-page/tip-page.ts               getTipPage, updateTipPage, getPublicTipPage + schemas
    payments/types.ts                  PaymentProvider, PaymentEvent, CreateCheckoutInput
    payments/mock.ts                   createMockProvider, signMockWebhook, buildMockWebhookRequest
    payments/stripe.ts                 createStripeProvider (stub)
    payments/index.ts                  getPaymentProvider(env)
    alerts/schemas.ts                  alertVariantSchema, alertOverlaySettingsSchema, defaults
    alerts/select-variant.ts           selectVariant
    alerts/render-template.ts          renderTemplate
    alerts/build-event.ts              buildAlertEvent, resolveSoundUrl
    realtime/events.ts                 RealtimeEvent types
    realtime/streamer-room.ts          class StreamerRoom (DO)
    realtime/publish.ts                publish, disconnectToken
    overlays/overlays.ts               getOverlayByToken, getAlertOverlayConfig, updateAlertOverlay, resetOverlayToken
    donations/create-donation.ts       createDonation, donationInputSchema
    donations/handle-payment-event.ts  handlePaymentEvent, handleWebhookRequest
    donations/alerts.ts                replayAlert, sendTestAlert
    donations/queries.ts               listPaidDonations, getDonationStatus
  ui/minimal/                          theme/, layouts/, components/ (port) + LICENSE.md
  ui/providers.tsx                     AppRouterCacheProvider + ThemeProvider
  app/
    layout.tsx                         Prompt font + providers
    (auth)/login/page.tsx, (auth)/register/page.tsx
    onboarding/page.tsx
    dashboard/layout.tsx               requireOnboarded() + DashboardLayout
    dashboard/page.tsx                 redirect → /dashboard/transactions
    dashboard/profile/page.tsx
    dashboard/tip-page/page.tsx
    dashboard/transactions/page.tsx
    dashboard/overlays/alert/page.tsx
    admin/layout.tsx, admin/invites/page.tsx, admin/invites/[code]/page.tsx, admin/users/page.tsx
    [slug]/page.tsx, [slug]/result/page.tsx
    overlay/alert/[token]/page.tsx
    mock/checkout/[sessionId]/page.tsx + actions.ts
    mock/streamlabs/authorize/page.tsx
    api/auth/[...all]/route.ts
    api/register/route.ts
    api/onboarding/route.ts
    api/profile/route.ts, api/profile/payout/route.ts
    api/tip-page/route.ts
    api/donations/route.ts, api/donations/[id]/status/route.ts, api/donations/[id]/replay/route.ts
    api/overlays/alert/route.ts, api/overlays/alert/test/route.ts, api/overlays/alert/reset/route.ts
    api/webhooks/payment/route.ts
    api/admin/invites/route.ts, api/admin/invites/[code]/route.ts
  overlay/                             ฝั่ง client (ไม่ใช้ MUI)
    backoff.ts, queue.ts, ws-client.ts, AlertPlayer.tsx, alert.css
tests/
  unit/*.test.ts
  integration/setup.ts, integration/test-worker.ts, integration/*.test.ts
  e2e/global-setup.ts, e2e/*.spec.ts
```

---

### Task 1: Scaffold โปรเจกต์ + Cloudflare + ชุดทดสอบ

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `open-next.config.ts`, `wrangler.jsonc`, `worker.ts`, `vitest.config.ts`, `.dev.vars.example`, `.gitignore`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/server/env.ts`, `src/server/http.ts`, `src/worker/realtime-route.ts` (stub คืน 404), `tests/unit/smoke.test.ts`, `tests/integration/setup.ts`, `tests/integration/test-worker.ts`, `tests/integration/smoke.test.ts`

**Interfaces:**
- Produces:
  - `type AppEnv = { DB: D1Database; STREAMER_ROOM: DurableObjectNamespace<StreamerRoom>; DONATION_RATE_LIMITER: RateLimit; INVITE_RATE_LIMITER: RateLimit; BETTER_AUTH_SECRET: string; BETTER_AUTH_URL: string; GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string; STREAMLABS_CLIENT_ID?: string; STREAMLABS_CLIENT_SECRET?: string; STREAMLABS_AUTHORIZE_URL?: string; STREAMLABS_TOKEN_URL?: string; STREAMLABS_USERINFO_URL?: string; MOCK_MODE: string; PAYMENT_PROVIDER: 'mock' | 'stripe'; MOCK_WEBHOOK_SECRET: string; MIN_DONATION_THB: string; MAX_DONATION_THB: string }`
  - `type Deps = { env: AppEnv; db: Db; now: () => Date }` และ `getDeps(): Promise<Deps>` (ใช้ `getCloudflareContext({ async: true })`)
  - `jsonError(status: number, error: string): Response`, `parseJson<T>(schema: ZodType<T>, req: Request): Promise<{ ok: true; data: T } | { ok: false; response: Response }>`, `clientIp(req: Request): string` (อ่าน `cf-connecting-ip`, fallback `'local'`)
  - `isMockMode(env: AppEnv): boolean`

- [ ] **Step 1:** สร้างโปรเจกต์ด้วย `pnpm create cloudflare@latest tippaw --framework=next --platform=workers` (หรือ template OpenNext ปัจจุบัน) ในโฟลเดอร์ชั่วคราว แล้วย้ายไฟล์เข้า root repo (รักษา `docs/`); ตั้ง `tsconfig` strict + path alias `@/*` → `src/*`
- [ ] **Step 2:** เขียน `wrangler.jsonc`: `name: "tippaw"`, `main: "worker.ts"`, assets จาก `.open-next/assets`, `d1_databases: [{ binding: "DB", database_name: "tippaw-db", database_id: "<ใส่หลังสร้าง>", migrations_dir: "drizzle" }]`, `durable_objects.bindings: [{ name: "STREAMER_ROOM", class_name: "StreamerRoom" }]`, `migrations: [{ tag: "v1", new_sqlite_classes: ["StreamerRoom"] }]`, `ratelimits: [{ name: "DONATION_RATE_LIMITER", namespace_id: "1001", simple: { limit: 10, period: 60 } }, { name: "INVITE_RATE_LIMITER", namespace_id: "1002", simple: { limit: 10, period: 60 } }]`, `vars: { MOCK_MODE: "true", PAYMENT_PROVIDER: "mock", MIN_DONATION_THB: "10", MAX_DONATION_THB: "10000" }`; secrets อยู่ใน `.dev.vars` (ใส่ตัวอย่างใน `.dev.vars.example`)
- [ ] **Step 3:** เขียน `worker.ts`: `default.fetch(request, env, ctx)` — ถ้า pathname ขึ้นต้น `/api/realtime/` → `handleRealtimeRequest(request, env)`; ไม่งั้น → handler จาก `./.open-next/worker.js`; `export { StreamerRoom } from './src/server/realtime/streamer-room'` (ไฟล์ DO ชั่วคราวเป็น class ว่างที่ extends `DurableObject`, Task 6 เติม)
- [ ] **Step 4:** เขียน `vitest.config.ts` แบบ 2 projects: `unit` (environment node, `tests/unit/**`) และ `integration` (`defineWorkersProject`, `tests/integration/**`, `main: tests/integration/test-worker.ts`, miniflare: d1 `DB`, DO `STREAMER_ROOM` class `StreamerRoom`, ratelimit bindings, bindings ค่า vars/secrets สำหรับเทส เช่น `MOCK_WEBHOOK_SECRET: "test-secret"`); `tests/integration/setup.ts` ใช้ `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)` โดย config อ่านด้วย `readD1Migrations('drizzle')`; `test-worker.ts` export `StreamerRoom` และ `default.fetch` เรียก `handleRealtimeRequest`
- [ ] **Step 5:** เขียน `tests/unit/smoke.test.ts` (`expect(isMockMode({ MOCK_MODE: 'true' } as AppEnv)).toBe(true)` และ `'false'` → false) และ `tests/integration/smoke.test.ts` (`SELF.fetch('http://x/api/realtime/nope')` → status 404)
- [ ] **Step 6:** Run `pnpm vitest run` → Expected: PASS ทั้ง 2 projects (integration ยังไม่มี migration ให้ skip applyD1Migrations เมื่อว่าง)
- [ ] **Step 7:** Run `pnpm build && pnpm preview` (script `opennextjs-cloudflare build && opennextjs-cloudflare preview`) → เปิด `http://localhost:8787` เห็นหน้า `src/app/page.tsx` ("TipPaw")
- [ ] **Step 8:** Commit `chore: scaffold Next.js on Cloudflare Workers with test setup`

---

### Task 2: Database schema + migration

**Files:**
- Create: `drizzle.config.ts`, `src/server/db/schema.ts`, `src/server/db/auth-schema.ts`, `src/server/db/client.ts`, `drizzle/0000_*.sql`
- Test: `tests/integration/schema.test.ts`

**Interfaces:**
- Consumes: `AppEnv` (Task 1)
- Produces: `createDb(d1: D1Database): Db` (drizzle, `schema` รวมทั้งสองไฟล์); table exports: `user, session, account, verification, inviteCode, inviteRedemption, streamerProfile, tipPage, payoutAccount, donation, webhookEvent, overlay, alertVariant`

ตารางตามสเปกข้อ 4 **เฉพาะที่เฟส 1 ใช้** (ไม่สร้าง `gift_type`, `profanity_word`, `custom_profanity_word`); `donation.gift_type_id` เป็น TEXT NULL ไม่มี FK ในเฟสนี้ รายละเอียดคอลัมน์ที่สเปกไม่ได้ระบุ:
- `tip_page.links`: `text({ mode: 'json' }).$type<{ label: string; url: string }[]>().default([])`; `theme`, `banner_url`, `background_url`, `body_json` NULL ได้
- `overlay.settings`: `text({ mode: 'json' })`
- `alert_variant.tts_enabled`: integer boolean default false; `tts_voice` NULL
- `donation.provider_session_id` NULL ได้ (ก่อนได้ session) แต่ UNIQUE
- `user` ของ Better Auth ต้องมีคอลัมน์ `username`, `displayUsername`, `role`, `banned`, `banReason`, `banExpires` (username + admin plugin)

- [ ] **Step 1:** เขียน `tests/integration/schema.test.ts`: `it('rejects duplicate slug')` — insert user 2 คน + `streamerProfile` slug `abc` ซ้ำ → คาด throw `/UNIQUE/`; `it('rejects second overlay of same type per streamer')` → throw `/UNIQUE/`; `it('rejects duplicate provider_session_id')`
- [ ] **Step 2:** Run `pnpm vitest run --project integration schema` → Expected: FAIL (ไม่มีตาราง)
- [ ] **Step 3:** สร้าง `auth-schema.ts` ด้วย `pnpm dlx @better-auth/cli generate` (config ชั่วคราวที่มี username + admin plugin, adapter drizzle sqlite) แล้วเขียน `schema.ts`, `client.ts`, `drizzle.config.ts` (`dialect: 'sqlite'`, `out: 'drizzle'`); Run `pnpm drizzle-kit generate`
- [ ] **Step 4:** Run `pnpm vitest run --project integration schema` → Expected: PASS
- [ ] **Step 5:** Run `pnpm wrangler d1 migrations apply tippaw-db --local` → Expected: applied 1 migration
- [ ] **Step 6:** Commit `feat: add D1 schema and initial migration`

---

### Task 3: Utility ล้วน (money, text, slug, random) + donation input schema

**Files:**
- Create: `src/server/lib/money.ts`, `src/server/lib/text.ts`, `src/server/lib/slug.ts`, `src/server/lib/random.ts`
- Test: `tests/unit/money.test.ts`, `tests/unit/slug.test.ts`, `tests/unit/random.test.ts`, `tests/unit/text.test.ts`

**Interfaces:**
- Produces:
  - `thbToSatang(thb: number): number`, `formatThb(satang: number): string` (`th-TH`, ไม่มีทศนิยมเมื่อลงตัว, เช่น `123400` → `"1,234"`, `150` → `"1.50"`)
  - `charLength(s: string): number` (= `[...s].length`), `maxChars(n: number)` → Zod refinement helper: `z.string().trim().refine(s => charLength(s) <= n)`
  - `RESERVED_SLUGS: readonly string[]` = `['dashboard','login','register','onboarding','admin','overlay','api','mock','_next','assets','presets','settings','help','about','terms','privacy','tippaw','result','gift']`
  - `normalizeSlug(input: string): string` (trim + lower-case)
  - `validateSlug(input: string): { ok: true; slug: string } | { ok: false; reason: 'format' | 'reserved' }`
  - `randomToken(): string` (32 bytes base64url), `randomInviteCode(): string`, `normalizeInviteCode(input: string): string | null` (null ถ้าไม่ผ่าน regex)

- [ ] **Step 1:** เขียนเทส:
  - money: `thbToSatang(10) === 1000`; `formatThb(123400) === '1,234'`; `formatThb(150) === '1.50'`
  - text: `charLength('😀') === 1`; `charLength('น้ำ') === 3`
  - slug: `validateSlug('  MyChannel ')` → `{ ok: true, slug: 'mychannel' }`; `'ab'` → format; `'a_b-c'` → format; `'Dashboard'` → reserved; `'x'.repeat(31)` → format
  - random: `randomToken()` ยาว 43 และตรง `/^[A-Za-z0-9_-]+$/`; `randomInviteCode()` 1,000 ครั้ง ตรง `/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/`; `normalizeInviteCode(' vip-2026 ') === 'VIP-2026'`; `normalizeInviteCode('ab') === null`; `normalizeInviteCode('ไทย1234') === null`
- [ ] **Step 2:** Run `pnpm vitest run --project unit` → Expected: FAIL (module not found)
- [ ] **Step 3:** Implement ทั้ง 4 ไฟล์ (random ใช้ `crypto.getRandomValues`; invite code ใช้ rejection sampling ให้กระจายเท่ากัน)
- [ ] **Step 4:** Run `pnpm vitest run --project unit` → Expected: PASS
- [ ] **Step 5:** Commit `feat: add money, slug, text and random utilities`

---

### Task 4: Alert domain — schemas, selectVariant, renderTemplate, buildAlertEvent

**Files:**
- Create: `src/server/alerts/schemas.ts`, `src/server/alerts/select-variant.ts`, `src/server/alerts/render-template.ts`, `src/server/alerts/build-event.ts`, `src/server/realtime/events.ts`
- Test: `tests/unit/alerts.test.ts`

**Interfaces:**
- Consumes: `formatThb` (Task 3)
- Produces:
  - `ANIMATIONS = ['fade','slide-up','slide-down','zoom'] as const`; `SOUND_PRESETS = ['chime','coin','pop'] as const`
  - `alertVariantSchema` (Zod) ฟิลด์: `name` (1–50), `minAmountSatang` int ≥0, `weight` int 0–100, `messageTemplate` (1–200 chars), `textColor` `/^#[0-9A-Fa-f]{6}$/`, `fontFamily` string (เฟส 1 ค่า `'Prompt'`), `fontSize` int 12–120, `imageUrl` https|null, `soundUrl` https | `preset:${SoundPreset}` | null, `animationIn`/`animationOut` ∈ ANIMATIONS, `durationMs` int 1000–60000
  - `DEFAULT_ALERT_VARIANT` = `{ name: 'ค่าเริ่มต้น', minAmountSatang: 0, weight: 100, messageTemplate: '{name} โดเนท {amount} บาท', textColor: '#FFFFFF', fontFamily: 'Prompt', fontSize: 36, imageUrl: null, soundUrl: 'preset:chime', animationIn: 'fade', animationOut: 'fade', durationMs: 8000 }`
  - `alertOverlaySettingsSchema` = `z.object({ minAmountSatang: z.number().int().min(0) })`, `DEFAULT_ALERT_SETTINGS = { minAmountSatang: 1000 }`
  - `selectVariant<T extends { minAmountSatang: number; weight: number }>(variants: T[], amountSatang: number, rng: () => number = Math.random): T | null` — กติกาสเปกข้อ 4
  - `renderTemplate(template: string, vars: { name: string; amountSatang: number; message: string }): string` — แทน `{name}`, `{amount}` (ผ่าน `formatThb`), `{message}`; placeholder อื่นคงไว้ตามเดิม; คืน plain string (ไม่ escape — overlay render เป็น text node เสมอ)
  - `type AlertVariantRender = { textColor: string; fontFamily: string; fontSize: number; imageUrl: string | null; soundUrl: string | null; animationIn: Animation; animationOut: Animation; durationMs: number }`
  - `type RealtimeEvent = { type: 'alert'; id: string; donorName: string; amountSatang: number; message: string; headline: string; variant: AlertVariantRender } | { type: 'donation.paid'; donorName: string; amountSatang: number; paidAt: string }` (gift/settings.updated เพิ่มเฟสหลัง)
  - `resolveSoundUrl(soundUrl: string | null): string | null` — `preset:chime` → `/presets/sounds/chime.wav`
  - `buildAlertEvent(input: { id: string; donorName: string; amountSatang: number; message: string; variant: AlertVariant }): Extract<RealtimeEvent, { type: 'alert' }>`

- [ ] **Step 1:** เขียนเทส:
  - `selectVariant([], 1000)` → null
  - variants `[{min:0,w:100,id:'a'},{min:10000,w:70,id:'b'},{min:10000,w:30,id:'c'}]`, amount 15000, `rng=()=>0.69` → `'b'`; `rng=()=>0.70` → `'c'`
  - amount 5000 → `'a'` (tier ต่ำกว่าเท่านั้น)
  - tier ที่ weight รวม 0 (`b`,`c` weight 0), `rng=()=>0.6` → `'c'` (เลือกเท่ากันด้วย index `floor(rng*n)`)
  - ทุก variant min > amount → null
  - `renderTemplate('{name} โดเนท {amount} บาท', { name: '<b>แมว</b>', amountSatang: 123400, message: '' })` → `'<b>แมว</b> โดเนท 1,234 บาท'`; `'{unknown} {name}'` → `'{unknown} แมว'`
  - `resolveSoundUrl('preset:coin')` → `'/presets/sounds/coin.wav'`; https คืนเดิม; null → null
  - `alertVariantSchema.safeParse({...DEFAULT_ALERT_VARIANT, soundUrl: 'http://x'}).success === false`; `textColor: '#FFF'` → false; `soundUrl: 'preset:boom'` → false
- [ ] **Step 2:** Run `pnpm vitest run --project unit alerts` → FAIL
- [ ] **Step 3:** Implement ตาม Interfaces; การสุ่มถ่วงน้ำหนัก: `r = rng() * total`, วนสะสม weight คืนตัวแรกที่ `r < cumulative`
- [ ] **Step 4:** Run → PASS
- [ ] **Step 5:** Commit `feat: add alert variant selection and template rendering`

---

### Task 5: Payment adapter — types, mock provider, stripe stub

**Files:**
- Create: `src/server/payments/types.ts`, `src/server/payments/mock.ts`, `src/server/payments/stripe.ts`, `src/server/payments/index.ts`
- Test: `tests/unit/payments-mock.test.ts`

**Interfaces:**
- Consumes: `AppEnv` (Task 1)
- Produces:
  - `type CreateCheckoutInput = { donationId: string; amountSatang: number; streamerAccountId: string; successUrl: string; cancelUrl: string }`
  - `type PaymentEvent = { eventId: string; type: 'payment.succeeded' | 'payment.failed'; sessionId: string }`
  - `interface PaymentProvider { name: 'mock' | 'stripe'; createCheckout(i: CreateCheckoutInput): Promise<{ sessionId: string; checkoutUrl: string }>; parseWebhook(req: Request): Promise<PaymentEvent>; connectAccount(userId: string): Promise<{ externalAccountId: string; onboardingUrl?: string }> }`
  - `class InvalidSignatureError extends Error`
  - `createMockProvider(opts: { secret: string; baseUrl: string; now?: () => number }): PaymentProvider` — `sessionId = 'mcs_' + randomUUID()`, `checkoutUrl = ${baseUrl}/mock/checkout/${sessionId}`, `connectAccount` → `{ externalAccountId: 'macct_' + randomUUID() }`
  - `signMockWebhook(body: string, secret: string, timestampSec: number): Promise<string>` → header value `t=<ts>,v1=<hex HMAC-SHA256 ของ "${ts}.${body}">`
  - `buildMockWebhookRequest(opts: { secret: string; sessionId: string; outcome: 'succeeded' | 'failed'; baseUrl: string; nowSec?: number }): Promise<Request>` — body `{"id":"evt_<uuid>","type":"payment.<outcome>","data":{"sessionId":"..."}}`, header `x-tippaw-signature`
  - `createStripeProvider(): PaymentProvider` — ทุกเมธอด throw `new Error('Stripe provider not implemented')`
  - `getPaymentProvider(env: AppEnv): PaymentProvider` — `PAYMENT_PROVIDER === 'stripe'` → stripe; ไม่งั้น mock (`baseUrl = env.BETTER_AUTH_URL`)

- [ ] **Step 1:** เขียนเทส (ใช้ `now` คงที่):
  - request จาก `buildMockWebhookRequest` → `parseWebhook` คืน `{ type: 'payment.succeeded', sessionId }` และ `eventId` ขึ้นต้น `evt_`
  - ลายเซ็นผิด secret → reject `InvalidSignatureError`
  - body ถูกแก้หลังเซ็น → reject
  - timestamp เก่ากว่า 300 วินาที → reject; อนาคตเกิน 300 วินาที → reject
  - ไม่มี header → reject
  - `createCheckout` คืน `checkoutUrl` = `https://app.test/mock/checkout/mcs_...`
- [ ] **Step 2:** Run `pnpm vitest run --project unit payments` → FAIL
- [ ] **Step 3:** Implement (HMAC ผ่าน `crypto.subtle`; เทียบลายเซ็นแบบ constant-time)
- [ ] **Step 4:** Run → PASS
- [ ] **Step 5:** Commit `feat: add payment provider adapter with mock and stripe stub`

---

### Task 6: Realtime — StreamerRoom DO, publish, realtime route

**Files:**
- Modify: `src/server/realtime/streamer-room.ts`, `src/worker/realtime-route.ts`
- Create: `src/server/realtime/publish.ts`
- Test: `tests/integration/realtime.test.ts`

**Interfaces:**
- Consumes: `RealtimeEvent` (Task 4), `AppEnv`, `createDb`, ตาราง `overlay` (Task 2)
- Produces:
  - `class StreamerRoom extends DurableObject<AppEnv>` เมธอด: `fetch(req)` (รับ WebSocket upgrade; อ่าน token จาก header `x-overlay-token`; `this.ctx.acceptWebSocket(server, [token])`), RPC `broadcast(event: RealtimeEvent): Promise<number>` (คืนจำนวน socket ที่ส่ง), RPC `disconnectToken(token: string): Promise<void>` (close code `4001`, reason `'token reset'`); `webSocketMessage` ตอบ `'pong'` เมื่อได้ `'ping'`
  - `roomFor(ns: AppEnv['STREAMER_ROOM'], streamerId: string)` = `ns.get(ns.idFromName(streamerId))`
  - `publish(env: AppEnv, streamerId: string, event: RealtimeEvent): Promise<void>`
  - `disconnectToken(env: AppEnv, streamerId: string, token: string): Promise<void>`
  - `handleRealtimeRequest(request: Request, env: AppEnv): Promise<Response>` — path `/api/realtime/{token}`; ไม่ใช่ `Upgrade: websocket` → 426; token ไม่พบใน `overlay` → 404; พบ → ส่ง request (เพิ่ม header `x-overlay-token`) ไป `roomFor(streamerId)`

- [ ] **Step 1:** เขียนเทส (seed user + overlay token `tok-1` ตรงผ่าน db):
  - `it('broadcasts to connected overlay')`: `SELF.fetch('http://x/api/realtime/tok-1', { headers: { Upgrade: 'websocket' } })` → status 101, `ws.accept()`; `publish(env, streamerId, alertEvent)` → ได้ message JSON ตรงกับ event
  - `it('rejects unknown token')` → 404; `it('requires upgrade')` → 426
  - `it('disconnectToken closes only that token')`: socket 2 ตัว (`tok-1`, `tok-2` คนละ overlay type ของสตรีมเมอร์เดียว) → `disconnectToken(env, id, 'tok-1')` → ตัวแรกได้ close 4001, ตัวที่สองยังได้ broadcast
  - `it('replies pong')`
- [ ] **Step 2:** Run `pnpm vitest run --project integration realtime` → FAIL
- [ ] **Step 3:** Implement ด้วย WebSocket Hibernation API (`acceptWebSocket`, `getWebSockets(tag)`); ไม่เก็บ state ใน memory
- [ ] **Step 4:** Run → PASS
- [ ] **Step 5:** Commit `feat: add StreamerRoom durable object and realtime route`

---

### Task 7: Donation service — createDonation, handlePaymentEvent, replay/test alert

**Files:**
- Create: `src/server/donations/create-donation.ts`, `src/server/donations/handle-payment-event.ts`, `src/server/donations/alerts.ts`, `src/server/donations/queries.ts`, `src/server/overlays/overlays.ts` (เฉพาะ `getAlertOverlayConfig` ในงานนี้)
- Test: `tests/unit/donation-input.test.ts`, `tests/integration/donations.test.ts`

**Interfaces:**
- Consumes: `Deps`, `PaymentProvider`/`getPaymentProvider`, `buildMockWebhookRequest`, `InvalidSignatureError` (Task 5), `selectVariant`, `buildAlertEvent`, `alertOverlaySettingsSchema` (Task 4), `publish` (Task 6), `charLength` (Task 3)
- Produces:
  - `donationInputSchema(env: AppEnv)` → Zod `{ slug: string; donorName: string (trim, 1–50 chars); message: string (trim, 0–200 chars, default ''); amountThb: int ในช่วง MIN–MAX จาก env }`
  - `createDonation(deps: Deps, provider: PaymentProvider, input: DonationInput): Promise<{ ok: true; donationId: string; checkoutUrl: string } | { ok: false; reason: 'not_found' | 'not_accepting' }>` — `not_accepting` เมื่อ payout ไม่ `active`; successUrl/cancelUrl = `${BETTER_AUTH_URL}/${slug}/result?d=${donationId}`
  - `getAlertOverlayConfig(deps: Deps, streamerId: string): Promise<{ overlay: { id: string; token: string; settings: AlertOverlaySettings }; variant: AlertVariant & { id: string } } | null>`
  - `handlePaymentEvent(deps: Deps, providerName: string, event: PaymentEvent): Promise<{ outcome: 'duplicate' | 'paid' | 'failed' | 'ignored'; published: boolean }>`
  - `handleWebhookRequest(deps: Deps, provider: PaymentProvider, req: Request): Promise<Response>` — `InvalidSignatureError` → 400; error อื่น → 500; สำเร็จ → 200 `{ ok: true }`
  - `replayAlert(deps: Deps, streamerId: string, donationId: string): Promise<'ok' | 'not_found'>` (ไม่สนขั้นต่ำ, เฉพาะ donation `paid` ของตัวเอง)
  - `sendTestAlert(deps: Deps, streamerId: string): Promise<void>` (donorName `'TipPaw'`, amount 10000, message `'นี่คือการทดสอบ alert'`, ไม่สนขั้นต่ำ)
  - `getDonationStatus(deps: Deps, donationId: string): Promise<{ status: 'pending' | 'paid' | 'failed'; slug: string } | null>`
  - `listPaidDonations(deps: Deps, streamerId: string, page: number): Promise<{ items: { id: string; paidAt: Date; donorName: string; amountSatang: number; message: string }[]; total: number }>` — 50 ต่อหน้า, เรียง `paid_at` desc

**อัลกอริทึม `handlePaymentEvent`** (D1 batch เดียว):
1. `INSERT INTO webhook_event (provider_event_id, received_at) VALUES (?, ?) ON CONFLICT DO NOTHING`
2. `UPDATE donation SET status = ?, paid_at = ? WHERE provider_session_id = ? AND status = 'pending'`
- ผล (1) changes = 0 → `duplicate`; ผล (2) changes = 0 → `ignored`; ไม่งั้น `paid`/`failed`
- เมื่อ `paid`: โหลด donation + `getAlertOverlayConfig`; ถ้า `amount ≥ settings.minAmountSatang` และ `selectVariant` ได้ variant → `publish` alert event และ `donation.paid` event; error จาก publish ให้ `console.error` แล้วคืน `published: false` (ไม่ throw)

- [ ] **Step 1:** เขียน unit เทส `donationInputSchema`: ชื่อ `'ก'.repeat(50)` ผ่าน, `'ก'.repeat(51)` ไม่ผ่าน; `'น้ำใจ'.repeat(10)` (50 code points, `.length` ก็ 50) ผ่าน และ `'น้ำใจ'.repeat(10) + 'ก'` ไม่ผ่าน; `'😀'.repeat(50)` ผ่าน (`.length` = 100 แต่ code point = 50); ชื่อ whitespace ล้วน → ไม่ผ่าน; `amountThb: 9` / `10001` / `10.5` → ไม่ผ่าน; `10` และ `10000` ผ่าน
- [ ] **Step 2:** เขียน integration เทส (helper `seedStreamer(db, { slug, payoutActive, minAmountSatang })` สร้าง user/profile/tip_page/overlay/variant/payout; ต่อ WebSocket ไป overlay เพื่อจับ event):
  - createDonation สำเร็จ → donation `pending` มี `provider_session_id`
  - payout ไม่ active → `not_accepting`; slug ไม่มี → `not_found`
  - webhook succeeded → donation `paid`, `paid_at` ตั้ง, socket ได้ `alert` ที่ `headline === 'แมว โดเนท 100 บาท'`
  - **webhook เดิมซ้ำ (eventId เดียวกัน)** → `duplicate`, ไม่มี message ใหม่ใน socket
  - **succeeded ครั้งที่สองด้วย eventId ใหม่** → `ignored`, ไม่ publish; **failed หลัง paid** → `ignored`, status ยัง `paid`
  - webhook failed ตอน pending → `failed`, ไม่ publish
  - ขั้นต่ำ `minAmountSatang: 1000` + โดเนท 10 บาท → publish (เท่ากับขั้นต่ำแสดง); ขั้นต่ำ 2000 + โดเนท 10 บาท → status `paid` แต่ไม่ publish
  - `handleWebhookRequest` ลายเซ็นผิด → 400
  - `replayAlert` ของ donation คนอื่น → `not_found`; ของตัวเอง (แม้ต่ำกว่าขั้นต่ำ) → publish
  - `listPaidDonations` ไม่รวม pending/failed, เรียงใหม่สุดก่อน, 51 รายการ → หน้า 2 มี 1 รายการ
- [ ] **Step 3:** Run `pnpm vitest run donation` → FAIL
- [ ] **Step 4:** Implement
- [ ] **Step 5:** Run `pnpm vitest run` → PASS ทั้งหมด
- [ ] **Step 6:** Commit `feat: add donation creation and idempotent payment event handling`

---

### Task 8: Invite service

**Files:**
- Create: `src/server/invites/invites.ts`
- Test: `tests/integration/invites.test.ts`

**Interfaces:**
- Consumes: `Deps`, `randomInviteCode`, `normalizeInviteCode` (Task 3)
- Produces:
  - `checkInvite(deps: Deps, rawCode: string): Promise<boolean>` (ไม่ใช้โควตา)
  - `redeemInvite(deps: Deps, userId: string, rawCode: string): Promise<boolean>` — ผู้ใช้ที่ redeem แล้ว → true ทันที (idempotent)
  - `createInvite(deps: Deps, adminId: string, input: { code?: string; note?: string; maxUses: number | null; expiresAt: Date | null }): Promise<{ ok: true; code: string } | { ok: false; reason: 'invalid_code' | 'duplicate' }>` (ไม่ระบุ code → `randomInviteCode()`, สุ่มใหม่ถ้าชน สูงสุด 5 ครั้ง)
  - `setInviteDisabled(deps: Deps, code: string, disabled: boolean): Promise<boolean>`
  - `listInvites(deps: Deps): Promise<InviteRow[]>` (เรียง `created_at` desc; `InviteRow = { code, note, maxUses, usedCount, expiresAt, disabledAt, createdAt }`)
  - `listInviteUsers(deps: Deps, code: string): Promise<{ userId: string; username: string | null; name: string; redeemedAt: Date }[]`
  - `hasRedeemed(deps: Deps, userId: string): Promise<boolean>`

**อัลกอริทึม `redeemInvite`** (D1 batch เดียว):
1. `INSERT INTO invite_redemption (user_id, code, redeemed_at) SELECT ?, code, ? FROM invite_code WHERE code = ? AND disabled_at IS NULL AND (expires_at IS NULL OR expires_at > ?) AND (max_uses IS NULL OR used_count < max_uses)`
2. `UPDATE invite_code SET used_count = used_count + 1 WHERE code = ? AND EXISTS (SELECT 1 FROM invite_redemption WHERE user_id = ? AND code = ? AND redeemed_at = ?)`
- สำเร็จเมื่อ (1) changes === 1

- [ ] **Step 1:** เขียนเทส: โค้ดถูก → true และ `used_count` = 1; โค้ดไม่มี / ปิดอยู่ / หมดอายุ → false; `maxUses: 1` ผู้ใช้สองคน redeem ด้วย `Promise.all` → true 1 ครั้ง, `used_count` = 1; ผู้ใช้เดิม redeem ซ้ำ → true, `used_count` ไม่เพิ่ม; รับโค้ดตัวพิมพ์เล็ก `' vip-1 '` → ใช้ได้; `createInvite` code ซ้ำ → `duplicate`; `'ab'` → `invalid_code`; `listInviteUsers` คืนผู้ใช้ที่ redeem
- [ ] **Step 2:** Run `pnpm vitest run --project integration invites` → FAIL
- [ ] **Step 3:** Implement
- [ ] **Step 4:** Run → PASS
- [ ] **Step 5:** Commit `feat: add invite code service with atomic redemption`

---

### Task 9: Auth — Better Auth, PBKDF2, mock Streamlabs, session guards

**Files:**
- Create: `src/server/auth/pbkdf2.ts`, `src/server/auth/auth.ts`, `src/server/auth/mock-streamlabs.ts`, `src/server/auth/session.ts`, `src/app/api/auth/[...all]/route.ts`, `src/app/mock/streamlabs/authorize/page.tsx`
- Test: `tests/unit/pbkdf2.test.ts`, `tests/unit/mock-streamlabs.test.ts`, `tests/integration/auth.test.ts`

**Interfaces:**
- Consumes: `AppEnv`, `Deps`, `createDb`, `hasRedeemed` (Task 8), `isMockMode`
- Produces:
  - `hashPassword(pw: string): Promise<string>` → `pbkdf2$sha256$100000$<saltB64>$<hashB64>`; `verifyPassword({ hash, password }): Promise<boolean>`
  - `createAuth(env: AppEnv, db: Db)` — Better Auth: `database: drizzleAdapter(db, { provider: 'sqlite', schema })`, `emailAndPassword: { enabled: true, minPasswordLength: 8, password: { hash: hashPassword, verify: verifyPassword } }`, `plugins: [username(), admin({ defaultRole: 'streamer', adminRoles: ['admin'] }), genericOAuth({ config: [streamlabsConfig] })]`, `socialProviders.google` เมื่อมี `GOOGLE_CLIENT_ID`, `account.accountLinking: { enabled: true, trustedProviders: ['google'] }`
  - `streamlabsConfig`: `providerId: 'streamlabs'`, URL จาก env; **เมื่อ `isMockMode(env)`** ใช้ hook `getToken`/`getUserInfo` ของ genericOAuth ที่เรียก `exchangeCode`/`userInfo` ใน process (ตรวจชื่อ hook กับเวอร์ชันที่ติดตั้ง)
  - `placeholderEmail(username: string): string` = `${username.toLowerCase()}@users.tippaw.invalid` (username plugin ต้องมี email)
  - mock-streamlabs: `buildAuthorizeRedirect(params: { redirectUri: string; state: string; streamlabsUsername: string }): string` (code = base64url JSON `{ u: username }`), `exchangeCode(code: string): { accessToken: string }` (`'mock_' + code`), `userInfo(accessToken: string): { id: string; name: string; email: string; emailVerified: true }` (id = `'sl_' + username`, email `${username}@streamlabs.mock`)
  - `getSession(): Promise<{ user: SessionUser } | null>` (`SessionUser = { id: string; name: string; username: string | null; role: 'admin' | 'streamer' }`)
  - `requireSession()`, `requireOnboarded()`, `requireAdmin()` — ใช้ใน Server Component (อ่าน `headers()` + `getDeps()` เอง): redirect (`/login`, `/onboarding`, `/dashboard`)
  - เวอร์ชัน API รับ deps ตรง (เทสได้): `apiRequireSession(deps: Deps, headers: Headers)`, `apiRequireOnboarded(deps, headers)`, `apiRequireAdmin(deps, headers)` คืน `{ ok: true; user: SessionUser } | { ok: false; response: Response }` (401/403)
  - **แพตเทิร์น API route ทุกตัวในแผนนี้:** logic อยู่ในฟังก์ชัน `handleXxx(deps: Deps, req: Request): Promise<Response>` ใต้ `src/server/**/api.ts`; ไฟล์ `route.ts` แค่ `export const POST = async (req) => handleXxx(await getDeps(), req)` — integration test เรียก `handleXxx` ตรง
  - "onboarded" = มี `streamer_profile` และ (`hasRedeemed` หรือ role `admin`)

**การตัดสินใจ:** gate onboarding ทำใน server layout + API guard (ไม่พึ่ง Next middleware ที่ query D1); middleware ไม่ใช้ในเฟส 1

- [ ] **Step 1:** เขียนเทส: pbkdf2 round-trip true, รหัสผิด false, hash สองครั้งไม่เท่ากัน; mock-streamlabs: `exchangeCode` → `userInfo` คืน `name === 'catstreamer'` จาก code ที่ `buildAuthorizeRedirect` สร้าง, redirect URL มี `state` เดิม; integration: `createAuth(env, db).api.signUpEmail({ body: { email: placeholderEmail('neko'), username: 'neko', password: 'password123', name: 'neko' } })` → sign in ด้วย `signInUsername` สำเร็จ, `role === 'streamer'`
- [ ] **Step 2:** Run → FAIL
- [ ] **Step 3:** Implement + route `api/auth/[...all]` (`toNextJsHandler`) + หน้า `/mock/streamlabs/authorize` (ฟอร์มกรอกชื่อ Streamlabs → redirect; 404 เมื่อไม่ใช่ mock mode)
- [ ] **Step 4:** Run → PASS
- [ ] **Step 5:** Commit `feat: add Better Auth with PBKDF2, username, admin and mock Streamlabs`

---

### Task 10: UI foundation — port Minimal, theme, Prompt

**Files:**
- Create: `src/ui/minimal/**` (theme, layouts/dashboard, components ที่ใช้), `src/ui/minimal/LICENSE.md`, `src/ui/providers.tsx`, `src/ui/nav-config.ts`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`

**Interfaces:**
- Produces:
  - `<Providers>` (Client) = `AppRouterCacheProvider` + MUI `ThemeProvider` + `CssBaseline`
  - `<DashboardShell nav={NavItem[]} user={{ name: string }}>` (port จาก dashboard layout ของ Minimal)
  - `type NavItem = { title: string; path: string; icon: string }`; `STREAMER_NAV` = ธุรกรรม `/dashboard/transactions`, หน้า Tip `/dashboard/tip-page`, Alert `/dashboard/overlays/alert`, โปรไฟล์ `/dashboard/profile`; `ADMIN_NAV` = Invite codes `/admin/invites`, ผู้ใช้ `/admin/users`
  - palette ตามสเปกข้อ 11 (`primary.lighter #E7D6E3`, `light #AF719D`, `main #8B639B`, `dark #403D88`, `darker #2A2860`; `secondary.main #F8B2B2`, `secondary.contrastText #403D88`)

- [ ] **Step 1:** clone `https://github.com/minimal-ui-kit/material-kit-react` ลง scratch; บันทึก commit hash ใน `LICENSE.md` พร้อมข้อความ MIT
- [ ] **Step 2:** คัดลอก `src/theme`, layout dashboard, และ components ที่ layout ใช้ (iconify, label, scrollbar, logo, svg-color ฯลฯ) มาที่ `src/ui/minimal/`; แทน `react-router` ด้วย `next/link` / `next/navigation` (`usePathname`); ใส่ `'use client'` ที่จำเป็น; ลบหน้าตัวอย่าง/ข้อมูล mock ของ template
- [ ] **Step 3:** ตั้ง palette + `typography.fontFamily` = ตัวแปรจาก `next/font/google` `Prompt({ subsets: ['thai','latin'], weight: ['100','200','300','400','500','600','700','800','900'], style: ['normal','italic'], variable: '--font-prompt' })`
- [ ] **Step 4:** Run `pnpm tsc --noEmit && pnpm build` → Expected: ผ่านไม่มี error; `grep -r "react-router" src` → ไม่พบ
- [ ] **Step 5:** Run `pnpm preview` → เปิดหน้า `/` (ชั่วคราวแสดง `DashboardShell` ตัวอย่าง) เห็น sidebar, ฟอนต์ Prompt, ปุ่ม primary สี `#8B639B`; จากนั้นคืนหน้า `/` เป็น landing เรียบ ๆ (โลโก้ TipPaw + ปุ่ม "เข้าสู่ระบบ")
- [ ] **Step 6:** Commit `feat: port Minimal free UI kit with TipPaw theme and Prompt font`

---

### Task 11: หน้า Auth + Onboarding + E2E infra

**Files:**
- Create: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`, `src/app/api/register/route.ts`, `src/server/onboarding/onboarding.ts`, `src/app/onboarding/page.tsx`, `src/app/api/onboarding/route.ts`, `src/app/dashboard/layout.tsx`, `src/app/dashboard/page.tsx`, `scripts/admin-bootstrap-invite.ts`, `scripts/admin-promote.ts`, `playwright.config.ts`, `tests/e2e/global-setup.ts`, `tests/e2e/helpers.ts`, `tests/e2e/auth.spec.ts`
- Test: `tests/integration/onboarding.test.ts`

**Interfaces:**
- Consumes: `createAuth`, `placeholderEmail`, guards (Task 9), `checkInvite`, `redeemInvite`, `hasRedeemed` (Task 8), `validateSlug`, `randomToken` (Task 3), `DEFAULT_ALERT_VARIANT`, `DEFAULT_ALERT_SETTINGS` (Task 4)
- Produces:
  - `POST /api/register` body `{ username, password, inviteCode }` → rate limit `INVITE_RATE_LIMITER` (key = IP) → `checkInvite` false → 400 `{ error: 'invite_invalid' }` → `signUpEmail` (ส่ง cookie ต่อ) → `redeemInvite`
  - `getOnboardingState(deps, user): Promise<{ needsInvite: boolean; needsSlug: boolean }>`
  - `completeOnboarding(deps: Deps, user: SessionUser, input: { inviteCode?: string; slug: string }): Promise<{ ok: true } | { ok: false; reason: 'invite_invalid' | 'slug_format' | 'slug_reserved' | 'slug_taken' }>` — สร้างใน batch: `streamer_profile`, `tip_page` (channel_name = `user.name`, `success_message = 'ขอบคุณสำหรับการสนับสนุนนะ 💜'`, `failure_message = 'การชำระเงินไม่สำเร็จ ลองใหม่อีกครั้งนะ'`), `overlay` type `alert` (token `randomToken()`, settings `DEFAULT_ALERT_SETTINGS`), `alert_variant` จาก `DEFAULT_ALERT_VARIANT`
  - `POST /api/onboarding` → rate limit `INVITE_RATE_LIMITER` เมื่อมี `inviteCode` → map reason: invite 400, slug_format/slug_reserved 400, slug_taken 409
  - สคริปต์: `pnpm admin:bootstrap-invite [--remote] [--code X]` (สร้างโค้ด maxUses 1 แล้วพิมพ์ออกมา), `pnpm admin:promote <username> [--remote]` (username ต้องตรง `^[a-zA-Z0-9_.]{3,30}$` ก่อนต่อ SQL)

UI: หน้า login มีปุ่ม "เข้าสู่ระบบด้วย Google" (ซ่อนเมื่อไม่มี `GOOGLE_CLIENT_ID`), "เข้าสู่ระบบด้วย Streamlabs" (ซ่อนเมื่อไม่มี `STREAMLABS_CLIENT_ID`), ฟอร์ม username/password; หน้า register อ่าน `?code=` มาเติมช่อง invite code; onboarding แสดงช่อง invite เฉพาะเมื่อ `needsInvite`, ช่อง slug แสดง preview `tippaw.../{slug}`

- [ ] **Step 1:** เขียน integration เทส `completeOnboarding`: ผู้ใช้ OAuth ยังไม่ redeem + ไม่ส่งโค้ด → `invite_invalid`; ส่งโค้ดถูก + slug `'MyCat'` → ok และ profile slug `'mycat'`, มี overlay alert 1 แถว + variant 1 แถว; slug ซ้ำ → `slug_taken`; `'admin'` → `slug_reserved`; admin ไม่ส่งโค้ด → ok
- [ ] **Step 2:** Run → FAIL; implement service; Run → PASS
- [ ] **Step 3:** ทำหน้า/route ตาม Interfaces; `dashboard/layout.tsx` เรียก `requireOnboarded()`; `onboarding/page.tsx` เรียก `requireSession()` และ redirect ไป `/dashboard` เมื่อ onboard แล้ว
- [ ] **Step 4:** ตั้ง E2E: `playwright.config.ts` `webServer: pnpm build && pnpm preview` port 8787 (`reuseExistingServer` เฉพาะ local), `globalSetup` ลบ `.wrangler/state` → `wrangler d1 migrations apply tippaw-db --local` → `admin:bootstrap-invite --code E2E-BOOT`; helper `registerUser(page, { username, password, inviteCode })`, `onboard(page, slug)`
- [ ] **Step 5:** เขียน `tests/e2e/auth.spec.ts`: register ด้วย `E2E-BOOT` → onboarding (ไม่เห็นช่อง invite) → ตั้ง slug → ถึง `/dashboard/transactions`; register ด้วยโค้ดมั่ว → เห็น "invite code ไม่ถูกต้อง"; logout แล้วเปิด `/dashboard` → ไป `/login`; **"เข้าสู่ระบบด้วย Streamlabs"** → หน้า mock authorize กรอก `slcat` → กลับมาที่ `/onboarding` **เห็นช่อง invite** → เปิด `/dashboard` ตรง → ถูกส่งกลับ `/onboarding`
- [ ] **Step 6:** Run `pnpm playwright test auth` → PASS
- [ ] **Step 7:** Commit `feat: add login, register and onboarding with invite gating`

---

### Task 12: Admin CMS

**Files:**
- Create: `src/app/admin/layout.tsx`, `src/app/admin/invites/page.tsx`, `src/app/admin/invites/[code]/page.tsx`, `src/app/admin/users/page.tsx`, `src/app/api/admin/invites/route.ts`, `src/app/api/admin/invites/[code]/route.ts`, `src/server/admin/users.ts`
- Test: `tests/integration/admin-api.test.ts`, `tests/e2e/admin.spec.ts`

**Interfaces:**
- Consumes: invite service (Task 8), `apiRequireAdmin`/`requireAdmin` (Task 9), `DashboardShell` + `ADMIN_NAV` (Task 10)
- Produces:
  - `GET /api/admin/invites` → `InviteRow[]`; `POST /api/admin/invites` body `{ code?: string; note?: string (≤100); maxUses: number | null (1–10000); expiresAt: string | null (ISO) }` → 201 `{ code }` / 400 / 409
  - `PATCH /api/admin/invites/[code]` body `{ disabled: boolean }` → 200 / 404
  - `listUsers(deps: Deps): Promise<{ id; name; username; slug: string | null; providers: string[]; inviteCode: string | null; createdAt: Date }[]>` (`providers` จาก `account.providerId`: `credential` → แสดง "Local")

UI: ตาราง invite (โค้ด, หมายเหตุ, ใช้แล้ว/โควตา แสดง `3 / ∞` เมื่อไม่จำกัด, หมดอายุ, สถานะ "ใช้งานได้/ปิดอยู่/หมดอายุ/เต็ม", สร้างเมื่อ), ปุ่ม "สร้างโค้ด" (dialog: สุ่ม/กำหนดเอง, หมายเหตุ, โควตา, วันหมดอายุ), ปุ่มคัดลอกโค้ดและลิงก์ `${origin}/register?code=XXXX`, สวิตช์ปิด/เปิด; หน้า `[code]` แสดงผู้ใช้ที่ใช้โค้ด

- [ ] **Step 1:** เขียน integration เทส (เรียก `handleListInvites` / `handleCreateInvite` / `handlePatchInvite` ใน `src/server/admin/api.ts` ตรง พร้อม header cookie จากการ sign in ผู้ใช้เทสผ่าน `createAuth(...).api`): streamer เรียก `GET /api/admin/invites` → 403; ไม่ล็อกอิน → 401; admin สร้างโค้ดไม่ระบุ code → 201 โค้ดยาว 8; สร้าง `'vip-1'` → เก็บเป็น `VIP-1`; PATCH disabled → `checkInvite` false
- [ ] **Step 2:** Run → FAIL; implement; Run → PASS
- [ ] **Step 3:** เขียน `tests/e2e/admin.spec.ts`: ผู้ใช้จาก auth flow ถูก promote (`admin:promote` ผ่าน helper) → เปิด `/admin/invites` → สร้างโค้ด `E2E-CAT` โควตา 1 → logout → register ผู้ใช้ใหม่ด้วยลิงก์ `/register?code=E2E-CAT` สำเร็จ → admin เห็น `1 / 1` และสถานะ "เต็ม"; streamer เปิด `/admin/invites` → ถูก redirect ไป `/dashboard`
- [ ] **Step 4:** Run `pnpm playwright test admin` → PASS
- [ ] **Step 5:** Commit `feat: add admin CMS for invite codes and users`

---

### Task 13: โปรไฟล์ + ตั้งค่าหน้า Tip

**Files:**
- Create: `src/server/profile/profile.ts`, `src/server/tip-page/tip-page.ts`, `src/app/api/profile/route.ts`, `src/app/api/profile/payout/route.ts`, `src/app/api/tip-page/route.ts`, `src/app/dashboard/profile/page.tsx`, `src/app/dashboard/tip-page/page.tsx`
- Test: `tests/unit/tip-page-schema.test.ts`, `tests/integration/profile.test.ts`

**Interfaces:**
- Consumes: `validateSlug` (Task 3), `getPaymentProvider` (Task 5), guards (Task 9)
- Produces:
  - `updateSlug(deps, userId, raw): Promise<{ ok: true; slug } | { ok: false; reason: 'slug_format' | 'slug_reserved' | 'slug_taken' }>`
  - `connectPayout(deps, provider: PaymentProvider, userId): Promise<{ status: 'active' | 'pending'; onboardingUrl?: string }>` (mock → upsert `active` ทันที)
  - `getProfile(deps, userId): Promise<{ slug: string; payout: { provider: string; status: string } | null }>`
  - `tipPageUpdateSchema` = `{ channelName: 1–50 chars; links: { label: 1–30 chars; url: https }[] (max 10); successMessage: 1–300 chars; failureMessage: 1–300 chars }`
  - `getTipPage(deps, userId)`, `updateTipPage(deps, userId, input)`
  - `getPublicTipPage(deps, rawSlug): Promise<{ streamerId; slug; channelName; links; successMessage; failureMessage; accepting: boolean } | null>` (normalize slug ก่อนค้น)
  - `PATCH /api/profile` `{ slug }`; `POST /api/profile/payout`; `GET/PUT /api/tip-page`

UI โปรไฟล์: ช่อง slug + ลิงก์หน้า Tip เต็ม + ปุ่มคัดลอก; การ์ด "ช่องทางรับเงิน" แสดงสถานะ + ปุ่ม "เชื่อมต่อ Stripe" (โหมด mock แสดงป้าย "โหมดทดสอบ"); UI หน้า Tip: ชื่อช่อง, รายการลิงก์ (เพิ่ม/ลบ/เรียง), ข้อความสำเร็จ/ไม่สำเร็จ, ปุ่มบันทึก + ลิงก์ "ดูหน้า Tip"

- [ ] **Step 1:** เขียน unit เทส schema: link `http://` ไม่ผ่าน; 11 links ไม่ผ่าน; label ว่างไม่ผ่าน
- [ ] **Step 2:** เขียน integration เทส: `updateSlug` เป็น slug ของคนอื่น → `slug_taken`; เปลี่ยนเป็น `' NewCat '` → `newcat`; `getPublicTipPage(deps, 'NewCat')` เจอ; ก่อน `connectPayout` → `accepting: false`, หลัง → true
- [ ] **Step 3:** Run → FAIL; implement services + routes; Run → PASS
- [ ] **Step 4:** ทำ UI สองหน้า; ตรวจด้วย `pnpm preview` ว่าบันทึกแล้ว reload ค่าคงอยู่
- [ ] **Step 5:** Commit `feat: add profile, payout connection and tip page settings`

---

### Task 14: หน้า Tip สาธารณะ + ชำระเงิน mock + หน้า result + webhook route

**Files:**
- Create: `src/app/[slug]/page.tsx`, `src/app/[slug]/TipForm.tsx`, `src/app/[slug]/result/page.tsx`, `src/app/[slug]/result/ResultPoller.tsx`, `src/app/api/donations/route.ts`, `src/app/api/donations/[id]/status/route.ts`, `src/app/api/webhooks/payment/route.ts`, `src/app/mock/checkout/[sessionId]/page.tsx`, `src/app/mock/checkout/[sessionId]/actions.ts`
- Test: `tests/integration/mock-checkout.test.ts`, `tests/e2e/donate.spec.ts`

**Interfaces:**
- Consumes: `getPublicTipPage` (Task 13), `createDonation`, `donationInputSchema`, `handleWebhookRequest`, `getDonationStatus` (Task 7), `getPaymentProvider`, `buildMockWebhookRequest` (Task 5)
- Produces:
  - `POST /api/donations` → rate limit `DONATION_RATE_LIMITER` (key IP, 429 `{ error: 'rate_limited' }`) → 200 `{ checkoutUrl }` / 404 / 409 `{ error: 'not_accepting' }`
  - `GET /api/donations/[id]/status` → `{ status }` / 404
  - `POST /api/webhooks/payment` → `handleWebhookRequest(deps, getPaymentProvider(env), req)`
  - Server action `simulatePayment(sessionId: string, outcome: 'succeeded' | 'failed'): Promise<{ redirectTo: string }>` — 404 ถ้าไม่ใช่ mock mode; สร้าง request ด้วย `buildMockWebhookRequest` แล้ว **เรียก `handleWebhookRequest` ตรง** (ไม่ fetch); คืน URL หน้า result
  - `getDonationBySession(deps, sessionId)` (ใน `queries.ts`) สำหรับหน้า mock checkout แสดงชื่อช่อง/ยอด

UI หน้า Tip: การ์ดชื่อช่อง + ปุ่มลิงก์; ฟอร์ม "ชื่อของคุณ", checkbox "จดจำชื่อ" (localStorage key `tippaw:donorName`, โหลดค่าตอนเปิดหน้า, ลบเมื่อยกเลิกติ๊ก), "ข้อความถึงสตรีมเมอร์" (ตัวนับ x/200), "จำนวนเงิน (บาท)" + ปุ่มลัด 20/50/100/500, ปุ่ม "ชำระเงิน"; `accepting: false` → แสดง "ยังไม่เปิดรับโดเนท" แทนฟอร์ม; slug ไม่พบ → `notFound()`. หน้า mock checkout: ป้าย "โหมดทดสอบ — ไม่มีการตัดเงินจริง", QR ตัวอย่าง (SVG placeholder), ยอด, ปุ่ม "จำลองชำระสำเร็จ" / "จำลองชำระไม่สำเร็จ". หน้า result: poll ทุก 2 วินาที สูงสุด 5 นาที; `paid` → `successMessage`; `failed` → `failureMessage` + ปุ่ม "ลองอีกครั้ง"; หมดเวลา → "ยังไม่ได้รับการยืนยันการชำระเงิน"

- [ ] **Step 1:** เขียน integration เทส `simulatePayment` (import service ที่ action ใช้ — แยก logic เป็น `runSimulatedPayment(deps, sessionId, outcome)` ใน `actions.ts` แล้วเทสฟังก์ชันนี้): ใส่ `vi.spyOn(globalThis, 'fetch')` แล้ว assert **ไม่ถูกเรียก**; donation เป็น `paid`; เรียกซ้ำ → ยัง `paid` และ alert ไม่ถูก publish ซ้ำ
- [ ] **Step 2:** Run → FAIL; implement routes/pages/action; Run → PASS
- [ ] **Step 3:** เขียน `tests/e2e/donate.spec.ts`: สตรีมเมอร์ onboard + เชื่อมต่อ payout → ผู้ชม (context ใหม่) เปิด `/{SLUG ตัวพิมพ์ใหญ่}` เห็นชื่อช่อง → กรอกชื่อ + ติ๊กจดจำ + ข้อความ + 100 → ชำระ → หน้า mock → "จำลองชำระสำเร็จ" → หน้า result เห็นข้อความสำเร็จ → เปิดหน้า Tip ใหม่ ชื่อถูกเติมไว้; อีกรอบกด "จำลองชำระไม่สำเร็จ" → เห็นข้อความไม่สำเร็จ; สตรีมเมอร์ที่ยังไม่เชื่อม payout → เห็น "ยังไม่เปิดรับโดเนท"
- [ ] **Step 4:** Run `pnpm playwright test donate` → PASS
- [ ] **Step 5:** Commit `feat: add public tip page, mock checkout and payment result flow`

---

### Task 15: หน้าธุรกรรม + alert ซ้ำ

**Files:**
- Create: `src/app/dashboard/transactions/page.tsx`, `src/app/dashboard/transactions/ReplayButton.tsx`, `src/app/api/donations/[id]/replay/route.ts`
- Test: `tests/e2e/transactions.spec.ts` (ต่อจาก donate flow)

**Interfaces:**
- Consumes: `listPaidDonations`, `replayAlert` (Task 7), `apiRequireOnboarded` (Task 9)
- Produces: `POST /api/donations/[id]/replay` → 200 / 404

UI: ตาราง MUI คอลัมน์ "วันที่" (`th-TH`, วันที่ + เวลา เขตเวลา `Asia/Bangkok`), "ชื่อ", "จำนวนเงิน" (`฿` + `formatThb`), "ข้อความ", ปุ่ม "Alert ซ้ำ" (แสดง snackbar "ส่ง alert แล้ว"); แบ่งหน้าด้วย `?page=` 50 ต่อหน้า; ไม่มีรายการ → "ยังไม่มีรายการโดเนท"

- [ ] **Step 1:** เขียน e2e: หลังโดเนทสำเร็จ 1 รายการ สตรีมเมอร์เห็นแถวชื่อ/ยอด `฿100`/ข้อความ; รายการที่ "ไม่สำเร็จ" ไม่แสดง; กด "Alert ซ้ำ" → เห็น snackbar
- [ ] **Step 2:** Run → FAIL; implement; Run → PASS
- [ ] **Step 3:** Commit `feat: add transactions page with alert replay`

---

### Task 16: หน้าตั้งค่า Alert overlay + ปุ่มทดสอบ/reset + เสียง preset

**Files:**
- Modify: `src/server/overlays/overlays.ts`
- Create: `src/app/dashboard/overlays/alert/page.tsx`, `src/app/dashboard/overlays/alert/AlertSettingsForm.tsx`, `src/components/ColorField.tsx`, `src/app/api/overlays/alert/route.ts`, `src/app/api/overlays/alert/test/route.ts`, `src/app/api/overlays/alert/reset/route.ts`, `scripts/generate-preset-sounds.ts`, `public/presets/sounds/{chime,coin,pop}.wav`
- Test: `tests/integration/overlays.test.ts`

**Interfaces:**
- Consumes: `getAlertOverlayConfig`, `sendTestAlert` (Task 7), `disconnectToken` (Task 6), `alertVariantSchema`, `alertOverlaySettingsSchema`, `SOUND_PRESETS`, `ANIMATIONS` (Task 4), `randomToken` (Task 3)
- Produces:
  - `updateAlertOverlay(deps, streamerId, input: { settings: AlertOverlaySettings; variant: AlertVariant }): Promise<void>` (อัปเดต variant แถวเดียวของสตรีมเมอร์)
  - `resetOverlayToken(deps, streamerId, type: 'alert'): Promise<string>` — ออก token ใหม่ แล้ว `disconnectToken` ของ token เก่า
  - `getOverlayByToken(deps, token): Promise<{ streamerId: string; type: OverlayType } | null>`
  - `GET /api/overlays/alert` → `{ overlayUrl, settings, variant }` (`overlayUrl = ${BETTER_AUTH_URL}/overlay/alert/${token}`); `PUT` body `{ settings, variant }` (ยอดขั้นต่ำรับเป็นบาทใน UI แปลงเป็นสตางค์ก่อนส่ง); `POST .../test` → 204; `POST .../reset` → `{ overlayUrl }`
  - `<ColorField value onChange>`: TextField Hex + `<input type="color">` sync กัน; ค่าไม่ถูกต้องแสดง error และไม่ส่งออก

UI: การ์ด "Overlay URL" (ช่องแบบ password + ปุ่มแสดง/คัดลอก + คำแนะนำ "ใส่ใน OBS → Sources → Browser, ขนาด 800×600"), ปุ่ม "ทดสอบ Alert", ปุ่ม "รีเซ็ต URL" (confirm dialog "URL เดิมจะใช้ไม่ได้ทันที"); ฟอร์ม: ยอดขั้นต่ำที่จะแสดง (บาท), ข้อความ template (helper "ใช้ {name} {amount} {message} ได้"), สีข้อความ (`ColorField`), ขนาดตัวอักษร (slider 12–120), รูป (URL https + preview), เสียง (select: chime/coin/pop/กำหนด URL เอง + ปุ่มฟังเสียง), animation เข้า/ออก (select 4 แบบ), ระยะเวลาแสดง (วินาที 1–60), preview สดแบบย่อด้านขวา (ใช้ `AlertPlayer` จาก Task 17 เมื่อพร้อม — ในงานนี้แสดงข้อความ preview ด้วยสี/ขนาดที่เลือก)

- [ ] **Step 1:** เขียน `scripts/generate-preset-sounds.ts` (สังเคราะห์ WAV PCM 16-bit mono 44.1kHz ยาว ≤ 1.5 วินาที: chime = sine 880→1320Hz มี decay, coin = สองโน้ต 988/1319Hz, pop = noise burst สั้น 80ms) → Run `pnpm tsx scripts/generate-preset-sounds.ts` → ได้ 3 ไฟล์ใน `public/presets/sounds/`
- [ ] **Step 2:** เขียน integration เทส: `updateAlertOverlay` แล้ว `getAlertOverlayConfig` คืนค่าใหม่; `resetOverlayToken` → token เปลี่ยน, `getOverlayByToken(old)` → null, socket ที่ต่อด้วย token เก่าได้ close 4001; PUT body variant `textColor: 'red'` → 400
- [ ] **Step 3:** Run → FAIL; implement; Run → PASS
- [ ] **Step 4:** ทำ UI; ตรวจด้วย `pnpm preview`: บันทึกแล้ว reload ค่าคงอยู่, reset แล้ว URL เปลี่ยน
- [ ] **Step 5:** Commit `feat: add alert overlay settings, test and reset`

---

### Task 17: Alert overlay (ฝั่ง OBS)

**Files:**
- Create: `src/overlay/backoff.ts`, `src/overlay/queue.ts`, `src/overlay/ws-client.ts`, `src/overlay/AlertPlayer.tsx`, `src/overlay/alert.css`, `src/app/overlay/alert/[token]/page.tsx`, `src/app/overlay/layout.tsx`
- Modify: `src/app/dashboard/overlays/alert/AlertSettingsForm.tsx` (ใช้ `AlertPlayer` เป็น preview)
- Test: `tests/unit/overlay-backoff.test.ts`, `tests/unit/overlay-queue.test.ts`, `tests/e2e/overlay.spec.ts`

**Interfaces:**
- Consumes: `RealtimeEvent`, `AlertVariantRender` (Task 4), `/api/realtime/{token}` (Task 6), `getOverlayByToken` (Task 16)
- Produces:
  - `nextDelay(attempt: number): number` = `min(1000 * 2 ** attempt, 30000)`
  - `createQueue<T>(play: (item: T) => Promise<void>, opts?: { gapMs?: number }): { push(item: T): void; size(): number }` — เล่นทีละรายการตามลำดับ, เว้น `gapMs` (ค่าเริ่มต้น 500), `play` throw → ข้ามไปรายการถัดไป
  - `connectOverlay(opts: { url: string; onEvent: (e: RealtimeEvent) => void; onStatus?: (s: 'open' | 'closed') => void; WebSocketImpl?: typeof WebSocket; setTimeoutImpl?: typeof setTimeout }): { close(): void }` — reconnect ด้วย `nextDelay(attempt)`, รีเซ็ต `attempt = 0` เมื่อ open, ส่ง `'ping'` ทุก 30 วินาที; close code 4001 → **ไม่ reconnect** (token ถูก reset)
  - `<AlertPlayer event={AlertEvent | null} onDone={() => void}>` — render `headline` และ `message` เป็น text node, รูป (onError ซ่อนรูป), เล่นเสียง (`audio.play().catch(() => {})`), class animation `tp-in-${animationIn}` → ค้าง `durationMs` → `tp-out-${animationOut}` (transition 500ms) → `onDone`
  - หน้า `/overlay/alert/[token]`: token ไม่ถูกต้อง → แสดงข้อความเล็ก "Overlay URL ไม่ถูกต้องหรือถูกรีเซ็ตแล้ว"; ถูกต้อง → พื้นหลังโปร่งใส (`html, body { background: transparent }`), ไม่มี MUI, ฟอนต์ Prompt, ต่อ WebSocket `wss?://{host}/api/realtime/{token}`

- [ ] **Step 1:** เขียน unit เทส: `nextDelay(0) === 1000`, `nextDelay(4) === 16000`, `nextDelay(5) === 30000`, `nextDelay(20) === 30000`; queue ด้วย fake timers: push 3 รายการ → `play` ถูกเรียกตามลำดับทีละตัว และไม่ซ้อนกัน; รายการที่ `play` reject → ถัดไปยังเล่น; ws-client ด้วย fake WebSocket: close ปกติ 3 ครั้ง → หน่วง 1000, 2000, 4000; เปิดสำเร็จแล้ว close → กลับไป 1000; close 4001 → ไม่สร้าง socket ใหม่
- [ ] **Step 2:** Run `pnpm vitest run --project unit overlay` → FAIL; implement; Run → PASS
- [ ] **Step 3:** เขียน `tests/e2e/overlay.spec.ts`: เปิด overlay URL (หน้า A) → ในหน้า dashboard กด "ทดสอบ Alert" → หน้า A เห็น `TipPaw โดเนท 100 บาท` และ `นี่คือการทดสอบ alert` ภายใน 5 วินาที แล้วหายไปหลัง durationMs; กด "รีเซ็ต URL" → หน้า A แสดง "Overlay URL ไม่ถูกต้องหรือถูกรีเซ็ตแล้ว" หลัง reload
- [ ] **Step 4:** Run `pnpm playwright test overlay` → PASS
- [ ] **Step 5:** Commit `feat: add alert overlay player with reconnecting websocket`

---

### Task 18: E2E เส้นทางหลักครบวงจร + README deploy

**Files:**
- Create: `tests/e2e/golden-path.spec.ts`, `README.md`
- Modify: `package.json` (scripts: `test`, `test:e2e`, `db:migrate:local`, `db:migrate:remote`, `deploy`)

- [ ] **Step 1:** เขียน `golden-path.spec.ts` ตามสเปกข้อ 8: admin สร้าง invite code ใน CMS → สมัครด้วยโค้ดนั้น → ตั้ง slug → เชื่อมต่อ payout → เปิด overlay URL ในแท็บหนึ่ง → อีกแท็บโดเนทที่ `/{slug}` 100 บาทพร้อมข้อความ → "จำลองชำระสำเร็จ" → overlay แสดงชื่อ/ยอด/ข้อความ → หน้า result แสดงข้อความสำเร็จ → หน้าธุรกรรมมีรายการ → กด "Alert ซ้ำ" → overlay แสดงอีกครั้ง
- [ ] **Step 2:** Run `pnpm test && pnpm test:e2e` → Expected: PASS ทั้งหมด
- [ ] **Step 3:** เขียน README (ไทย): ติดตั้ง, `.dev.vars`, รัน local (`pnpm dev` สำหรับ UI, `pnpm preview` สำหรับทดสอบ realtime/DO), สร้าง D1 (`wrangler d1 create tippaw-db` → ใส่ `database_id`), migrate, `admin:bootstrap-invite --remote` → สมัคร → `admin:promote --remote`, ตั้ง secrets (`wrangler secret put ...` ตามสเปกข้อ 12), ตั้ง Google OAuth redirect `${BETTER_AUTH_URL}/api/auth/callback/google`, deploy (`pnpm deploy`), หมายเหตุ Workers Paid, วิธีสลับเป็น Stripe/Streamlabs จริงในอนาคต (`PAYMENT_PROVIDER`, `MOCK_MODE=false`, URL ของ Streamlabs)
- [ ] **Step 4:** Commit `test: add golden path e2e and deployment README`
