import type {
  AgentConfigUpdateRequest,
  AgentConfigUpdateResponse,
  AgentHealth,
  AgentStatus,
  AgentUpdateStatus,
  ServerProfile,
} from "@psm/shared";

function agentBase(profile: ServerProfile): string {
  return `http://${profile.host}:${profile.agentPort}`;
}

function agentHeaders(profile: ServerProfile): HeadersInit {
  return {
    Authorization: `Bearer ${profile.agentSecret}`,
    "Content-Type": "application/json",
  };
}

async function agentFetch<T>(
  profile: ServerProfile,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${agentBase(profile)}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...agentHeaders(profile), ...init?.headers },
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Agent ${path} failed (${res.status}): ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function agentHealth(profile: ServerProfile): Promise<AgentHealth> {
  return agentFetch(profile, "/health");
}

export async function agentStatus(profile: ServerProfile): Promise<AgentStatus> {
  return agentFetch(profile, "/status");
}

export async function agentStart(profile: ServerProfile) {
  return agentFetch(profile, "/start", { method: "POST" });
}

export async function agentStop(profile: ServerProfile) {
  return agentFetch(profile, "/stop", { method: "POST" });
}

export async function agentRestart(profile: ServerProfile) {
  return agentFetch(profile, "/restart", { method: "POST" });
}

export async function agentGetConfig(profile: ServerProfile) {
  return agentFetch<{
    settings: Record<string, string>;
    typed: Record<string, unknown>;
    path: string;
    restartRequired: boolean;
  }>(profile, "/config");
}

export async function agentPutConfig(
  profile: ServerProfile,
  body: AgentConfigUpdateRequest,
): Promise<AgentConfigUpdateResponse> {
  return agentFetch(profile, "/config", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function agentLogs(
  profile: ServerProfile,
  opts?: { source?: "journal" | "file"; lines?: number },
) {
  const q = new URLSearchParams();
  if (opts?.source) q.set("source", opts.source);
  if (opts?.lines) q.set("lines", String(opts.lines));
  const qs = q.toString();
  return agentFetch<{ source: string; lines: number; text: string }>(
    profile,
    `/logs${qs ? `?${qs}` : ""}`,
  );
}

export async function agentStartUpdate(profile: ServerProfile): Promise<AgentUpdateStatus> {
  return agentFetch(profile, "/update", { method: "POST" });
}

export async function agentUpdateStatus(profile: ServerProfile): Promise<AgentUpdateStatus> {
  return agentFetch(profile, "/update");
}

export async function probeAgent(
  profile: ServerProfile,
): Promise<{ ok: boolean; latencyMs?: number; error?: string; health?: AgentHealth }> {
  const t0 = Date.now();
  try {
    const health = await agentHealth(profile);
    return { ok: true, latencyMs: Date.now() - t0, health };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
