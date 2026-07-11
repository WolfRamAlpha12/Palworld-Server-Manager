import { homedir } from "node:os";
import { join } from "node:path";

function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v !== undefined && v !== "") return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required env: ${name}`);
}

function expandHome(p: string): string {
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  if (p === "~") return homedir();
  return p;
}

export const agentConfig = {
  port: Number(process.env.AGENT_PORT ?? 9100),
  host: process.env.AGENT_BIND ?? "0.0.0.0",
  secret: env("AGENT_SECRET", "change-me"),
  serviceUnit: process.env.PALWORLD_SERVICE ?? "palworld.service",
  installRoot: expandHome(
    process.env.PALWORLD_INSTALL_ROOT ??
      "~/Steam/steamapps/common/PalServer",
  ),
  steamcmdPath: expandHome(process.env.STEAMCMD_PATH ?? "~/Steam/steamcmd.sh"),
  steamAppId: process.env.STEAM_APP_ID ?? "2394010",
  version: "1.0.0",
};

export function settingsIniPath(): string {
  return join(
    agentConfig.installRoot,
    "Pal/Saved/Config/LinuxServer/PalWorldSettings.ini",
  );
}

export function defaultSettingsIniPath(): string {
  return join(agentConfig.installRoot, "DefaultPalWorldSettings.ini");
}

export function serverLogPath(): string {
  return join(
    agentConfig.installRoot,
    "Pal/Saved/Logs/Pal",
  );
}
