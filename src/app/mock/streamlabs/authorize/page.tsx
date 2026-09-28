import { notFound, redirect } from "next/navigation";

import { buildAuthorizeRedirect, isAllowedRedirectUri } from "@/server/auth/mock-streamlabs";
import { getDeps, isMockMode } from "@/server/env";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

async function approve(formData: FormData) {
  "use server";
  const { env } = await getDeps();
  if (!isMockMode(env)) notFound();

  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = String(formData.get("state") ?? "");
  const streamlabsUsername = String(formData.get("streamlabs_username") ?? "");
  if (!isAllowedRedirectUri(redirectUri, env.BETTER_AUTH_URL)) notFound();

  let target: string;
  try {
    target = buildAuthorizeRedirect({ redirectUri, state, streamlabsUsername });
  } catch {
    const retry = new URLSearchParams({ redirect_uri: redirectUri, state, error: "invalid_username" });
    redirect(`/mock/streamlabs/authorize?${retry.toString()}`);
  }
  redirect(target);
}

export default async function MockStreamlabsAuthorizePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { env } = await getDeps();
  if (!isMockMode(env)) notFound();

  const params = await searchParams;
  const redirectUri = first(params.redirect_uri);
  const state = first(params.state);
  const error = first(params.error);

  if (!isAllowedRedirectUri(redirectUri, env.BETTER_AUTH_URL)) {
    return (
      <main style={{ maxWidth: 420, margin: "64px auto", padding: 16 }}>
        <h1>Streamlabs (จำลอง)</h1>
        <p>redirect_uri ไม่ถูกต้อง</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 420, margin: "64px auto", padding: 16 }}>
      <h1>Streamlabs (จำลอง)</h1>
      <p>TipPaw ขอเข้าถึงบัญชี Streamlabs ของคุณ กรอกชื่อผู้ใช้ Streamlabs ปลอมเพื่อดำเนินการต่อ</p>
      <form action={approve}>
        <input type="hidden" name="redirect_uri" value={redirectUri} />
        <input type="hidden" name="state" value={state} />
        <label htmlFor="streamlabs_username">ชื่อผู้ใช้ Streamlabs</label>
        <br />
        <input
          id="streamlabs_username"
          name="streamlabs_username"
          required
          pattern="[A-Za-z0-9_]{1,50}"
          autoComplete="off"
        />
        {error === "invalid_username" && (
          <p role="alert">ชื่อผู้ใช้ใช้ได้เฉพาะ A-Z, a-z, 0-9 และ _ (ไม่เกิน 50 ตัว)</p>
        )}
        <br />
        <button type="submit">อนุญาต</button>
      </form>
    </main>
  );
}
