"use client";

import { useCallback, useEffect, useState } from "react";
import { agentGet, agentPost } from "@/lib/api";
import { useSelectedServer } from "@/lib/selection";
import { useToast } from "@/components/Toast";
import { NeedServer } from "@/components/NeedServer";

type UpdateStatus = {
  running: boolean;
  exitCode?: number | null;
  log: string;
  startedAt?: string;
  finishedAt?: string;
};

type AgentHealth = {
  ok: true;
  version: string;
  hostname: string;
};

function StatusPanel({
  title,
  hint,
  status,
  error,
  runningLabel,
  idleLabel,
  onStart,
  disabled,
}: {
  title: string;
  hint: string;
  status: UpdateStatus | null;
  error: string | null;
  runningLabel: string;
  idleLabel: string;
  onStart: () => void;
  disabled?: boolean;
}) {
  return (
    <section className="panel" style={{ marginBottom: "1.25rem" }}>
      <div className="page-header" style={{ marginBottom: "0.75rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{title}</h2>
          <p style={{ margin: "0.35rem 0 0" }}>{hint}</p>
        </div>
        <button
          className="btn"
          type="button"
          disabled={disabled || status?.running}
          onClick={onStart}
        >
          {status?.running ? runningLabel : idleLabel}
        </button>
      </div>

      {error && <div className="banner">{error}</div>}

      <div className="btn-row" style={{ marginBottom: "0.75rem" }}>
        {status?.running ? (
          <span className="badge warn">Running</span>
        ) : status?.finishedAt ? (
          <span className={`badge ${status.exitCode === 0 ? "ok" : "danger"}`}>
            Finished (exit {status.exitCode ?? "?"})
          </span>
        ) : (
          <span className="badge muted">Idle</span>
        )}
        {status?.startedAt && (
          <span className="hint">Started {status.startedAt}</span>
        )}
        {status?.finishedAt && (
          <span className="hint">Finished {status.finishedAt}</span>
        )}
      </div>
      <pre className="log-view">{status?.log || "No update output yet."}</pre>
    </section>
  );
}

export default function UpdatesPage() {
  const { selectedId } = useSelectedServer();
  const { toast } = useToast();
  const [steamStatus, setSteamStatus] = useState<UpdateStatus | null>(null);
  const [steamError, setSteamError] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<UpdateStatus | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentVersion, setAgentVersion] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!selectedId) return;
    try {
      setSteamError(null);
      const s = (await agentGet(selectedId, "update")) as UpdateStatus;
      setSteamStatus(s);
    } catch (err) {
      setSteamError(err instanceof Error ? err.message : String(err));
    }
    try {
      setAgentError(null);
      const s = (await agentGet(selectedId, "agent-update")) as UpdateStatus;
      setAgentStatus(s);
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : String(err));
    }
    try {
      const health = (await agentGet(selectedId, "health")) as AgentHealth;
      setAgentVersion(health.version);
    } catch {
      // health is best-effort for the version badge
    }
  }, [selectedId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  async function startSteamUpdate() {
    if (!selectedId) return;
    if (
      !confirm(
        "Run SteamCMD update for PalServer? Stop the game server first if it is running.",
      )
    ) {
      return;
    }
    try {
      const s = (await agentPost(selectedId, "update")) as UpdateStatus;
      setSteamStatus(s);
      toast("SteamCMD update started");
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), { error: true });
    }
  }

  async function startAgentUpdate() {
    if (!selectedId) return;
    if (
      !confirm(
        "Download the latest host agent from GitHub Releases and restart palworld-agent? The agent will briefly disconnect.",
      )
    ) {
      return;
    }
    try {
      const s = (await agentPost(selectedId, "agent-update")) as UpdateStatus;
      setAgentStatus(s);
      toast("Host agent update started");
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), { error: true });
    }
  }

  if (!selectedId) return <NeedServer />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Updates</h1>
          <p>
            Update PalServer via SteamCMD, or pull a new host agent release onto
            the VPS.
          </p>
        </div>
      </div>

      <StatusPanel
        title="PalServer (SteamCMD)"
        hint="Updates dedicated server app 2394010 on the host."
        status={steamStatus}
        error={steamError}
        runningLabel="Updating…"
        idleLabel="Run SteamCMD update"
        onStart={startSteamUpdate}
        disabled={agentStatus?.running}
      />

      <StatusPanel
        title="Host agent"
        hint={
          agentVersion
            ? `Current agent version: ${agentVersion}. Downloads agent.mjs from GitHub Releases and restarts the agent service.`
            : "Downloads agent.mjs from GitHub Releases and restarts the agent service."
        }
        status={agentStatus}
        error={agentError}
        runningLabel="Updating…"
        idleLabel="Update host agent"
        onStart={startAgentUpdate}
        disabled={steamStatus?.running}
      />
    </>
  );
}
