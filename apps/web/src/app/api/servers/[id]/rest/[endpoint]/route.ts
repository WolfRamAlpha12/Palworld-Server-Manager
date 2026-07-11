import { NextResponse } from "next/server";
import {
  REST_GET_ENDPOINTS,
  REST_POST_ENDPOINTS,
} from "@psm/shared";
import { getServer } from "@/lib/db";
import { restFetch } from "@/lib/rest-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; endpoint: string }> };

const GET_SET = new Set<string>(REST_GET_ENDPOINTS);
const POST_SET = new Set<string>(REST_POST_ENDPOINTS);

export async function GET(_req: Request, ctx: Ctx) {
  const { id, endpoint } = await ctx.params;
  if (!GET_SET.has(endpoint)) {
    return NextResponse.json({ error: "Unknown GET endpoint" }, { status: 400 });
  }
  const server = getServer(id);
  if (!server) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const { status, body } = await restFetch(server, endpoint);
    return NextResponse.json(body, { status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const { id, endpoint } = await ctx.params;
  if (!POST_SET.has(endpoint)) {
    return NextResponse.json({ error: "Unknown POST endpoint" }, { status: 400 });
  }
  const server = getServer(id);
  if (!server) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let body: unknown = undefined;
  const text = await req.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }
  try {
    const result = await restFetch(server, endpoint, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
