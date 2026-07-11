"use client";

import { useEffect, useState } from "react";
import { fetchServers, type PublicServer } from "@/lib/api";
import { useSelectedServer } from "@/lib/selection";

export function ServerSwitcher() {
  const { selectedId, setSelectedId } = useSelectedServer();
  const [servers, setServers] = useState<PublicServer[]>([]);

  useEffect(() => {
    fetchServers()
      .then((list) => {
        setServers(list);
        if (!selectedId && list[0]) setSelectedId(list[0].id);
        if (selectedId && !list.find((s) => s.id === selectedId) && list[0]) {
          setSelectedId(list[0].id);
        }
      })
      .catch(() => setServers([]));
  }, [selectedId, setSelectedId]);

  return (
    <div className="server-switcher">
      <label htmlFor="server-switch" className="hint" style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
        Active server
      </label>
      <select
        id="server-switch"
        value={selectedId ?? ""}
        onChange={(e) => setSelectedId(e.target.value || null)}
        disabled={servers.length === 0}
      >
        {servers.length === 0 ? (
          <option value="">No servers</option>
        ) : (
          servers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
