# TipPaw — Design Spec (ภาพรวม + เฟส 1)

- วันที่: 2026-09-28
- สถานะ: รอตรวจทาน
- ขอบเขตเอกสาร: สถาปัตยกรรมภาพรวมของทั้งระบบ + รายละเอียดเฟส 1 (เฟส 2–4 จะมีสเปกย่อยของตัวเอง)

---

## 1. เป้าหมายและบริบท

TipPaw คือเว็บรับโดเนทสำหรับสตรีมเมอร์: ผู้ชมโดเนท/มอบ gift ผ่านหน้าเว็บ → ชำระผ่าน QR → overlay ใน OBS/Streamlabs แสดง alert แบบเรียลไทม์

**เป้าหมายช่วงนี้:** MVP สำหรับใช้เองและทดสอบกับสตรีมเมอร์จำนวนไม่กี่คน — เน้นใช้งานได้จริงเร็ว ไม่เน้น scale

**ข้อจำกัด:**
- ยังเชื่อม Stripe และ Streamlabs API จริงไม่ได้ (ต้องพัฒนาระบบเสร็จก่อนจึงยื่นขอได้) → ส่วนนั้นใช้ **mock** ที่มี interface เหมือนของจริง สลับเป็นของจริงได้โดยไม่แก้ business logic
- Deploy บน Cloudflare, frontend เป็น Next.js

**เกณฑ์ความสำเร็จของ MVP:** สตรีมเมอร์สมัคร → ตั้งหน้า Tip → ใส่ overlay URL ใน OBS → ผู้ชมโดเนท (ผ่าน mock payment) → alert เด้งใน OBS ทันที และรายการขึ้นในหน้าธุรกรรม

## 2. ข้อตัดสินใจหลัก

| เรื่อง | ตัดสินใจ | เหตุผล |
|---|---|---|
| Hosting | Cloudflare Workers ผ่าน `@opennextjs/cloudflare` | `next-on-pages` เลิกพัฒนาแล้ว; OpenNext รัน Node.js runtime, ฟีเจอร์ Next.js ครบกว่า |
| Framework | Next.js (App Router) + TypeScript | frontend + API ใน repo เดียว |
| UI | MUI + Minimal ฟรี (port จาก Vite), ฟอนต์ Prompt, palette ชมพู–ม่วง–คราม (ข้อ 11) | template สำเร็จรูป, ฟรี (MIT) |
| Database | Cloudflare D1 + Drizzle ORM | อยู่ใน Cloudflare, ฟรีสำหรับ MVP |
| Realtime | Durable Object `StreamerRoom` (1 instance/สตรีมเมอร์) + WebSocket Hibernation API | Workers ถือ WebSocket เองไม่ได้; DO เป็นห้องกระจาย event |
| Auth | Better Auth (username plugin, Google, genericOAuth สำหรับ Streamlabs) | รองรับทั้ง 3 วิธี, รันบน Workers ได้ |
| Password hash | PBKDF2 ผ่าน Web Crypto | scrypt แบบ pure JS กิน CPU สูงบน Workers |
| AI TTS (เฟส 2) | Azure AI Speech (ผ่าน adapter) | เสียงไทย neural หลายเสียง, free tier 500K ตัวอักษร/เดือน; Web Speech API ใช้ใน OBS ไม่ได้ |
| สกุลเงิน | THB อย่างเดียว เก็บเป็นสตางค์ (INT) | เลี่ยง floating point |
| แพ็กเกจ Cloudflare | แนะนำ Workers Paid ($5/เดือน) ตอน deploy จริง | Free plan จำกัด CPU 10ms/request ซึ่ง SSR + hash มักเกิน |

## 3. สถาปัตยกรรม

