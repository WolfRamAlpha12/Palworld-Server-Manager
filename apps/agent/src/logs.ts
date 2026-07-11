import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { agentConfig, serverLogPath } from "./config.js";

const execFileAsync = promisify(execFile);

export async function readJournalLogs(lines = 200): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "journalctl",
      [
        "-u",
        agentConfig.serviceUnit,
        "-n",
        String(Math.min(Math.max(lines, 1), 2000)),
        "--no-pager",
        "-o",
        "short-iso",
      ],
      { timeout: 15_000, maxBuffer: 4 * 1024 * 1024 },
    );
    return stdout;
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    return e.stderr || e.message || "Failed to read journal";
  }
}

async function newestLogFile(dir: string): Promise<string | null> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && e.name.endsWith(".log"))
      .map((e) => e.name)
      .sort();
    const last = files[files.length - 1];
    return last ? join(dir, last) : null;
  } catch {
    return null;
  }
}

export async function readFileLogs(lines = 200): Promise<string> {
  const dir = serverLogPath();
  const file = await newestLogFile(dir);
  if (!file) return `No log files found in ${dir}`;
  try {
    const content = await readFile(file, "utf8");
    const all = content.split(/\r?\n/);
    const n = Math.min(Math.max(lines, 1), 2000);
    return all.slice(-n).join("\n");
  } catch (err) {
    return err instanceof Error ? err.message : "Failed to read log file";
  }
}
