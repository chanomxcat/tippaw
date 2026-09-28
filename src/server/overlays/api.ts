import { z } from "zod";

import { alertOverlaySettingsSchema, alertVariantSchema } from "@/server/alerts/schemas";
import { apiRequireOnboarded } from "@/server/auth/session";
import { sendTestAlert } from "@/server/donations/alerts";
import type { Deps } from "@/server/env";
import { jsonError, parseJson } from "@/server/http";

import { getAlertOverlayConfig, resetOverlayToken, updateAlertOverlay } from "./overlays";

const putAlertOverlaySchema = z.object({
  settings: alertOverlaySettingsSchema,
  variant: alertVariantSchema,
});

function alertOverlayUrl(env: Deps["env"], token: string): string {
  return `${env.BETTER_AUTH_URL}/overlay/alert/${token}`;
}

/** `GET /api/overlays/alert`: the caller's overlay URL, settings, and single alert variant. */
export async function handleGetAlertOverlay(deps: Deps, req: Request): Promise<Response> {
  const guard = await apiRequireOnboarded(deps, req.headers);
  if (!guard.ok) return guard.response;

  const config = await getAlertOverlayConfig(deps, guard.user.id);
  if (!config) return jsonError(404, "not_found");

  return Response.json({
    overlayUrl: alertOverlayUrl(deps.env, config.overlay.token),
    settings: config.overlay.settings,
    variant: config.variant,
  });
}

/** `PUT /api/overlays/alert`: replaces the caller's overlay settings and alert variant. */
export async function handlePutAlertOverlay(deps: Deps, req: Request): Promise<Response> {
  const guard = await apiRequireOnboarded(deps, req.headers);
  if (!guard.ok) return guard.response;

  const parsed = await parseJson(putAlertOverlaySchema, req);
  if (!parsed.ok) return parsed.response;

  await updateAlertOverlay(deps, guard.user.id, parsed.data);
  return Response.json({ ok: true });
}

/** `POST /api/overlays/alert/test`: publishes a synthetic alert for the caller, ignoring the overlay minimum. */
export async function handleTestAlert(deps: Deps, req: Request): Promise<Response> {
  const guard = await apiRequireOnboarded(deps, req.headers);
  if (!guard.ok) return guard.response;

  await sendTestAlert(deps, guard.user.id);
  return new Response(null, { status: 204 });
}

/** `POST /api/overlays/alert/reset`: rotates the caller's alert overlay token and disconnects the old one. */
export async function handleResetAlertOverlay(deps: Deps, req: Request): Promise<Response> {
  const guard = await apiRequireOnboarded(deps, req.headers);
  if (!guard.ok) return guard.response;

  const token = await resetOverlayToken(deps, guard.user.id, "alert");
  return Response.json({ overlayUrl: alertOverlayUrl(deps.env, token) });
}