```
Cloudflare Worker (tippaw)
├─ Next.js (OpenNext) ── หน้าเว็บทั้งหมด + API routes
├─ Durable Object: StreamerRoom ── ถือ WebSocket ของ overlay ทุกตัวของสตรีมเมอร์หนึ่งคน
├─ D1 ── ฐานข้อมูลหลัก
└─ Adapters (เลือกผ่าน env)
   ├─ PaymentProvider   → MockPaymentProvider | StripePaymentProvider
   ├─ Streamlabs OAuth  → URL ชี้ /mock/streamlabs/* | Streamlabs จริง
   └─ TtsProvider       → MockTts | AzureTts   (เฟส 2)
```

`worker.ts` เป็น custom entry ที่ห่อ handler ของ OpenNext และ export class `StreamerRoom` เพื่อให้ Worker ตัวเดียวมีทั้ง Next.js และ DO; request `/api/realtime/*` (WebSocket upgrade) ถูกจัดการใน `worker.ts` โดยตรงก่อนถึง Next.js

**ข้อห้าม:** Worker ห้าม fetch HTTP กลับหาตัวเอง (ใช้ไม่ได้บน production) — mock webhook และ mock Streamlabs token/userinfo เรียกฟังก์ชันใน process ตรง

### 3.1 เส้นทาง URL

| Path | หน้าที่ |
|---|---|
| `/login`, `/register` | เข้าสู่ระบบ / สมัคร (ต้องใช้ invite code) |
| `/onboarding` | ใส่ invite code + ตั้ง slug (ผู้ใช้ใหม่ทุกวิธีล็อกอิน) |
| `/dashboard/*` | หลังบ้าน: tip page, profile, transactions, overlays |
| `/admin/*` | Admin CMS: จัดการ invite code, ดูผู้ใช้ (role `admin`) |
| `/{slug}` | หน้า Tip สาธารณะ |
| `/{slug}/gift` | หน้า Gift (เฟส 3) |
| `/{slug}/result?d={donationId}` | ผลการชำระ (สำเร็จ/ไม่สำเร็จ) |
| `/overlay/{type}/{token}` | overlay สำหรับ OBS (`alert`, `gift`, `top`, `recent`, `goal`) |
| `/api/realtime/{token}` | WebSocket upgrade → DO |
| `/api/webhooks/payment` | รับ webhook (mock และ Stripe ใช้ handler เดียวกัน) |
| `/mock/checkout/{sessionId}` | หน้า QR ปลอม (เฉพาะ `MOCK_MODE=true`) |
| `/mock/streamlabs/authorize`, `/mock/streamlabs/token`, `/mock/streamlabs/user` | OAuth ปลอม (เฉพาะ `MOCK_MODE=true`) |

`slug` ต้องไม่ชนกับ path ที่ระบบจองไว้ (`dashboard`, `login`, `register`, `overlay`, `api`, `mock`, `_next` ฯลฯ) รูปแบบ `^[a-z0-9-]{3,30}$`

### 3.2 Flow การโดเนท

1. ผู้ชมกรอกชื่อ/ข้อความ/ยอดที่ `/{slug}` → `POST /api/donations` → สร้าง `donation` สถานะ `pending`
2. เรียก `PaymentProvider.createCheckout({ donationId, amountSatang, streamerAccountId, successUrl, cancelUrl })` → ได้ `{ sessionId, checkoutUrl }` → บันทึก `provider_session_id` → redirect ผู้ชมไป `checkoutUrl`
3. (mock) หน้า `/mock/checkout/{sessionId}` แสดง QR ตัวอย่าง + ปุ่ม "จำลองสำเร็จ" / "จำลองไม่สำเร็จ" → ฝั่ง server ส่ง webhook ที่เซ็น HMAC-SHA256 ไปที่ `/api/webhooks/payment`
4. `PaymentProvider.parseWebhook(request)` ตรวจลายเซ็น → ได้ event มาตรฐาน `{ eventId, type: 'payment.succeeded' | 'payment.failed', sessionId }`
5. `handlePaymentEvent()`: ถ้า `eventId` อยู่ใน `webhook_event` แล้ว → จบ (idempotent); ไม่งั้นอัปเดต donation เป็น `paid`/`failed` + บันทึก `webhook_event` ใน transaction เดียว (D1 batch)
6. ถ้า `paid` และยอด ≥ ขั้นต่ำการแสดง: กรองคำหยาบ (เฟส 2) → `selectVariant()` → `renderTemplate()` → สร้าง `AlertEvent`
7. `publish(streamerId, event)` → DO `StreamerRoom` broadcast ไปทุก WebSocket ที่เชื่อมอยู่
8. Overlay ใส่ event ลงคิว → แสดงทีละรายการ (animation in → ค้างตาม `duration_ms` → animation out)
9. ผู้ชมถูก redirect ไป `/{slug}/result?d={id}` → poll สถานะ donation จนเป็น `paid`/`failed` (timeout 5 นาที) → แสดงข้อความสำเร็จ/ไม่สำเร็จที่ตั้งไว้

