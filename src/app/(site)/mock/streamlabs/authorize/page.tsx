import { notFound } from "next/navigation";

import { isAllowedRedirectUri } from "@/server/auth/mock-streamlabs";
import { getDeps, isStreamlabsMockLoginEnabled } from "@/server/env";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function MockStreamlabsAuthorizePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { env } = await getDeps();
  if (!isStreamlabsMockLoginEnabled(env)) notFound();

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
      {/*
        Plain HTML form POST (not a React Server Action): the target is a
        real HTTP redirect to /api/auth/callback/streamlabs, and a Server
        Action's redirect() to a non-page URL doesn't reliably drive an
        ordinary full-page browser navigation there. See
        src/app/api/mock/streamlabs/authorize/route.ts.
      */}
      <form action="/api/mock/streamlabs/authorize" method="post">
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
