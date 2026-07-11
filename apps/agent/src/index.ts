#!/usr/bin/env node
import { createServer } from "node:http";
import { hostname } from "node:os";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type {
  AgentConfigUpdateRequest,
  AgentHealth,
} from "@psm/shared";
import { agentConfig } from "./config.js";
import { readConfig, writeConfig } from "./ini.js";
import { readFileLogs, readJournalLogs } from "./logs.js";
import {
  getStatus,
  restartService,
  startService,
  stopService,
} from "./systemd.js";
import { getUpdateStatus, startSteamUpdate } from "./update.js";

const app = new Hono();

function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

app.use("*", async (c, next) => {
  // Health can be unauthenticated for basic liveness from compose healthchecks
  // but we still require secret for everything else. Allow /health with secret too.
  if (c.req.path === "/health") {
    const auth = c.req.header("authorization");
    const key = c.req.header("x-agent-secret");
    if (!auth && !key) {
      // Public minimal health (no secrets)
      return c.json({ ok: true, version: agentConfig.version });
    }
  }

  const header = c.req.header("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const xSecret = c.req.header("x-agent-secret") ?? "";
  const provided = bearer || xSecret;
  if (provided !== agentConfig.secret) {
    return unauthorized();
  }
  await next();
});

app.get("/health", async (c) => {
  const body: AgentHealth = {
    ok: true,
    version: agentConfig.version,
    hostname: hostname(),
    installRoot: agentConfig.installRoot,
    serviceUnit: agentConfig.serviceUnit,
  };
  return c.json(body);
});

app.get("/status", async (c) => {
  const status = await getStatus();
  return c.json(status);
});

app.post("/start", async (c) => {
  const result = await startService();
  const status = await getStatus();
  return c.json({ ...result, status }, result.ok ? 200 : 500);
});

app.post("/stop", async (c) => {
  const result = await stopService();
  const status = await getStatus();
  return c.json({ ...result, status }, result.ok ? 200 : 500);
});

app.post("/restart", async (c) => {
  const result = await restartService();
  const status = await getStatus();
  return c.json({ ...result, status }, result.ok ? 200 : 500);
});

app.get("/config", async (c) => {
  const cfg = await readConfig();
  return c.json(cfg);
});

app.put("/config", async (c) => {
  const body = (await c.req.json()) as AgentConfigUpdateRequest;
  const result = await writeConfig({
    settings: body.settings,
    typed: body.typed,
    ensureRest: body.ensureRest ?? { enabled: true },
  });
  return c.json({
    ok: true,
    path: result.path,
    restartRequired: true as const,
    settings: result.settings,
  });
});

app.get("/logs", async (c) => {
  const source = (c.req.query("source") ?? "journal") as "journal" | "file";
  const lines = Number(c.req.query("lines") ?? 200);
  const text =
    source === "file"
      ? await readFileLogs(lines)
      : await readJournalLogs(lines);
  return c.json({ source, lines, text });
});

app.post("/update", async (c) => {
  const status = startSteamUpdate();
  return c.json(status);
});

app.get("/update", async (c) => {
  return c.json(getUpdateStatus());
});

app.onError((err, c) => {
  console.error(err);
  return c.json(
    { error: err instanceof Error ? err.message : "Internal error" },
    500,
  );
});

const port = agentConfig.port;
const host = agentConfig.host;

console.log(
  `Palworld host agent v${agentConfig.version} listening on http://${host}:${port}`,
);
console.log(`Install root: ${agentConfig.installRoot}`);
console.log(`Service unit: ${agentConfig.serviceUnit}`);

serve({
  fetch: app.fetch,
  createServer,
  port,
  hostname: host,
});
