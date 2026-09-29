import { redirect } from "next/navigation";
import { headers as nextHeaders } from "next/headers";

import { isStreamlabsConfigured } from "@/server/auth/auth";
import { resolveSessionState } from "@/server/auth/session";
import { getDeps } from "@/server/env";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const deps = await getDeps();
  const { user, onboarded } = await resolveSessionState(deps, await nextHeaders());
  if (user && onboarded) redirect("/dashboard");
  if (user && !onboarded) redirect("/onboarding");

  return (
    <LoginForm hasGoogle={Boolean(deps.env.GOOGLE_CLIENT_ID)} hasStreamlabs={isStreamlabsConfigured(deps.env)} />
  );
}
