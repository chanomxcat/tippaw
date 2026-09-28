import type { ZodType } from "zod";

export function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

export async function parseJson<T>(
  schema: ZodType<T>,
  req: Request,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, response: jsonError(400, "invalid_json") };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return { ok: false, response: jsonError(400, "invalid_input") };
  }

  return { ok: true, data: result.data };
}

export function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? "local";
}
