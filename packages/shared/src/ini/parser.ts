/**
 * PalWorldSettings.ini parser/serializer.
 * Format: [/Script/Pal.PalGameWorldSettings]
 * OptionSettings=(Key=Value,Key2=Value2,...)
 *
 * Unknown keys are preserved for round-trip safety across game updates.
 */

export type IniValue = string | number | boolean | string[];

export interface ParsedIni {
  /** Keys inside OptionSettings=(...) */
  settings: Record<string, string>;
  /** Raw file preamble / other sections preserved on write */
  preamble: string;
  /** True if OptionSettings block was found */
  hasOptionSettings: boolean;
}

const SECTION = "[/Script/Pal.PalGameWorldSettings]";

/** Split OptionSettings body on top-level commas (respect nested parens/quotes). */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inQuote = false;
  let current = "";

  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (ch === '"' && body[i - 1] !== "\\") {
      inQuote = !inQuote;
      current += ch;
      continue;
    }
    if (!inQuote) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) {
        parts.push(current.trim());
        current = "";
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

export function parseIni(content: string): ParsedIni {
  const normalized = content.replace(/\r\n/g, "\n");
  const marker = "OptionSettings=";
  const idx = normalized.indexOf(marker);

  if (idx === -1) {
    return {
      settings: {},
      preamble: normalized.trimEnd(),
      hasOptionSettings: false,
    };
  }

  const after = normalized.slice(idx + marker.length).trimStart();
  if (!after.startsWith("(")) {
    return {
      settings: {},
      preamble: normalized.trimEnd(),
      hasOptionSettings: false,
    };
  }

  // Find matching closing paren for OptionSettings=(...)
  let depth = 0;
  let end = -1;
  for (let i = 0; i < after.length; i++) {
    const ch = after[i]!;
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) {
    return {
      settings: {},
      preamble: normalized.trimEnd(),
      hasOptionSettings: false,
    };
  }

  const body = after.slice(1, end);
  const preamble = normalized.slice(0, idx).trimEnd();
  const settings: Record<string, string> = {};

  for (const part of splitTopLevel(body)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) settings[key] = value;
  }

  return { settings, preamble, hasOptionSettings: true };
}

/** Coerce a raw INI string value into a typed JS value. */
export function coerceIniValue(
  raw: string,
  type: "boolean" | "number" | "string" | "enum" | "stringList",
): IniValue {
  switch (type) {
    case "boolean":
      return raw.toLowerCase() === "true";
    case "number": {
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    }
    case "stringList": {
      // Formats: (Steam,Xbox) or ("PALBOX","RepairBench") or ()
      const inner = raw.replace(/^\(/, "").replace(/\)$/, "").trim();
      if (!inner) return [];
      return splitTopLevel(inner).map((s) =>
        s.replace(/^"+|"+$/g, "").replace(/^'+|'+$/g, ""),
      );
    }
    case "enum":
    case "string":
    default:
      return raw.replace(/^"(.*)"$/s, "$1");
  }
}

/** Serialize a typed value back to INI literal form. */
export function serializeIniValue(
  value: IniValue,
  type: "boolean" | "number" | "string" | "enum" | "stringList",
): string {
  switch (type) {
    case "boolean":
      return value ? "True" : "False";
    case "number":
      return String(value);
    case "stringList": {
      const list = Array.isArray(value) ? value : [];
      if (list.length === 0) return "()";
      return `(${list.map((s) => `"${String(s).replace(/"/g, '""')}"`).join(",")})`;
    }
    case "enum":
      return String(value);
    case "string":
    default: {
      const s = String(value ?? "");
      // Quote strings that contain spaces, commas, or special chars
      if (s === "" || /[\s,()=]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }
  }
}

/**
 * Write OptionSettings back. Merges `updates` into existing settings,
 * preserving unknown keys. Ensures RESTAPIEnabled/RESTAPIPort/AdminPassword
 * can be forced by callers.
 */
export function serializeIni(
  parsed: ParsedIni,
  updates?: Record<string, string>,
): string {
  const settings = { ...parsed.settings, ...updates };
  const entries = Object.entries(settings)
    .filter(([k]) => k.length > 0)
    .map(([k, v]) => `${k}=${v}`);

  const optionLine = `OptionSettings=(${entries.join(",")})`;
  let preamble = parsed.preamble.trim();
  if (!preamble.includes(SECTION)) {
    preamble = preamble ? `${preamble}\n${SECTION}` : SECTION;
  }

  return `${preamble}\n${optionLine}\n`;
}

/** Apply typed updates using schema field types when available. */
export function applyTypedUpdates(
  parsed: ParsedIni,
  typed: Record<string, IniValue>,
  fieldTypes: Record<string, "boolean" | "number" | "string" | "enum" | "stringList">,
): ParsedIni {
  const next = { ...parsed.settings };
  for (const [key, value] of Object.entries(typed)) {
    const type = fieldTypes[key] ?? "string";
    next[key] = serializeIniValue(value, type);
  }
  return { ...parsed, settings: next, hasOptionSettings: true };
}
