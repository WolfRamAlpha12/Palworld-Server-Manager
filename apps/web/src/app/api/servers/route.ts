import { NextResponse } from "next/server";
import { createServer, listServers, toPublic } from "@/lib/db";
import type { ServerProfileInput } from "@psm/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const servers = listServers().map(toPublic);
  return NextResponse.json({ servers });
}

export async function POST(req: Request) {
  const body = (await req.json()) as ServerProfileInput;
  if (!body.name?.trim() || !body.host?.trim()) {
    return NextResponse.json(
      { error: "name and host are required" },
      { status: 400 },
    );
  }
  if (!body.adminPassword || !body.agentSecret) {
    return NextResponse.json(
      { error: "adminPassword and agentSecret are required" },
      { status: 400 },
    );
  }
  const server = createServer(body);
  return NextResponse.json({ server: toPublic(server) }, { status: 201 });
}