ปุ่ม "ทดสอบ alert" และ "alert ซ้ำ" เรียกขั้นที่ 6–7 โดยตรง (ทดสอบใช้ข้อมูลตัวอย่าง, alert ซ้ำใช้ donation เดิม)

**Overlay ออฟไลน์ตอน event เข้า:** event นั้นหาย (ไม่ส่งซ้ำอัตโนมัติ) — สตรีมเมอร์กด alert ซ้ำได้จากหน้าธุรกรรม

### 3.3 Event มาตรฐานที่ส่งผ่าน WebSocket

```ts
type RealtimeEvent =
  | { type: 'alert'; id: string; donorName: string; amountSatang: number; message: string;
      headline: string /* template ที่ render แล้ว */; variant: AlertVariantRender; ttsUrl?: string }
  | { type: 'gift'; id: string; donorName: string; gift: GiftRender }          // เฟส 3
  | { type: 'donation.paid'; donorName: string; amountSatang: number; paidAt: string } // widget เฟส 4
  | { type: 'settings.updated'; overlayType: OverlayType }                      // overlay โหลด settings ใหม่
```

Widget (Top/Recent/Goal) ดึงข้อมูลเริ่มต้นจาก API แล้วอัปเดตจาก `donation.paid`

### 3.4 Interface ของ adapter

```ts
interface PaymentProvider {
  createCheckout(input: CreateCheckoutInput): Promise<{ sessionId: string; checkoutUrl: string }>;
  parseWebhook(req: Request): Promise<PaymentEvent>;          // throw ถ้าลายเซ็นไม่ถูก
  connectAccount(userId: string): Promise<{ externalAccountId: string; onboardingUrl?: string }>;
}

interface TtsProvider {                                        // เฟส 2
  listVoices(): Promise<{ id: string; label: string }[]>;
  synthesize(text: string, voiceId: string): Promise<ArrayBuffer>; // mp3
}
```

`StripePaymentProvider` ในเฟส 1 เป็น stub ที่ throw `NotImplemented` — ใส่ของจริงเมื่อได้สิทธิ์ Stripe Connect (PromptPay)

## 4. Data model (D1 / Drizzle)

ตารางของ Better Auth (`user`, `session`, `account`, `verification`) สร้างตาม schema ของ library (+ `username`, + `role` ('admin'|'streamer') ผ่าน admin plugin)

