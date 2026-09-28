import { apiRequireOnboarded } from "@/server/auth/session";
import type { Deps } from "@/server/env";
import { jsonError, parseJson } from "@/server/http";

import { getTipPage, tipPageUpdateSchema, updateTipPage } from "./tip-page";

/** `GET /api/tip-page`: the caller's own tip page settings. */
export async function handleGetTipPage(deps: Deps, req: Request): Promise<Response> {
  const guard = await apiRequireOnboarded(deps, req.headers);
  if (!guard.ok) return guard.response;

  const page = await getTipPage(deps, guard.user.id);
  if (!page) return jsonError(404, "not_found");

  return Response.json(page);
}

/** `PUT /api/tip-page`: replaces the caller's tip page settings. */
export async function handlePutTipPage(deps: Deps, req: Request): Promise<Response> {
  const guard = await apiRequireOnboarded(deps, req.headers);
  if (!guard.ok) return guard.response;

  const parsed = await parseJson(tipPageUpdateSchema, req);
  if (!parsed.ok) return parsed.response;

  await updateTipPage(deps, guard.user.id, parsed.data);
  return Response.json({ ok: true });
}
