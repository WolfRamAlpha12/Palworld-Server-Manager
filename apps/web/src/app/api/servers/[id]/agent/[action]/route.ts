import { NextResponse } from "next/server";
import { getServer } from "@/lib/db";
import {
  agentGetConfig,
  agentHealth,
  agentLogs,
  agentPutConfig,
  agentRestart,
  agentSelfUpdateStatus,
  agentStart,
  agentStartSelfUpdate,
  agentStartUpdate,
  agentStatus,
  agentStop,
  agentUpdateStatus,
} from "@/lib/agent-client";
import type { AgentConfigUpdateRequest } from "@psm/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; action: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id, action } = await ctx.params;
  const server = getServer(id);
  if (!server) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    switch (action) {
      case "status":
        return NextResponse.json(await agentStatus(server));
      case "health":
        return NextResponse.json(await agentHealth(server));
      case "config":
        return NextResponse.json(await agentGetConfig(server));
      case "logs": {
        const url = new URL(req.url);
        const source = (url.searchParams.get("source") ?? "journal") as
          | "journal"
          | "file";
        const lines = Number(url.searchParams.get("lines") ?? 200);
        return NextResponse.json(await agentLogs(server, { source, lines }));
      }
      case "update":
        return NextResponse.json(await agentUpdateStatus(server));
      case "agent-update":
        return NextResponse.json(await agentSelfUpdateStatus(server));
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const { id, action } = await ctx.params;
  const server = getServer(id);
  if (!server) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    switch (action) {
      case "start":
        return NextResponse.json(await agentStart(server));
      case "stop":
        return NextResponse.json(await agentStop(server));
      case "restart":
        return NextResponse.json(await agentRestart(server));
      case "update":
        return NextResponse.json(await agentStartUpdate(server));
      case "agent-update":
        return NextResponse.json(await agentStartSelfUpdate(server));
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  const { id, action } = await ctx.params;
  if (action !== "config") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  const server = getServer(id);
  if (!server) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const body = (await req.json()) as AgentConfigUpdateRequest;
    // Keep REST credentials in sync with profile when saving
    const ensureRest = body.ensureRest ?? {
      enabled: true,
      port: server.restPort,
      adminPassword: server.adminPassword,
    };
    if (ensureRest.adminPassword === undefined) {
      ensureRest.adminPassword = server.adminPassword;
    }
    if (ensureRest.port === undefined) {
      ensureRest.port = server.restPort;
    }
    const result = await agentPutConfig(server, { ...body, ensureRest });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const conflict = /\(409\)/.test(message);
    return NextResponse.json(
      { error: message },
      { status: conflict ? 409 : 502 },
    );
  }
}
