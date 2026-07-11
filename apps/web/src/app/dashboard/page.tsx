"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { agentGet, agentPost, restGet, restPost } from "@/lib/api";
import { useSelectedServer } from "@/lib/selection";
import { useToast } from "@/components/Toast";
import { NeedServer } from "@/components/NeedServer";

type AgentStatus = {
  service: string;
  active: boolean;
  pid?: number | null;
  restApiEnabled?: boolean;
  restApiPort?: number;
};

export default function DashboardPage() {
  const { selectedId } = useSelectedServer();
  const { toast } = useToast();
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [info, setInfo] = useState<Record<string, unknown> | null>(null);
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [announce, setAnnounce] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!selectedId) return;
    setError(null);
    try {
      const st = (await agentGet(selectedId, "status")) as AgentStatus;
      setStatus(st);
      if (st.active) {
        const [inf, met] = await Promise.all([
          restGet(selectedId, "info").catch(() => null),
          restGet(selectedId, "metrics").catch(() => null),
        ]);
        setInfo(inf as Record<string, unknown> | null);
        setMetrics(met as Record<string, unknown> | null);
      } else {
        setInfo(null);
        setMetrics(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [selectedId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  async function runAgent(action: "start" | "stop" | "restart") {
    if (!selectedId) return;
    setBusy(true);
    try {
      await agentPost(selectedId, action);
      toast(`Service ${action} requested`);
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), { error: true });
    } finally {
      setBusy(false);
    }
  }

  async function runRest(endpoint: string, body?: unknown) {
    if (!selectedId) return;
    setBusy(true);
    try {
      await restPost(selectedId, endpoint, body);
      toast(`${endpoint} OK`);
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), { error: true });
    } finally {
      setBusy(false);
    }
  }

  async function onAnnounce(e: FormEvent) {
    e.preventDefault();
    if (!announce.trim()) return;
    await runRest("announce", { message: announce.trim() });
    setAnnounce("");
  }

  if (!selectedId) return <NeedServer />;

  const playerNum = Number(metrics?.currentplayernum ?? metrics?.currentPlayerNum ?? NaN);
  const maxPlayers = Number(metrics?.maxplayernum ?? metrics?.maxPlayerNum ?? NaN);
  const fps = Number(metrics?.serverfps ?? metrics?.serverfps ?? metrics?.serverFps ?? NaN);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Live status, metrics, and quick admin actions.</p>
        </div>
        <button className="btn secondary" type="button" onClick={() => refresh()}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="banner">
          Agent unreachable: {error}
        </div>
      )}

      <div className="grid-3">
        <div className="panel metric">
          <span className="label">Process</span>
          <span className="value">
            {status ? (
              <span className={`badge ${status.active ? "ok" : "muted"}`}>
                {status.service}
              </span>
            ) : (
              "—"
            )}
          </span>
          {status?.pid ? (
            <span className="hint">PID {status.pid}</span>
          ) : null}
        </div>
        <div className="panel metric">
          <span className="label">Players</span>
          <span className="value">
            {Number.isFinite(playerNum)
              ? `${playerNum}${Number.isFinite(maxPlayers) ? ` / ${maxPlayers}` : ""}`
              : status?.active
                ? "…"
                : "Offline"}
          </span>
        </div>
        <div className="panel metric">
          <span className="label">Server FPS</span>
          <span className="value">
            {Number.isFinite(fps) ? Math.round(fps) : "—"}
          </span>
        </div>
      </div>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>
          Process control
        </h2>
        <div className="btn-row">
          <button className="btn" disabled={busy} onClick={() => runAgent("start")}>
            Start
          </button>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={() => runAgent("restart")}
          >
            Restart
          </button>
          <button
            className="btn danger"
            disabled={busy}
            onClick={() => runAgent("stop")}
          >
            Stop (systemd)
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>
          Live admin (REST)
        </h2>
        <div className="btn-row" style={{ marginBottom: "1rem" }}>
          <button
            className="btn secondary"
            disabled={busy || !status?.active}
            onClick={() => runRest("save")}
          >
            Save world
          </button>
          <button
            className="btn warn"
            disabled={busy || !status?.active}
            onClick={() =>
              runRest("shutdown", { waittime: 30, message: "Server shutting down in 30s" })
            }
          >
            Graceful shutdown
          </button>
          <button
            className="btn danger"
            disabled={busy || !status?.active}
            onClick={() => {
              if (confirm("Force stop the game process via REST?")) runRest("stop");
            }}
          >
            Force stop
          </button>
        </div>
        <form onSubmit={onAnnounce} className="btn-row" style={{ alignItems: "stretch" }}>
          <input
            style={{
              flex: 1,
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: "0.55rem 0.7rem",
            }}
            placeholder="Broadcast message…"
            value={announce}
            onChange={(e) => setAnnounce(e.target.value)}
            disabled={!status?.active}
          />
          <button className="btn" type="submit" disabled={busy || !status?.active}>
            Announce
          </button>
        </form>
      </section>

      {(info || metrics) && (
        <section className="panel">
          <h2 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>
            Raw snapshot
          </h2>
          <pre className="log-view" style={{ maxHeight: 280 }}>
            {JSON.stringify({ info, metrics }, null, 2)}
          </pre>
        </section>
      )}
    </>
  );
}
