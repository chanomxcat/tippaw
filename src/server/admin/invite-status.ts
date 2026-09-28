/**
 * Pure display-status label for an invite code. Not stored — always derived
 * from the row's current fields against `now`, so it stays consistent
 * between the invites list and the invite detail page without a migration.
 */

export type InviteStatusInput = {
  disabledAt: Date | null;
  expiresAt: Date | null;
  maxUses: number | null;
  usedCount: number;
};

export function inviteStatusLabel(invite: InviteStatusInput, now: Date): string {
  if (invite.disabledAt) return "ปิดอยู่";
  if (invite.expiresAt && invite.expiresAt <= now) return "หมดอายุ";
  if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) return "เต็ม";
  return "ใช้งานได้";
}
