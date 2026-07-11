import { createWriteStream } from "node:fs";
import { mkdir, rename, chmod } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { spawn } from "node:child_process";
import type { AgentUpdateStatus } from "@psm/shared";
import { agentConfig } from "./config.js";

let current: {
  log: string;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number | null;
} | null = null;

function append(msg: string) {
  if (!current) return;
  current.log += msg;
  if (current.log.length > 200_000) {
    current.log = current.log.slice(-100_000);
  }
}

export function getAgentUpdateStatus(): AgentUpdateStatus {
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

type ReleaseAsset = {
  name: string;
  browser_download_url: string;
};

type ReleaseInfo = {
  tag_name: string;
  assets: ReleaseAsset[];
};

async function fetchRelease(): Promise<ReleaseInfo> {
  const repo = agentConfig.githubRepo;
  const tag = agentConfig.releaseTag.trim();
  const url = tag
    ? `https://api.github.com/repos/${repo}/releases/tags/${tag}`
    : `https://api.github.com/repos/${repo}/releases/latest`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "palworld-server-manager-agent",
    },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `GitHub release fetch failed (${res.status}): ${text || res.statusText}`,
    );
  }
  return (await res.json()) as ReleaseInfo;
}

async function downloadAsset(url: string, dest: string): Promise<void> {
  const res = await fetch(url, {
    headers: { "User-Agent": "palworld-server-manager-agent" },
    redirect: "follow",
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Download failed (${res.status}): ${url}`);
  }
  const nodeStream = Readable.fromWeb(
    res.body as import("node:stream/web").ReadableStream,
  );
  await pipeline(nodeStream, createWriteStream(dest));
}

function scheduleRestart(): void {
  const unit = agentConfig.agentServiceUnit;
  // Detach so the HTTP response can finish before systemd kills us.
  setTimeout(() => {
    const child = spawn("systemctl", ["restart", unit], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  }, 750);
}

export function startAgentSelfUpdate(): AgentUpdateStatus {
  if (current && current.finishedAt === undefined) {
    return getAgentUpdateStatus();
  }

  current = {
    log: "Starting host agent self-update...\n",
    startedAt: new Date().toISOString(),
    exitCode: null,
  };

  void (async () => {
    try {
      append(`Repo: ${agentConfig.githubRepo}\n`);
      append(
        agentConfig.releaseTag
          ? `Tag: ${agentConfig.releaseTag}\n`
          : "Tag: latest\n",
      );

      const release = await fetchRelease();
      append(`Resolved release: ${release.tag_name}\n`);

      const asset = release.assets.find((a) => a.name === agentConfig.assetName);
      if (!asset) {
        throw new Error(
          `Asset "${agentConfig.assetName}" not found on release ${release.tag_name}`,
        );
      }

      const installPath = agentConfig.installPath;
      const dir = dirname(installPath);
      await mkdir(dir, { recursive: true });

      const tmp = join(dir, `.${agentConfig.assetName}.tmp`);
      append(`Downloading ${asset.browser_download_url}\n`);
      await downloadAsset(asset.browser_download_url, tmp);
      await chmod(tmp, 0o755);
      await rename(tmp, installPath);
      append(`Installed to ${installPath}\n`);
      append(`Scheduling restart of ${agentConfig.agentServiceUnit}...\n`);

      current!.exitCode = 0;
      current!.finishedAt = new Date().toISOString();
      append(`[exit code 0]\n`);
      scheduleRestart();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      append(`[error] ${message}\n`);
      if (current) {
        current.exitCode = 1;
        current.finishedAt = new Date().toISOString();
      }
    }
  })();

  return getAgentUpdateStatus();
}