```
invite_code             สร้าง/จัดการจาก Admin CMS
  code PK, note, max_uses INT (NULL = ไม่จำกัด), used_count INT DEFAULT 0,
  expires_at NULL, disabled_at NULL, created_by FK user, created_at

invite_redemption
  user_id PK/FK (1 คนใช้ได้ 1 ครั้ง), code FK, redeemed_at

streamer_profile        1:1 user
  user_id PK/FK, slug UNIQUE, created_at

tip_page                1:1 user
  user_id PK/FK, channel_name, links JSON [{label, url}],
  theme, banner_url, background_url, body_json (TipTap JSON),
  success_message, failure_message

payout_account
  user_id PK/FK, provider ('mock'|'stripe'), external_account_id,
  status ('pending'|'active')

donation
  id PK, streamer_id FK, kind ('tip'|'gift'), gift_type_id FK NULL,
  donor_name, message_raw, amount_satang INT,
  status ('pending'|'paid'|'failed'), provider, provider_session_id UNIQUE,
  created_at, paid_at
  INDEX (streamer_id, status, paid_at)

webhook_event
  provider_event_id PK, received_at

overlay                 1 แถว / (สตรีมเมอร์, ประเภท)
  id PK, streamer_id FK, type ('alert'|'gift'|'top'|'recent'|'goal'),
  token UNIQUE, settings JSON, updated_at
  UNIQUE (streamer_id, type)

alert_variant
  id PK, streamer_id FK, name, min_amount_satang, weight INT,
  message_template, text_color, font_family, font_size, image_url, sound_url,
  animation_in, animation_out, duration_ms, tts_enabled, tts_voice, sort_order

gift_type               (เฟส 3)
  id PK, streamer_id FK, name, amount_satang, image_url, sound_url,
  preset_key NULL, sort_order

profanity_word          (เฟส 2) คลังกลาง seed ไทย/อังกฤษ
  word PK, lang ('th'|'en')

custom_profanity_word   (เฟส 2)
  streamer_id FK, word, PK (streamer_id, word)
```

**กติกา:**
- `overlay.settings` เป็น JSON ตรวจด้วย Zod schema แยกตาม `type` (เช่น alert: `{ minAmountSatang, minTtsAmountSatang, profanityFilter }`; goal: `{ targetSatang, startAt, endAt, cssPreset, customCss, ... }`)
- ข้อความที่แสดงคำนวณตอนสร้าง event จาก `message_raw` (ตัวกรองคำหยาบล่าสุดจึงมีผลกับ alert ซ้ำด้วย) — **แก้จาก draft เดิม:** ไม่เก็บ `message_display` แยก
- `selectVariant(variants, amount, rng)`: เลือก variant ที่ `min_amount_satang ≤ amount` → เอาเฉพาะ tier ที่ `min_amount_satang` สูงสุด → สุ่มตาม `weight` (ถ้า weight รวมเป็น 0 ให้เลือกแบบเท่ากัน) → ไม่มี variant ผ่าน = ไม่แสดง alert
- Template รองรับตัวแปร `{name}`, `{amount}`, `{message}` — escape เป็น text เสมอ (ไม่ render HTML)
- Top donator / Goal คำนวณด้วย `SUM(amount_satang)` จาก `donation` ที่ `paid` ตามช่วงเวลา, group ตาม `donor_name`
- ผู้ชมไม่มีบัญชี; "จดจำชื่อ" เก็บใน `localStorage` ของเบราว์เซอร์ผู้ชม

## 5. Auth และความปลอดภัย

### Auth
- **Local:** username + password (username plugin); ฟอร์มสมัครมีช่อง invite code
- **Google:** OAuth จริง (Google Cloud โหมด Testing, ≤100 test users); อีเมลตรงกับบัญชีเดิม → ผูกบัญชีเดียวกัน
- **Streamlabs:** `genericOAuth` — authorize/token/userinfo URL, client id/secret มาจาก env; ตอนนี้ชี้ `/mock/streamlabs/*` (หน้าจำลองการอนุญาต ให้เลือก/กรอกชื่อผู้ใช้ Streamlabs ปลอม)
- **Onboarding (`/onboarding`):** ผู้ใช้ที่ยังไม่มี `invite_redemption` หรือ `streamer_profile` ถูกบังคับเข้าหน้านี้ก่อนเข้า dashboard ทุกครั้ง (ตรวจใน server layout ของ dashboard + API guard)
  1. ใส่ invite code (ข้ามได้ถ้าสมัคร local และใส่โค้ดถูกแล้วตอนสมัคร) — ใช้กับ **ทุกวิธีล็อกอิน** รวม Google/Streamlabs เพราะ OAuth สร้างบัญชีได้โดยไม่ผ่านฟอร์มสมัคร
  2. ตั้ง `slug`
