"use client";

import { useCallback, useEffect, useState } from "react";
import { agentGet } from "@/lib/api";
import { useSelectedServer } from "@/lib/selection";
import { NeedServer } from "@/components/NeedServer";

export default function LogsPage() {
  const { selectedId } = useSelectedServer();
  const [source, setSource] = useState<"journal" | "file">("journal");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);

  const refresh = useCallback(async () => {
    if (!selectedId) return;
    try {
      setError(null);
      const data = (await agentGet(
        selectedId,
        "logs",
        `source=${source}&lines=300`,
      )) as { text: string };
      setText(data.text ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [selectedId, source]);

  useEffect(() => {
    refresh();
    if (!auto) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh, auto]);

  if (!selectedId) return <NeedServer />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Logs</h1>
          <p>Tail journald for palworld.service or the newest server log file.</p>
        </div>
        <div className="btn-row">
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button
              type="button"
              className={source === "journal" ? "active" : undefined}
              onClick={() => setSource("journal")}
            >
              Journal
            </button>
            <button
              type="button"
              className={source === "file" ? "active" : undefined}
              onClick={() => setSource("file")}
            >
              Log file
            </button>
          </div>
          <label className="checkbox-row" style={{ padding: 0 }}>
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button className="btn secondary" type="button" onClick={() => refresh()}>
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="banner">{error}</div>}

      <section className="panel">
        <pre className="log-view" style={{ maxHeight: "70vh" }}>
          {text || "No log output."}
        </pre>
      </section>
    </>
  );
}
