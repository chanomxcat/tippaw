/**
 * Thai copy for API error codes (`{ error: string }` responses), shared
 * across client forms so the same code always reads the same way to a
 * streamer, whether it comes back from onboarding, profile, or tip page
 * settings.
 */
export const ERROR_MESSAGES: Record<string, string> = {
  invite_invalid: "invite code ไม่ถูกต้อง",
  slug_format: "slug ต้องเป็น a-z, 0-9 หรือ - ยาว 3–30 ตัว",
  slug_reserved: "slug นี้ถูกสงวนไว้",
  slug_taken: "slug นี้มีคนใช้แล้ว",
  rate_limited: "ลองใหม่อีกครั้งในอีกสักครู่",
  invalid_input: "ข้อมูลไม่ถูกต้อง",
  unauthorized: "กรุณาเข้าสู่ระบบอีกครั้ง",
  not_onboarded: "กรุณาตั้งค่าบัญชีให้เสร็จก่อน",
};