- **Redeem invite code:** ตรวจ `disabled_at IS NULL`, ยังไม่หมดอายุ, `used_count < max_uses` → เพิ่ม `used_count` แบบมีเงื่อนไข (`UPDATE ... WHERE used_count < max_uses`) + insert `invite_redemption` ใน D1 batch เดียว กันการใช้เกินโควตาเมื่อสมัครพร้อมกัน; โค้ดไม่ถูกต้องตอบข้อความเดียวกันทุกกรณี (ไม่บอกว่าผิดเพราะอะไร) + rate limit ต่อ IP
- **Admin:** role `admin` เท่านั้นเข้า `/admin/*` ได้ (ตรวจทั้ง middleware และทุก API); admin คนแรก: `pnpm admin:bootstrap-invite` สร้าง invite code ใช้ได้ 1 ครั้ง → สมัครด้วยโค้ดนั้น → `pnpm admin:promote <username>` (ทั้งสองรัน `wrangler d1 execute` ได้ทั้ง local/remote) — ไม่มีทางเป็น admin ผ่านเว็บเอง; admin ข้าม invite code ได้

### Admin CMS (`/admin`, เฟส 1)
- **Invite codes:** ตาราง (โค้ด, หมายเหตุ, ใช้แล้ว/โควตา, วันหมดอายุ, สถานะ, สร้างเมื่อ)
  - สร้างโค้ด: สุ่มอัตโนมัติ (8 ตัว A–Z0–9 ไม่มีตัวที่สับสน เช่น O/0, I/1) หรือพิมพ์เอง (`^[A-Z0-9-]{4,32}$`, เก็บเป็นตัวพิมพ์ใหญ่), ตั้งหมายเหตุ, โควตา, วันหมดอายุ
  - ปิด/เปิดโค้ด (soft disable — ไม่ลบเพื่อเก็บประวัติ), คัดลอกโค้ด/ลิงก์สมัคร `/register?code=XXXX`
  - ดูรายชื่อผู้ใช้ที่ใช้โค้ดนั้น
- **Users (อ่านอย่างเดียว):** รายชื่อผู้ใช้, slug, วิธีล็อกอิน, โค้ดที่ใช้, วันที่สมัคร

### ความปลอดภัย
- **Overlay token:** สุ่ม 32 bytes (base64url); reset → ออก token ใหม่ + DO ปิด socket ของ token เก่า (socket แนบ token ไว้ใน attachment)
- **Webhook:** ตรวจลายเซ็นทุกครั้ง (mock: HMAC-SHA256 + `MOCK_WEBHOOK_SECRET` + timestamp ภายใน 5 นาที; Stripe: `constructEventAsync`); ยอดเงินอ้างจาก donation ใน DB เท่านั้น
- **Input:** Zod ทุก endpoint — ชื่อ ≤50, ข้อความ ≤200 ตัวอักษร, ยอด `MIN_DONATION_THB`–`MAX_DONATION_THB` (ค่าเริ่มต้น 10–10,000)
- **Rate limit:** `POST /api/donations` จำกัดต่อ IP ด้วย Workers Rate Limiting binding (ค่าเริ่มต้น 10 ครั้ง/นาที)
- **Text editor:** เก็บ TipTap JSON, render เฉพาะ node/mark ที่อนุญาต (paragraph, heading, bold, italic, link, list); link ต้องเป็น `https://`
- **URL รูป/เสียง:** รับเฉพาะ `https://`, ใช้ใน `<img>` / `<audio>` เท่านั้น
- **Custom CSS (Goal, เฟส 4):** ใช้เฉพาะในหน้า overlay; ตัด `</style`, `@import`, `url(javascript:` ออก
- **Mock routes:** `MOCK_MODE !== 'true'` → `/mock/*` ตอบ 404
- **Dashboard API:** ทุก endpoint ตรวจ session และจำกัดให้แก้ได้เฉพาะข้อมูลของตนเอง

## 6. การจัดการ error

