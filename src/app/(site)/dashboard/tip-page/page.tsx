import { requireOnboarded } from "@/server/auth/page-guards";
import { getDeps } from "@/server/env";
import { getProfile } from "@/server/profile/profile";
import { getTipPage } from "@/server/tip-page/tip-page";

import { TipPageClient } from "./tip-page-client";

export default async function TipPageSettingsPage() {
  const user = await requireOnboarded();
  const deps = await getDeps();
  const [profile, page] = await Promise.all([getProfile(deps, user.id), getTipPage(deps, user.id)]);

  return (
    <TipPageClient
      slug={profile.slug}
      channelName={page?.channelName ?? ""}
      links={page?.links ?? []}
      successMessage={page?.successMessage ?? ""}
      failureMessage={page?.failureMessage ?? ""}
    />
  );
}
