import { getDeps } from "@/server/env";
import { getOverlayByToken } from "@/server/overlays/overlays";

import { OverlayAlertClient } from "./OverlayAlertClient";

/** OBS browser-source page: `/overlay/alert/{token}`. Transparent background, no MUI (see `../layout.tsx`). */
export default async function OverlayAlertPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const deps = await getDeps();
  const found = await getOverlayByToken(deps, token);

  if (!found || found.type !== "alert") {
    return (
      <p style={{ color: "#fff", fontSize: 14, padding: 16, fontFamily: "sans-serif" }}>
        Overlay URL ไม่ถูกต้องหรือถูกรีเซ็ตแล้ว
      </p>
    );
  }

  return <OverlayAlertClient token={token} />;
}