| สถานการณ์ | พฤติกรรม |
|---|---|
| ชำระไม่สำเร็จ / ยกเลิก | donation → `failed`; หน้า result แสดง `failure_message` |
| ผู้ชมปิดหน้า checkout ไปเลย | donation ค้าง `pending`; ไม่แสดงในรายการธุรกรรม (แสดงเฉพาะ `paid`) |
| Webhook ประมวลผลพัง | ตอบ 5xx ให้ provider retry; idempotency กันซ้ำ |
| ลายเซ็น webhook ไม่ถูก | ตอบ 400, log |
| `publish()` ไป DO ล้มเหลว | ไม่ทำให้ webhook fail (เงินเข้าแล้ว); log ไว้; แก้ด้วย alert ซ้ำ |
| Overlay หลุด | reconnect อัตโนมัติ exponential backoff (1s → สูงสุด 30s) |
| รูป/เสียงโหลดไม่ได้, TTS ล้ม | แสดง alert ต่อ ข้ามส่วนที่ล้ม |
| slug ซ้ำ/เป็นคำจอง | ตอบ 409 พร้อมข้อความ |

## 7. โครงสร้างโปรเจกต์

```
tippaw/
├─ worker.ts                  custom entry: OpenNext handler + export StreamerRoom
├─ wrangler.jsonc             bindings: DB (D1), STREAMER_ROOM (DO), DONATION_RATE_LIMITER, INVITE_RATE_LIMITER, vars
├─ open-next.config.ts
├─ drizzle/                   migrations
├─ scripts/admin-promote.ts   ตั้ง role admin ผ่าน wrangler d1 execute
├─ public/presets/sounds/     เสียง preset ของ alert
├─ src/
│  ├─ app/                    routes: (auth), dashboard, [slug], overlay, api, mock
│  ├─ components/
│  ├─ ui/minimal/             theme, layouts, components ที่ port จาก Minimal ฟรี
│  ├─ server/
│  │  ├─ env.ts               อ่าน bindings/vars ผ่าน getCloudflareContext
│  │  ├─ db/                  schema.ts, client.ts
│  │  ├─ auth/                auth.ts (Better Auth), pbkdf2.ts
│  │  ├─ payments/            types.ts, mock.ts, stripe.ts (stub), index.ts (เลือกตาม env)
│  │  ├─ realtime/            streamer-room.ts (DO), publish.ts
│  │  ├─ alerts/              select-variant.ts, render-template.ts, build-event.ts
│  │  ├─ donations/           create-donation.ts, handle-payment-event.ts
│  │  ├─ overlays/            token.ts, settings-schemas.ts
│  │  ├─ invites/             generate-code.ts, redeem.ts, admin CRUD
│  │  └─ moderation/          (เฟส 2)
│  └─ overlay/                ฝั่ง client: ws-client.ts, queue.ts, AlertPlayer.tsx
└─ tests/
   ├─ unit/
   ├─ integration/            @cloudflare/vitest-pool-workers
   └─ e2e/                    Playwright
```

API route ทำแค่: ตรวจ session → ตรวจ input (Zod) → เรียก service ใน `server/` → แปลงผลเป็น response

## 8. การทดสอบ

- **Unit (Vitest):** `selectVariant` (tier, weight, weight=0, ไม่มี variant ผ่าน — ใช้ rng ที่ inject ได้), `renderTemplate` (escape), ตรวจลายเซ็น mock webhook (ถูก/ผิด/หมดอายุ), Zod schemas, ตรวจ slug
- **Integration (miniflare ผ่าน vitest-pool-workers):**
  - webhook สำเร็จ → donation `paid` + DO ได้รับ event
  - webhook ซ้ำ → ไม่อัปเดตซ้ำ, ไม่ publish ซ้ำ
  - webhook failed → donation `failed`, ไม่ publish
  - reset token → socket เก่าถูกปิด, token เก่าเชื่อมใหม่ไม่ได้
  - ยอดต่ำกว่าขั้นต่ำ → ไม่ publish alert
