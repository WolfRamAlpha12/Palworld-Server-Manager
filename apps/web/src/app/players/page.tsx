"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { restGet, restPost } from "@/lib/api";
import { useSelectedServer } from "@/lib/selection";
import { useToast } from "@/components/Toast";
import { NeedServer } from "@/components/NeedServer";

type Player = {
  name?: string;
  playerId?: string;
  userId?: string;
  ip?: string;
  ping?: number;
  level?: number;
};

export default function PlayersPage() {
  const { selectedId } = useSelectedServer();
  const { toast } = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [unbanId, setUnbanId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!selectedId) return;
    try {
      setError(null);
      const data = (await restGet(selectedId, "players")) as {
        players?: Player[];
      };
      setPlayers(data.players ?? (Array.isArray(data) ? (data as Player[]) : []));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPlayers([]);
    }
  }, [selectedId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  async function action(
    endpoint: "kick" | "ban",
    player: Player,
  ) {
    if (!selectedId || !player.userId) {
      toast("Missing userId", { error: true });
      return;
    }
    const label = endpoint === "kick" ? "Kick" : "Ban";
    if (!confirm(`${label} ${player.name ?? player.userId}?`)) return;
    try {
      await restPost(selectedId, endpoint, {
        userid: player.userId,
        message: `${label}ed by manager`,
      });
      toast(`${label}ed ${player.name ?? player.userId}`);
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), { error: true });
    }
  }

  async function onUnban(e: FormEvent) {
    e.preventDefault();
    if (!selectedId || !unbanId.trim()) return;
    try {
      await restPost(selectedId, "unban", { userid: unbanId.trim() });
      toast(`Unbanned ${unbanId.trim()}`);
      setUnbanId("");
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), { error: true });
    }
  }

  if (!selectedId) return <NeedServer />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Players</h1>
          <p>Live player list with kick, ban, and unban.</p>
        </div>
        <button className="btn secondary" type="button" onClick={() => refresh()}>
          Refresh
        </button>
      </div>

      {error && <div className="banner">{error}</div>}

      <section className="panel">
        {players.length === 0 ? (
          <div className="empty">No players online (or REST unreachable).</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Level</th>
                  <th>User ID</th>
                  <th>IP</th>
                  <th>Ping</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={p.userId ?? p.playerId ?? i}>
                    <td>
                      <strong>{p.name ?? "—"}</strong>
                    </td>
                    <td>{p.level ?? "—"}</td>
                    <td>
                      <code>{p.userId ?? "—"}</code>
                    </td>
                    <td>{p.ip ?? "—"}</td>
                    <td>{p.ping ?? "—"}</td>
                    <td>
                      <div className="btn-row">
                        <button
                          className="btn secondary"
                          type="button"
                          onClick={() => action("kick", p)}
                        >
                          Kick
                        </button>
                        <button
                          className="btn danger"
                          type="button"
                          onClick={() => action("ban", p)}
                        >
                          Ban
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>Unban</h2>
        <form onSubmit={onUnban} className="btn-row">
          <input
            style={{
              flex: 1,
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: "0.55rem 0.7rem",
            }}
            placeholder="User ID"
            value={unbanId}
            onChange={(e) => setUnbanId(e.target.value)}
          />
          <button className="btn" type="submit">
            Unban
          </button>
        </form>
      </section>
    </>
  );
}
