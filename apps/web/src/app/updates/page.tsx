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

export default function UpdatesPage() {
  const { selectedId } = useSelectedServer();
  const { toast } = useToast();
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!selectedId) return;
    try {
      setError(null);
      const s = (await agentGet(selectedId, "update")) as UpdateStatus;
      setStatus(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [selectedId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  async function startUpdate() {
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
      setStatus(s);
      toast("SteamCMD update started");
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
            Update the dedicated server via SteamCMD (app 2394010) on the host.
          </p>
        </div>
        <button
          className="btn"
          type="button"
          disabled={status?.running}
          onClick={() => startUpdate()}
        >
          {status?.running ? "Updating…" : "Run SteamCMD update"}
        </button>
      </div>

      {error && <div className="banner">{error}</div>}

      <section className="panel">
        <div className="btn-row" style={{ marginBottom: "0.75rem" }}>
          {status?.running ? (
            <span className="badge warn">Running</span>
          ) : status?.finishedAt ? (
            <span
              className={`badge ${status.exitCode === 0 ? "ok" : "danger"}`}
            >
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
    </>
  );
}
