import { NextResponse } from "next/server";
import { INI_CATEGORIES, INI_FIELDS } from "@psm/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    categories: INI_CATEGORIES,
    fields: INI_FIELDS.map((f) => ({
      key: f.key,
      type: f.type,
      category: f.category,
      label: f.label,
      description: f.description,
      sensitive: Boolean(f.sensitive),
      enumValues: f.enumValues,
      min: f.min,
      max: f.max,
      default: f.default,
    })),
  });
}
