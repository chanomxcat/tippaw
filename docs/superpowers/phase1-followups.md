# TipPaw เฟส 1 — งานค้างที่ยกไปทำทีหลัง

สรุปจากรีวิวรายงานและรีวิวรวมทั้ง branch (2026-09-29) — ทุกข้อไม่บล็อกการใช้งานเฟส 1 (โหมด mock)

## ต้องแก้ก่อนเปลี่ยนไปใช้ Stripe จริง
- `handlePaymentEvent` (`src/server/donations/handle-payment-event.ts`): webhook ที่ไม่ตรงกับ donation ที่ `pending` ยังถูกบันทึก event id ไว้ถาวร — ถ้า provider retry ด้วย id เดิมหลังจากตั้ง session id แล้ว donation จะเปลี่ยนเป็น `paid` โดยไม่ส่ง alert. แก้: ให้ UPDATE ทำงานเฉพาะเมื่อ insert event สำเร็จ หรือไม่บันทึก event ที่ไม่ match
- เพิ่มเทส error path ของ webhook: publish ล้ม → 200 + `published:false`; error อื่น → 500; session ไม่พบ → ignored
- JSON เสียหลังลายเซ็นถูกต้องตอบ 400 (ควรเป็น 500 ให้ provider retry)
- `StripePaymentProvider` ยังเป็น stub

## ควรทำเร็ว ๆ นี้
- เทส integration ของ `handleOnboarding` / `handleRegister` (400/409/429, forward cookie, ไม่สร้าง user เมื่อ invite ผิด)
- `updateSlug` / onboarding ส่งพร้อมกัน → unique constraint โยน 500 แทน `slug_taken`/`ok`
- `POST /api/auth/sign-up/email` (placeholder email) ข้าม invite rate limiter — จำกัดให้เรียกผ่าน `/api/register` เท่านั้น
- ฟังก์ชันช่วยเทส auth (`cookieHeader`, `signUpAndSignIn`) ยังซ้ำใน `admin-api.test.ts`, `auth.test.ts`, `profile.test.ts`
- `MaxListenersExceededWarning` ใน output ของ vitest

## รอได้
- `fontFamily` เป็น literal `'Prompt'` — เฟส 2 (Google Fonts) ต้องขยาย
- หน้า result ไม่ผูก `?d=` กับ slug; ResultPoller ใช้ `setInterval` แบบ async อาจซ้อน; หน้า Tip query D1 สองครั้งต่อ render
- หน้าธุรกรรม `?page=` เกินจำนวนหน้าแสดงข้อความ "ยังไม่มีรายการโดเนท"
- Invite code: `createInvite` ตรวจซ้ำแบบ SELECT-then-INSERT; หน้า detail แสดงแค่ผู้ใช้
- Google `clientSecret` ค่าเริ่มต้นเป็น `""`; สร้าง auth instance ใหม่ทุกครั้งที่ตรวจ session
- สี `secondary.lighter/light/dark/darker` คำนวณเอง (สเปกระบุแค่ main/contrastText); โลโก้เป็น placeholder; Iconify โหลดไอคอนจาก API ตอน runtime
- enum `provider` ไม่มี CHECK constraint ใน DB
