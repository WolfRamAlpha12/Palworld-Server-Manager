import type { ServerProfile } from "@psm/shared";

function restBase(profile: ServerProfile): string {
  return `http://${profile.host}:${profile.restPort}/v1/api`;
}

function basicAuth(profile: ServerProfile): string {
  const token = Buffer.from(`admin:${profile.adminPassword}`, "utf8").toString(
    "base64",
  );
  return `Basic ${token}`;
}

export async function restFetch(
  profile: ServerProfile,
  endpoint: string,
  init?: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const url = `${restBase(profile)}/${endpoint.replace(/^\//, "")}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: basicAuth(profile),
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });

  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // keep text
  }
  return { status: res.status, body };
}

export async function probeRest(
  profile: ServerProfile,
): Promise<{ ok: boolean; latencyMs?: number; error?: string; info?: unknown }> {
  const t0 = Date.now();
  try {
    const { status, body } = await restFetch(profile, "info");
    if (status < 200 || status >= 300) {
      return {
        ok: false,
        latencyMs: Date.now() - t0,
        error: `HTTP ${status}: ${typeof body === "string" ? body : JSON.stringify(body)}`,
      };
    }
    return { ok: true, latencyMs: Date.now() - t0, info: body };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
