import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AgentStatus, ServiceState } from "@psm/shared";
import { agentConfig, settingsIniPath } from "./config.js";
import { readRawSettings } from "./ini.js";

const execFileAsync = promisify(execFile);

async function systemctl(
  ...args: string[]
): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync("systemctl", args, {
      timeout: 60_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim(), code: 0 };
  } catch (err) {
    const e = err as {
      stdout?: string;
      stderr?: string;
      code?: number;
      message?: string;
    };
    return {
      stdout: (e.stdout ?? "").toString().trim(),
      stderr: (e.stderr ?? e.message ?? "").toString().trim(),
      code: typeof e.code === "number" ? e.code : 1,
    };
  }
}

function mapState(raw: string): ServiceState {
  const s = raw.trim().toLowerCase();
  if (
    s === "active" ||
    s === "inactive" ||
    s === "activating" ||
    s === "deactivating" ||
    s === "failed"
  ) {
    return s;
  }
  return "unknown";
}

export async function getStatus(): Promise<AgentStatus> {
  const unit = agentConfig.serviceUnit;
  const [activeResult, showResult] = await Promise.all([
    systemctl("is-active", unit),
    systemctl(
      "show",
      unit,
      "--property=ActiveState,MainPID,ExecMainCode,SubState",
    ),
  ]);

  const props: Record<string, string> = {};
  for (const line of showResult.stdout.split("\n")) {
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    props[line.slice(0, eq)] = line.slice(eq + 1);
  }

  const service = mapState(props.ActiveState ?? activeResult.stdout);
  const pid = props.MainPID ? Number(props.MainPID) : null;
  const lastExitCode =
    props.ExecMainCode !== undefined ? Number(props.ExecMainCode) : null;

  let restApiEnabled: boolean | undefined;
  let restApiPort: number | undefined;
  try {
    const settings = await readRawSettings();
    restApiEnabled = (settings.RESTAPIEnabled ?? "").toLowerCase() === "true";
    const port = Number(settings.RESTAPIPort);
    if (Number.isFinite(port)) restApiPort = port;
  } catch {
    // settings may not exist yet
  }

  return {
    service,
    active: service === "active",
    pid: pid && pid > 0 ? pid : null,
    lastExitCode: Number.isFinite(lastExitCode) ? lastExitCode : null,
    restApiEnabled,
    restApiPort,
    settingsPath: settingsIniPath(),
    installRoot: agentConfig.installRoot,
  };
}

export async function startService(): Promise<{ ok: boolean; message: string }> {
  const r = await systemctl("start", agentConfig.serviceUnit);
  if (r.code !== 0) {
    return { ok: false, message: r.stderr || r.stdout || "systemctl start failed" };
  }
  return { ok: true, message: "Service started" };
}

export async function stopService(): Promise<{ ok: boolean; message: string }> {
  const r = await systemctl("stop", agentConfig.serviceUnit);
  if (r.code !== 0) {
    return { ok: false, message: r.stderr || r.stdout || "systemctl stop failed" };
  }
  return { ok: true, message: "Service stopped" };
}

export async function restartService(): Promise<{
  ok: boolean;
  message: string;
}> {
  const r = await systemctl("restart", agentConfig.serviceUnit);
  if (r.code !== 0) {
    return {
      ok: false,
      message: r.stderr || r.stdout || "systemctl restart failed",
    };
  }
  return { ok: true, message: "Service restarted" };
}