- **Invite code (integration):** โค้ดถูก/ผิด/หมดอายุ/ถูกปิด/เต็มโควตา; redeem พร้อมกัน 2 คนบนโควตาเหลือ 1 → สำเร็จ 1 คน; ผู้ใช้ OAuth ที่ยังไม่ redeem เข้า dashboard ไม่ได้; non-admin เรียก `/admin` API → 403
- **E2E (Playwright, `MOCK_MODE=true`):** admin สร้าง invite code ใน CMS → สมัครด้วยโค้ดนั้น → ตั้ง slug → เปิด overlay URL ในแท็บหนึ่ง → อีกแท็บโดเนทที่ `/{slug}` → กด "จำลองสำเร็จ" → ตรวจ alert ใน overlay + หน้า result + รายการในธุรกรรม → กด alert ซ้ำ → alert แสดงอีกครั้ง

## 9. แผนเฟส

| เฟส | เนื้อหา |
|---|---|
| **1 — Vertical slice** | (รายละเอียดข้อ 10) |
| **2 — Alert เต็มรูปแบบ** | หลาย variant + สุ่ม %, Google Fonts, Azure TTS (เปิด/ปิด, เลือกเสียง, ขั้นต่ำ), ตัวกรองคำหยาบไทย/อังกฤษ + คำที่เพิ่มเอง, QR code ของ URL หน้า Tip |
| **3 — Gift** | หน้า Gift, gift overlay สไตล์ TikTok, gift type หลายแบบ + preset 5 แบบ (รูป/เสียง), ปุ่มทดสอบ/reset, รายการ gift ในธุรกรรม |
| **4 — Widgets + ตกแต่ง** | Top donator, Recent donate, Donate goal (+ CSS preset 3 แบบ), ธีมสี, banner, text editor, ภาพพื้นหลัง, รายชื่อเว็บฝากรูป/เสียงที่แนะนำ (ตรวจ hotlink ใน OBS ก่อน) |

## 10. ขอบเขตเฟส 1

**รวม:**
- Auth: local, Google จริง, Streamlabs mock; หน้า onboarding (invite code + slug)
- Admin CMS: จัดการ invite code (สร้าง/ปิด/โควตา/หมดอายุ/ดูผู้ใช้โค้ด), รายชื่อผู้ใช้; สคริปต์ `admin:promote`
- Profile: แก้ slug; ผูกช่องทางรับเงิน mock (กด "เชื่อมต่อ" → `active`); ถ้ายังไม่ active หน้า Tip แสดง "ยังไม่เปิดรับโดเนท"
- Tip page settings (พื้นฐาน): ชื่อช่อง, ลิงก์หลายช่องทาง, ข้อความสำเร็จ/ไม่สำเร็จ
- หน้า Tip สาธารณะ: แสดงชื่อช่อง + ลิงก์, ฟอร์ม ชื่อ + checkbox จดจำชื่อ + ข้อความ + ยอด → ชำระ
- Mock payment: หน้า QR ปลอม, webhook HMAC, หน้า result
- Transactions: รายการโดเนท `paid` (วันที่, ชื่อ, ยอด, ข้อความ) เรียงใหม่สุดก่อน แบ่งหน้า 50 รายการ, ปุ่ม alert ซ้ำ
- Alert overlay (1 variant ต่อสตรีมเมอร์ — UI แสดงแบบเดียว แต่ใช้ตาราง `alert_variant`):
  - URL + คัดลอก, ปุ่มทดสอบ, ปุ่ม reset URL
  - message template, สีข้อความ (Hex + color picker), ขนาด font (font ระบบ, Google Fonts เฟส 2)
  - รูปจาก URL, เสียงจาก URL + preset 3 เสียง
  - animation: fade, slide-up, slide-down, zoom; กำหนดระยะเวลาแสดง
  - ขั้นต่ำยอดที่จะแสดง alert
  - แสดงชื่อ/ยอด/ข้อความจากหน้าโดเนท
- Deploy: `wrangler.jsonc`, migration D1, README วิธีรัน local และ deploy

**ไม่รวม (เฟสถัดไป):** ทุกอย่างในตารางเฟส 2–4

## 11. UI & Design system

