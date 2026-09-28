import { DEFAULT_ALERT_SETTINGS, DEFAULT_ALERT_VARIANT } from "@/server/alerts/schemas";
import { requireOnboarded } from "@/server/auth/page-guards";
import { getDeps } from "@/server/env";
import { getAlertOverlayConfig } from "@/server/overlays/overlays";

import { AlertSettingsForm } from "./AlertSettingsForm";

export default async function AlertOverlaySettingsPage() {
  const user = await requireOnboarded();
  const deps = await getDeps();
  const config = await getAlertOverlayConfig(deps, user.id);

  const token = config?.overlay.token ?? "";
  const settings = config?.overlay.settings ?? DEFAULT_ALERT_SETTINGS;
  const variant = config?.variant ?? DEFAULT_ALERT_VARIANT;

  return (
    <AlertSettingsForm
      overlayUrl={`${deps.env.BETTER_AUTH_URL}/overlay/alert/${token}`}
      settings={settings}
      variant={variant}
    />
  );
}
