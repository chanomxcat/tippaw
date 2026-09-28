import { Suspense } from "react";
import { redirect } from "next/navigation";
import { headers as nextHeaders } from "next/headers";

import { resolveSessionState } from "@/server/auth/session";
import { getDeps } from "@/server/env";

import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  const deps = await getDeps();
  const { user, onboarded } = await resolveSessionState(deps, await nextHeaders());
  if (user && onboarded) redirect("/dashboard");
  if (user && !onboarded) redirect("/onboarding");

  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
