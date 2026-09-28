# TipPaw

แพลตฟอร์มรับโดเนทสำหรับสตรีมเมอร์ไทย — Next.js (App Router) รันบน Cloudflare Workers ผ่าน `@opennextjs/cloudflare`, ฐานข้อมูล Cloudflare D1, realtime alert ผ่าน Durable Object + WebSocket

สเปกฉบับเต็ม: [`docs/superpowers/specs/2026-09-28-tippaw-design.md`](docs/superpowers/specs/2026-09-28-tippaw-design.md)

## 1. ติดตั้ง

```bash
npm install
```

ต้องมี [Node.js](https://nodejs.org/) และบัญชี Cloudflare (ฟรีก็เริ่มได้ ดูหมายเหตุ Workers Paid ด้านล่าง) พร้อม `npx wrangler login` ล็อกอินไว้ก่อนขั้นตอนที่ต้องใช้ `--remote`

## 2. ตั้งค่า `.dev.vars`

คัดลอกไฟล์ตัวอย่างแล้วแก้ค่า:

```bash
cp .dev.vars.example .dev.vars
```

`.dev.vars` ถูก gitignore ไว้แล้ว **ห้าม commit**. ค่าเริ่มต้นในไฟล์ตัวอย่างตั้งเป็นโหมด mock ไว้ทั้งหมด (`MOCK_MODE=true`, `PAYMENT_PROVIDER=mock`, Streamlabs ชี้ไปที่ `/mock/streamlabs/*` ในเครื่องตัวเอง) — รันแบบนี้ได้เลยโดยไม่ต้องมี Stripe/Streamlabs จริง มีแค่ `BETTER_AUTH_SECRET` ที่ควรสุ่มใหม่ (เช่น `openssl rand -base64 32`)

ตัวแปรครบทุกตัว (ตามสเปกข้อ 12) อยู่ในหมายเหตุ `.dev.vars.example` — ปล่อยว่างได้สำหรับ `GOOGLE_CLIENT_ID`/`STRIPE_*`/`AZURE_*` ถ้ายังไม่ใช้ฟีเจอร์นั้น

## 3. รัน local

สองโหมด แล้วแต่ว่าต้องการทดสอบอะไร:

- **`npm run dev`** — Next dev server ธรรมดา (เร็ว, hot reload) พอสำหรับแก้ UI ทั่วไป **D1 ใช้งานได้จริง** ในโหมดนี้ด้วย (ผ่าน `initOpenNextCloudflareForDev()` ใน `next.config.ts`) แต่ **Durable Object (realtime alert ผ่าน WebSocket) ยังไม่ทำงาน**
- **`npm run preview`** — build ด้วย OpenNext แล้วรันผ่าน `wrangler dev` (จำลอง Workers runtime จริงในเครื่องครบทุกส่วน: D1 local, Durable Object, rate limiting) — ใช้โหมดนี้เวลาต้องทดสอบ overlay/alert แบบ end-to-end หรือก่อน deploy จริง ที่ `http://localhost:8787`

ก่อนใช้ D1 ครั้งแรก (ทั้ง `dev` และ `preview`) ต้องสร้างตารางในเครื่องก่อน (ข้อ 5)

## 4. สร้างฐานข้อมูล D1

```bash
npx wrangler d1 create tippaw-db
```

คำสั่งจะพิมพ์ `database_id` ออกมา — เอาไปใส่ใน `wrangler.jsonc` แทน `<ใส่หลังสร้าง>`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "tippaw-db",
    "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", // <-- ใส่ตรงนี้
    "migrations_dir": "drizzle"
  }
]
```

## 5. Migrate

```bash
npm run db:migrate:local     # ฐานข้อมูล local (สำหรับ npm run dev / npm run preview)
npm run db:migrate:remote    # ฐานข้อมูลจริงบน Cloudflare (ก่อน deploy ครั้งแรก และทุกครั้งที่มี migration ใหม่)
```

(`npm run db:generate` ใช้ตอนแก้ `src/server/db/schema.ts` แล้วต้องการสร้างไฟล์ migration ใหม่ใน `drizzle/` — ไม่ต้องรันตอน setup ครั้งแรก)

## 6. Bootstrap แอดมินคนแรก

เว็บไม่มีทางสมัครเป็น admin ได้เอง ต้องทำผ่าน CLI 3 ขั้นตอน:

```bash
# 1) สร้าง invite code ใช้ได้ครั้งเดียว (ไม่ต้องมี admin อยู่ก่อน)
npm run admin:bootstrap-invite -- --remote
# พิมพ์โค้ดออกมา เช่น K7XQPWT2

