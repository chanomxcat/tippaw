import { getDeps } from "@/server/env";
import { listInvites } from "@/server/invites/invites";

import { InvitesClient } from "./invites-client";

export default async function AdminInvitesPage() {
  const deps = await getDeps();
  const invites = await listInvites(deps);

  return (
    <InvitesClient
      initialInvites={invites.map((i) => ({
        code: i.code,
        note: i.note,
        maxUses: i.maxUses,
        usedCount: i.usedCount,
        expiresAt: i.expiresAt ? i.expiresAt.toISOString() : null,
        disabledAt: i.disabledAt ? i.disabledAt.toISOString() : null,
        createdAt: i.createdAt.toISOString(),
      }))}
    />
  );
}
