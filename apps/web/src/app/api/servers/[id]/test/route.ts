import { NextResponse } from "next/server";
import { getServer } from "@/lib/db";
import { probeAgent } from "@/lib/agent-client";
import { probeRest } from "@/lib/rest-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const server = getServer(id);
  if (!server) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const [agent, rest] = await Promise.all([
    probeAgent(server),
    probeRest(server),
  ]);
  return NextResponse.json({ agent, rest });
}
