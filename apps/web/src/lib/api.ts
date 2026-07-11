/** Client-side API helpers */

export type PublicServer = {
  id: string;
  name: string;
  host: string;
  restPort: number;
  agentPort: number;
  hasAdminPassword: boolean;
  hasAgentSecret: boolean;
  createdAt: string;
  updatedAt: string;
};

async function json<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `Request failed (${res.status})`,
    );
  }
  return data as T;
}

export async function fetchServers(): Promise<PublicServer[]> {
  const data = await json<{ servers: PublicServer[] }>(
    await fetch("/api/servers", { cache: "no-store" }),
  );
  return data.servers;
}

export async function createServer(body: {
  name: string;
  host: string;
  restPort?: number;
  agentPort?: number;
  adminPassword: string;
  agentSecret: string;
}): Promise<PublicServer> {
  const data = await json<{ server: PublicServer }>(
    await fetch("/api/servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return data.server;
}

export async function updateServer(
  id: string,
  body: Record<string, unknown>,
): Promise<PublicServer> {
  const data = await json<{ server: PublicServer }>(
    await fetch(`/api/servers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return data.server;
}

export async function deleteServer(id: string): Promise<void> {
  await json(await fetch(`/api/servers/${id}`, { method: "DELETE" }));
}

export async function testServer(id: string) {
  return json<{
    agent: { ok: boolean; latencyMs?: number; error?: string };
    rest: { ok: boolean; latencyMs?: number; error?: string };
  }>(await fetch(`/api/servers/${id}/test`, { method: "POST" }));
}

export async function restGet(id: string, endpoint: string) {
  return json(await fetch(`/api/servers/${id}/rest/${endpoint}`, { cache: "no-store" }));
}

export async function restPost(id: string, endpoint: string, body?: unknown) {
  return json(
    await fetch(`/api/servers/${id}/rest/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  );
}

export async function agentGet(id: string, action: string, query?: string) {
  return json(
    await fetch(
      `/api/servers/${id}/agent/${action}${query ? `?${query}` : ""}`,
      { cache: "no-store" },
    ),
  );
}

export async function agentPost(id: string, action: string) {
  return json(
    await fetch(`/api/servers/${id}/agent/${action}`, { method: "POST" }),
  );
}

export async function agentPutConfig(id: string, body: unknown) {
  return json(
    await fetch(`/api/servers/${id}/agent/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function fetchSchema() {
  return json<{
    categories: { id: string; label: string; description: string }[];
    fields: {
      key: string;
      type: string;
      category: string;
      label: string;
      description: string;
      sensitive: boolean;
      enumValues?: string[];
      min?: number;
      max?: number;
      default?: unknown;
    }[];
  }>(await fetch("/api/schema", { cache: "no-store" }));
}