### Template และ component library
- ใช้ **Minimal แบบฟรี** ([minimal-ui-kit/material-kit-react](https://github.com/minimal-ui-kit/material-kit-react), MIT) บน **MUI**
- ตัวฟรีเป็น **Vite + React Router** (เวอร์ชัน Next.js มีเฉพาะ Pro) → **port** เข้า Next.js App Router:
  - คัดลอก `theme/`, `layouts/` (dashboard: nav, header), `components/` (iconify, label, scrollbar ฯลฯ) มาไว้ที่ `src/ui/minimal/` พร้อมใส่ LICENSE/attribution
  - เปลี่ยน React Router (`Link`, `useNavigate`, `useLocation`) → `next/link`, `next/navigation`
  - ใช้ `@mui/material-nextjs` (`AppRouterCacheProvider`) สำหรับ Emotion SSR; component ที่ใช้ MUI เป็น Client Component ตามจำเป็น
  - ส่วนที่ template ฟรีไม่มี (ฟอร์มขั้นสูง, color picker, uploader แบบ URL ฯลฯ) เขียนเพิ่มด้วย MUI ในสไตล์เดียวกัน
  - ตัดหน้าตัวอย่าง (products, blog, users) ทิ้ง
- ใช้ MUI กับ **dashboard, หน้า auth, หน้า Tip, หน้า Gift, หน้า mock** เท่านั้น
- **Overlay ไม่ใช้ MUI** — React + CSS ล้วน (CSS variables จาก settings) เพื่อให้โหลดเร็วและเบาใน OBS browser source; พื้นหลังโปร่งใส
- โหมดมืดของ dashboard: ไม่อยู่ในขอบเขต MVP (template ฟรีไม่มี)

### Palette

| Token | Hex | ใช้กับ |
|---|---|---|
| `primary.lighter` | `#E7D6E3` | พื้นหลังจาง, selected state (ค่าคำนวณจาก `#AF719D`) |
| `primary.light` | `#AF719D` | hover, ไอคอนรอง |
| `primary.main` | `#8B639B` | ปุ่มหลัก, ลิงก์, active nav (ตัวอักษรขาว ~4.8:1) |
| `primary.dark` | `#403D88` | หัวข้อ, sidebar, ข้อความเน้น (ตัวอักษรขาว ~9.4:1) |
| `primary.darker` | `#2A2860` | pressed state (ค่าคำนวณจาก `#403D88`) |
| `secondary.main` | `#F8B2B2` | highlight, badge, hero/การ์ดเด่นบนหน้า Tip |
| `secondary.contrastText` | `#403D88` | ตัวอักษรบนพื้นชมพู (ห้ามใช้ตัวขาวบน `#F8B2B2`) |

สีสถานะ (success/warning/error/info) และ grey ใช้ค่าเดิมของ Minimal

### Typography
- ฟอนต์ **Prompt** (Google Fonts, weight 100–900 + italic, subset `thai` + `latin`) โหลดผ่าน `next/font/google` (self-host ตอน build) แทนฟอนต์เดิมของ template — ตั้งเป็น `typography.fontFamily` ของ MUI theme
- ค่าเริ่มต้น: body 400, หัวข้อ 600–700
- Overlay ใช้ Prompt เป็นค่าเริ่มต้น; เฟส 2 เลือก Google Font อื่นได้

## 12. Environment variables

| ชื่อ | ใช้ทำอะไร |
|---|---|
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Better Auth |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `STREAMLABS_CLIENT_ID`, `STREAMLABS_CLIENT_SECRET`, `STREAMLABS_AUTHORIZE_URL`, `STREAMLABS_TOKEN_URL`, `STREAMLABS_USERINFO_URL` | Streamlabs (mock/จริง) |
| `MOCK_MODE` | `true` = เปิด mock routes + ใช้ MockPaymentProvider |
| `PAYMENT_PROVIDER` | `mock` \| `stripe` |
| `MOCK_WEBHOOK_SECRET` | เซ็น webhook ของ mock |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | (อนาคต) |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | (เฟส 2) |
| `MIN_DONATION_THB`, `MAX_DONATION_THB` | ขอบเขตยอดโดเนท |