# 2) เปิดเว็บที่ deploy แล้ว (หรือ preview local) แล้วสมัครสมาชิกด้วยโค้ดนั้นตามปกติ
#    /register?code=K7XQPWT2 -> ตั้ง username/password -> ตั้ง slug

# 3) เลื่อน username ที่เพิ่งสมัครให้เป็น admin
npm run admin:promote -- <username> --remote
```

ทำงานกับฐานข้อมูล local ได้เหมือนกันโดยตัด `--remote` ออก (ใช้ตอนพัฒนา/ทดสอบ)

จากนั้น admin คนนี้เข้า `/admin/invites` เพื่อสร้าง invite code เพิ่มให้สตรีมเมอร์คนอื่นได้เอง (ไม่ต้องใช้ CLI อีก)

## 7. `BETTER_AUTH_URL` และ secrets

**ก่อน deploy ต้องตั้ง `BETTER_AUTH_URL` ก่อนเสมอ** — ไม่ใช่ความลับ แต่ `wrangler.jsonc`'s `vars` ที่ commit ไว้มีแค่ `MOCK_MODE`/`PAYMENT_PROVIDER`/`MIN_DONATION_THB`/`MAX_DONATION_THB` (ค่าที่เหมือนกันทุกเครื่อง) ไม่มี `BETTER_AUTH_URL` เพราะขึ้นกับโดเมนที่ deploy จริงของแต่ละคน **ลืมขั้นตอนนี้แล้ว deploy ไปเลยจะได้ worker ที่ auth พัง (baseURL ผิด) และ URL ของ checkout/result/overlay เป็น `undefined/...`**

โดเมนจะเป็นรูปแบบ `https://<worker-name>.<your-subdomain>.workers.dev` (`<worker-name>` คือ `name` ใน `wrangler.jsonc`, ปัจจุบันคือ `tippaw`; `<your-subdomain>` คือ workers.dev subdomain ของบัญชี Cloudflare — ดูได้จาก Cloudflare dashboard หรือรอดู URL ที่ `wrangler deploy` พิมพ์ออกมาหลัง deploy ครั้งแรกก็ได้) เลือกวิธีใดวิธีหนึ่ง:

- เพิ่มเป็น `vars` ใน `wrangler.jsonc` (แก้ไฟล์นี้ในเครื่องตัวเอง เหมือนที่แก้ `database_id`):
  ```jsonc
  "vars": {
    "BETTER_AUTH_URL": "https://tippaw.<your-subdomain>.workers.dev",
    // ...ตัวแปรเดิม
  }
  ```
- หรือตั้งเป็น secret แทน: `npx wrangler secret put BETTER_AUTH_URL`

`.dev.vars` ใช้แค่ตอนรัน local — secrets ที่เหลือ (ความลับจริง) ต้องตั้งแยกด้วย `wrangler secret put` (ค่าที่ใส่จะไม่ปรากฏใน `wrangler.jsonc`/repo):

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put STREAMLABS_CLIENT_ID
npx wrangler secret put STREAMLABS_CLIENT_SECRET
npx wrangler secret put MOCK_WEBHOOK_SECRET
```

### Google OAuth

สร้าง OAuth client ใน Google Cloud Console (โหมด **Testing**, ≤100 test users พอสำหรับ MVP) แล้วตั้ง **Authorized redirect URI** เป็น:

```
${BETTER_AUTH_URL}/api/auth/callback/google
```

เช่น `https://tippaw.<your-subdomain>.workers.dev/api/auth/callback/google` — ต้องตรงกับค่า `BETTER_AUTH_URL` ที่ตั้งไว้ข้างบนเป๊ะๆ

### Streamlabs

เฟส 1 นี้ยังไม่ต่อ Streamlabs จริง — ปุ่ม "เข้าสู่ระบบด้วย Streamlabs" ชี้ไปที่หน้าจำลอง `/mock/streamlabs/authorize` เสมอเมื่อ `MOCK_MODE=true` (ดูหัวข้อ 9 ด้านล่างสำหรับวิธีสลับเป็นของจริงในอนาคต) redirect URI ของฝั่ง Streamlabs เมื่อนั้นจะเป็น:

```
${BETTER_AUTH_URL}/api/auth/callback/streamlabs
```

## 8. Deploy

```bash
npm run deploy
```

(เทียบเท่า `opennextjs-cloudflare build && opennextjs-cloudflare deploy`) — รันหลังตั้ง `database_id` (ข้อ 4), migrate remote (ข้อ 5), และตั้ง secrets ครบแล้ว (ข้อ 7)

