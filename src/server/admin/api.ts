import { z } from "zod";

import { apiRequireAdmin } from "@/server/auth/session";
import type { Deps } from "@/server/env";
import { jsonError, parseJson } from "@/server/http";
import { createInvite, listInvites, setInviteDisabled } from "@/server/invites/invites";

const createInviteSchema = z.object({
  code: z.string().optional(),
  note: z.string().max(100).optional(),
  maxUses: z.number().int().min(1).max(10000).nullable(),
  expiresAt: z.string().nullable(),
});

const patchInviteSchema = z.object({ disabled: z.boolean() });

/** `GET /api/admin/invites`: all invites, newest first. Admin only. */
export async function handleListInvites(deps: Deps, req: Request): Promise<Response> {
  const guard = await apiRequireAdmin(deps, req.headers);
  if (!guard.ok) return guard.response;

  const invites = await listInvites(deps);
  return Response.json(invites);
}

/**
 * `POST /api/admin/invites`: creates an invite (auto-generated or supplied
 * code). Validates `expiresAt` is a real, future date before delegating to
 * `createInvite`; maps its failure reasons to HTTP status codes, and maps
 * the (rare, 5-collision) generation failure to a 500.
 */
export async function handleCreateInvite(deps: Deps, req: Request): Promise<Response> {
  const guard = await apiRequireAdmin(deps, req.headers);
  if (!guard.ok) return guard.response;

  const parsed = await parseJson(createInviteSchema, req);
  if (!parsed.ok) return parsed.response;
  const { code, note, maxUses, expiresAt: expiresAtRaw } = parsed.data;

  let expiresAt: Date | null = null;
  if (expiresAtRaw !== null) {
    const parsedDate = new Date(expiresAtRaw);
    if (Number.isNaN(parsedDate.getTime())) return jsonError(400, "invalid_input");
    if (parsedDate <= deps.now()) return jsonError(400, "expires_in_past");
    expiresAt = parsedDate;
  }

  let result;
  try {
    result = await createInvite(deps, guard.user.id, {
      code,
      note: note?.trim() || undefined,
      maxUses,
      expiresAt,
    });
  } catch {
    return jsonError(500, "generate_failed");
  }

  if (!result.ok) {
    const status = result.reason === "duplicate" ? 409 : 400;
    return jsonError(status, result.reason);
  }

  return Response.json({ code: result.code }, { status: 201 });
}

/** `PATCH /api/admin/invites/[code]`: sets (or clears) `disabled`. Admin only. */
export async function handlePatchInvite(deps: Deps, req: Request, code: string): Promise<Response> {
  const guard = await apiRequireAdmin(deps, req.headers);
  if (!guard.ok) return guard.response;

  const parsed = await parseJson(patchInviteSchema, req);
  if (!parsed.ok) return parsed.response;

  const ok = await setInviteDisabled(deps, code, parsed.data.disabled);
  if (!ok) return jsonError(404, "not_found");

  return Response.json({ ok: true });
}
