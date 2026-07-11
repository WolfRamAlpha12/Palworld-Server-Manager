import { spawn, type ChildProcess } from "node:child_process";
import type { AgentUpdateStatus } from "@psm/shared";
import { agentConfig } from "./config.js";

let current: {
  proc: ChildProcess;
  log: string;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number | null;
} | null = null;

export function getUpdateStatus(): AgentUpdateStatus {
  if (!current) {
    return { running: false, log: "", exitCode: null };
  }
  return {
    running: current.finishedAt === undefined,
    exitCode: current.exitCode ?? null,
    log: current.log.slice(-50_000),
    startedAt: current.startedAt,
    finishedAt: current.finishedAt,
  };
}

export function startSteamUpdate(): AgentUpdateStatus {
  if (current && current.finishedAt === undefined) {
    return getUpdateStatus();
  }

  const args = [
    "+force_install_dir",
    agentConfig.installRoot,
    "+login",
    "anonymous",
    "+app_update",
    agentConfig.steamAppId,
    "validate",
    "+quit",
  ];

  const proc = spawn(agentConfig.steamcmdPath, args, {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  current = {
    proc,
    log: `Starting SteamCMD update for app ${agentConfig.steamAppId}...\n`,
    startedAt: new Date().toISOString(),
    exitCode: null,
  };

  const append = (chunk: Buffer) => {
    if (!current) return;
    current.log += chunk.toString("utf8");
    if (current.log.length > 200_000) {
      current.log = current.log.slice(-100_000);
    }
  };

  proc.stdout?.on("data", append);
  proc.stderr?.on("data", append);
  proc.on("close", (code) => {
    if (!current) return;
    current.exitCode = code;
    current.finishedAt = new Date().toISOString();
    current.log += `\n[exit code ${code}]\n`;
  });
  proc.on("error", (err) => {
    if (!current) return;
    current.exitCode = 1;
    current.finishedAt = new Date().toISOString();
    current.log += `\n[error] ${err.message}\n`;
  });

  return getUpdateStatus();
}