`npm run build` อย่างเดียว (ไม่ deploy) ใช้เพื่อตรวจว่า build ผ่านก่อน push/CI

### หมายเหตุ Workers Paid

Cloudflare Workers แผนฟรีจำกัด CPU **10ms ต่อ request** ซึ่ง SSR ของ Next.js บวกกับ PBKDF2 password hashing มักใช้เกินขอบเขตนี้ในการใช้งานจริง — แนะนำอัปเกรดเป็น **Workers Paid ($5/เดือน)** ก่อนเปิดให้ผู้ใช้จริงเข้าใช้งาน (พัฒนา/ทดสอบในเครื่องด้วย `npm run preview` ไม่ติดข้อจำกัดนี้)

## 9. สลับไปใช้ Stripe/Streamlabs จริง (อนาคต)

เฟส 1 ใช้ mock ทั้งการชำระเงินและ Streamlabs OAuth เป็นค่าเริ่มต้น เมื่อพร้อมใช้ของจริง:

- **Stripe:** `src/server/payments/stripe.ts` **ยังเป็นแค่ stub ในเฟสนี้** (โครงพร้อมสลับ แต่ยังไม่ได้ implement การเรียก Stripe API จริง) — ต้อง implement ให้ครบก่อน แล้วตั้ง:
  - `PAYMENT_PROVIDER=stripe` (ใน `vars` ของ `wrangler.jsonc`)
  - `MOCK_MODE=false` (ปิด `/mock/*` และ `/api/mock/*` — ตอบ 404 ทันทีที่ปิด)
  - secret `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (`npx wrangler secret put ...`)
- **Streamlabs:** เมื่อได้ client id/secret จริงจาก Streamlabs API แล้ว ตั้ง `STREAMLABS_AUTHORIZE_URL`, `STREAMLABS_TOKEN_URL`, `STREAMLABS_USERINFO_URL` ให้ชี้ไป endpoint จริงของ Streamlabs (แทนที่ `/mock/streamlabs/*` ในเครื่อง) พร้อม secret `STREAMLABS_CLIENT_ID`, `STREAMLABS_CLIENT_SECRET` จริง — ไม่ต้องแก้โค้ด เพราะ auth ใช้ `genericOAuth` อยู่แล้ว แค่เปลี่ยนตัวแปรที่ปลายทาง

ปิด `MOCK_MODE` แล้ว golden-path e2e test (`tests/e2e/golden-path.spec.ts`) และสเปกอื่นใน `tests/e2e/` จะใช้งานไม่ได้ (พึ่งพา `/mock/*` routes) — ให้รันเฉพาะ unit/integration test แทนถ้าต้อง CI กับของจริง

## 10. ตั้งค่า OBS (alert overlay)

1. ล็อกอินเข้า dashboard สตรีมเมอร์ → `/dashboard/overlays/alert` → กด "แสดง URL" แล้วคัดลอก Overlay URL (รูปแบบ `${BETTER_AUTH_URL}/overlay/alert/<token>`)
2. ใน OBS: เพิ่ม Source ใหม่ → **Browser** → วาง URL ที่คัดลอกมา → ตั้งขนาด **Width 800 / Height 600** (ปรับได้ตามพื้นที่ที่ต้องการวางบนหน้าจอ พื้นหลังโปร่งใสอยู่แล้ว)
3. กด "ทดสอบ Alert" ในหน้า dashboard เพื่อตรวจว่า overlay ใน OBS แสดงผลถูกต้อง
4. ถ้า URL หลุดหรือมีคนอื่นเอาไปใช้ กด "รีเซ็ต URL" ในหน้าเดียวกัน — URL เดิมใช้ไม่ได้ทันที ต้องอัปเดต Browser source ใน OBS ใหม่ด้วย URL ที่รีเซ็ตแล้ว

## 11. ทดสอบ

```bash
npm test          # unit + integration (vitest)
npm run test:e2e  # end-to-end (Playwright, ใช้ MOCK_MODE=true, สร้าง preview server ของตัวเองอัตโนมัติ)
```

`test:e2e` รีเซ็ตฐานข้อมูล local, สลับ `.dev.vars` ไปใช้ค่าของ E2E ชั่วคราวระหว่างรัน แล้วคืนค่าเดิมให้เมื่อจบ (ดู `tests/e2e/global-setup.ts`) — ปลอดภัยที่จะรันซ้ำได้เรื่อยๆ โดยไม่กระทบ `.dev.vars` จริงของเครื่อง
