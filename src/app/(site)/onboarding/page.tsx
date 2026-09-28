import { redirect } from "next/navigation";

import { requireSession } from "@/server/auth/page-guards";
import { getDeps } from "@/server/env";
import { getOnboardingState } from "@/server/onboarding/onboarding";

import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await requireSession();
  const deps = await getDeps();
  const { needsInvite, needsSlug } = await getOnboardingState(deps, user);

  if (!needsInvite && !needsSlug) redirect("/dashboard");

  return <OnboardingForm needsInvite={needsInvite} />;
}
