import { requireOnboarded } from "@/server/auth/page-guards";
import { getDeps, isMockMode } from "@/server/env";
import { getProfile } from "@/server/profile/profile";

import { ProfileClient } from "./profile-client";

export default async function ProfilePage() {
  const user = await requireOnboarded();
  const deps = await getDeps();
  const profile = await getProfile(deps, user.id);

  return (
    <ProfileClient
      slug={profile.slug}
      payout={profile.payout}
      baseUrl={deps.env.BETTER_AUTH_URL}
      mockMode={isMockMode(deps.env)}
    />
  );
}
