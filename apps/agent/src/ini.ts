import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname } from "node:path";
import {
  INI_FIELD_MAP,
  applyTypedUpdates,
  coerceIniValue,
  parseIni,
  serializeIni,
  type IniValue,
} from "@psm/shared";
import {
  defaultSettingsIniPath,
  settingsIniPath,
} from "./config.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function isUsableSettingsFile(path: string): Promise<boolean> {
  if (!(await exists(path))) return false;
  try {
    const content = (await readFile(path, "utf8")).trim();
    // Fresh Palworld boots often leave a 1-byte newline stub here.
    return content.length > 0 && content.includes("OptionSettings");
  } catch {
    return false;
  }
}

const MINIMAL_SETTINGS_STUB = `[/Script/Pal.PalGameWorldSettings]
OptionSettings=(RESTAPIEnabled=True,RESTAPIPort=8212,AdminPassword="")
`;

/** Read settings content without writing (safe while the server is live). */
async function resolveSettingsContent(): Promise<{ path: string; content: string }> {
  const target = settingsIniPath();
  if (await isUsableSettingsFile(target)) {
    return { path: target, content: await readFile(target, "utf8") };
  }

  const def = defaultSettingsIniPath();
  if (await exists(def)) {
    return { path: target, content: await readFile(def, "utf8") };
  }

  return { path: target, content: MINIMAL_SETTINGS_STUB };
}

/** Ensure PalWorldSettings.ini exists on disk (for writes while stopped). */
export async function ensureSettingsFile(): Promise<string> {
  const target = settingsIniPath();
  if (await isUsableSettingsFile(target)) return target;

  await mkdir(dirname(target), { recursive: true });
  const def = defaultSettingsIniPath();
  if (await exists(def)) {
    await copyFile(def, target);
    return target;
  }

  await writeFile(target, MINIMAL_SETTINGS_STUB, "utf8");
  return target;
}

export async function readRawSettings(): Promise<Record<string, string>> {
  const { content } = await resolveSettingsContent();
  return parseIni(content).settings;
}

export async function readConfig() {
  const { path, content } = await resolveSettingsContent();
  const parsed = parseIni(content);
  const typed: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(parsed.settings)) {
    const def = INI_FIELD_MAP[key];
    if (def) {
      typed[key] = coerceIniValue(raw, def.type);
    } else {
      typed[key] = raw;
    }
  }

  return {
    settings: parsed.settings,
    typed,
    path,
    restartRequired: false,
  };
}

export async function writeConfig(opts: {
  settings?: Record<string, string>;
  typed?: Record<string, unknown>;
  ensureRest?: {
    enabled?: boolean;
    port?: number;
    adminPassword?: string;
  };
}): Promise<{ path: string; settings: Record<string, string> }> {
  const path = await ensureSettingsFile();
  const content = await readFile(path, "utf8");
  let parsed = parseIni(content);

  if (opts.typed && Object.keys(opts.typed).length > 0) {
    const fieldTypes: Record<
      string,
      "boolean" | "number" | "string" | "enum" | "stringList"
    > = {};
    for (const key of Object.keys(opts.typed)) {
      fieldTypes[key] = INI_FIELD_MAP[key]?.type ?? "string";
    }
    parsed = applyTypedUpdates(
      parsed,
      opts.typed as Record<string, IniValue>,
      fieldTypes,
    );
  }

  if (opts.settings) {
    parsed = {
      ...parsed,
      settings: { ...parsed.settings, ...opts.settings },
      hasOptionSettings: true,
    };
  }

  // Always ensure REST can be enabled for manager ops
  if (opts.ensureRest) {
    const er = opts.ensureRest;
    if (er.enabled !== undefined) {
      parsed.settings.RESTAPIEnabled = er.enabled ? "True" : "False";
    } else {
      parsed.settings.RESTAPIEnabled = "True";
    }
    if (er.port !== undefined) {
      parsed.settings.RESTAPIPort = String(er.port);
    }
    if (er.adminPassword !== undefined) {
      parsed.settings.AdminPassword = `"${er.adminPassword.replace(/"/g, '""')}"`;
    }
  }

  const out = serializeIni(parsed);
  await writeFile(path, out, "utf8");
  return { path, settings: parsed.settings };
}
