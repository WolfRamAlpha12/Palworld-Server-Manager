"use client";

import { FormEvent, Fragment, useCallback, useEffect, useState } from "react";
import {
  createServer,
  deleteServer,
  fetchServers,
  testServer,
  updateServer,
  type PublicServer,
} from "@/lib/api";
import { useSelectedServer } from "@/lib/selection";
import { useToast } from "@/components/Toast";

const emptyForm = {
  name: "",
  host: "",
  restPort: 8212,
  agentPort: 9100,
  adminPassword: "",
  agentSecret: "",
};

export default function ServersPage() {
  const [servers, setServers] = useState<PublicServer[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testResults, setTestResults] = useState<
    Record<string, { agent: boolean; rest: boolean; detail: string }>
  >({});
  const { setSelectedId } = useSelectedServer();
  const { toast } = useToast();

  const reload = useCallback(async () => {
    const list = await fetchServers();
    setServers(list);
  }, []);

  useEffect(() => {
    reload().catch((e) => toast(String(e.message ?? e), { error: true }));
  }, [reload, toast]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editingId) {
        await updateServer(editingId, {
          name: form.name,
          host: form.host,
          restPort: Number(form.restPort),
          agentPort: Number(form.agentPort),
          ...(form.adminPassword ? { adminPassword: form.adminPassword } : {}),
          ...(form.agentSecret ? { agentSecret: form.agentSecret } : {}),
        });
        toast("Server updated");
      } else {
        const created = await createServer({
          name: form.name,
          host: form.host,
          restPort: Number(form.restPort),
          agentPort: Number(form.agentPort),
          adminPassword: form.adminPassword,
          agentSecret: form.agentSecret,
        });
        setSelectedId(created.id);
        toast("Server added");
      }
      setForm(emptyForm);
      setEditingId(null);
      await reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), { error: true });
    } finally {
      setBusy(false);
    }
  }

  function startEdit(s: PublicServer) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      host: s.host,
      restPort: s.restPort,
      agentPort: s.agentPort,
      adminPassword: "",
      agentSecret: "",
    });
  }

  async function onDelete(id: string) {
    if (!confirm("Remove this server profile?")) return;
    try {
      await deleteServer(id);
      toast("Server removed");
      await reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), { error: true });
    }
  }

  async function onTest(id: string) {
    try {
      const result = await testServer(id);
      const detail = [
        result.agent.ok
          ? `Agent OK (${result.agent.latencyMs}ms)`
          : `Agent: ${result.agent.error}`,
        result.rest.ok
          ? `REST OK (${result.rest.latencyMs}ms)`
          : `REST: ${result.rest.error}`,
      ].join(" · ");
      setTestResults((prev) => ({
        ...prev,
        [id]: {
          agent: result.agent.ok,
          rest: result.rest.ok,
          detail,
        },
      }));
      if (result.agent.ok && result.rest.ok) toast("Connectivity OK");
      else toast(detail, { error: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), { error: true });
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Servers</h1>
          <p>
            Add Palworld hosts by Tailscale IP or MagicDNS name. Credentials are
            encrypted at rest in the manager volume.
          </p>
        </div>
      </div>

      <div className="grid-2">
        <section className="panel">
          <h2 style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>
            {editingId ? "Edit server" : "Add server"}
          </h2>
          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="name">Display name</label>
              <input
                id="name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Home Palworld"
              />
            </div>
            <div className="field">
              <label htmlFor="host">Tailscale host</label>
              <input
                id="host"
                required
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                placeholder="100.x.y.z or palworld.tailnet.ts.net"
              />
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="restPort">REST port</label>
                <input
                  id="restPort"
                  type="number"
                  value={form.restPort}
                  onChange={(e) =>
                    setForm({ ...form, restPort: Number(e.target.value) })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="agentPort">Agent port</label>
                <input
                  id="agentPort"
                  type="number"
                  value={form.agentPort}
                  onChange={(e) =>
                    setForm({ ...form, agentPort: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="adminPassword">Admin password</label>
              <input
                id="adminPassword"
                type="password"
                required={!editingId}
                value={form.adminPassword}
                onChange={(e) =>
                  setForm({ ...form, adminPassword: e.target.value })
                }
                placeholder={editingId ? "(unchanged if blank)" : ""}
              />
              <span className="hint">Used for REST Basic Auth (admin:password)</span>
            </div>
            <div className="field">
              <label htmlFor="agentSecret">Agent shared secret</label>
              <input
                id="agentSecret"
                type="password"
                required={!editingId}
                value={form.agentSecret}
                onChange={(e) =>
                  setForm({ ...form, agentSecret: e.target.value })
                }
                placeholder={editingId ? "(unchanged if blank)" : ""}
              />
            </div>
            <div className="btn-row">
              <button className="btn" type="submit" disabled={busy}>
                {editingId ? "Save changes" : "Add server"}
              </button>
              {editingId && (
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="panel">
          <h2 style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>
            Profiles ({servers.length})
          </h2>
          {servers.length === 0 ? (
            <div className="empty">No servers yet. Add one on the left.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Host</th>
                    <th>Ports</th>
                    <th>Test</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {servers.map((s) => (
                    <Fragment key={s.id}>
                      <tr>
                        <td>
                          <strong>{s.name}</strong>
                        </td>
                        <td>
                          <code>{s.host}</code>
                        </td>
                        <td>
                          REST {s.restPort} · Agent {s.agentPort}
                        </td>
                        <td>
                          {testResults[s.id] ? (
                            <span
                              className={`badge ${
                                testResults[s.id]!.agent &&
                                testResults[s.id]!.rest
                                  ? "ok"
                                  : "warn"
                              }`}
                            >
                              {testResults[s.id]!.agent &&
                              testResults[s.id]!.rest
                                ? "OK"
                                : "Issues"}
                            </span>
                          ) : (
                            <span className="badge muted">—</span>
                          )}
                        </td>
                        <td>
                          <div className="btn-row">
                            <button
                              className="btn secondary"
                              type="button"
                              onClick={() => {
                                setSelectedId(s.id);
                                toast(`Selected ${s.name}`);
                              }}
                            >
                              Select
                            </button>
                            <button
                              className="btn secondary"
                              type="button"
                              onClick={() => onTest(s.id)}
                            >
                              Test
                            </button>
                            <button
                              className="btn secondary"
                              type="button"
                              onClick={() => startEdit(s)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn danger"
                              type="button"
                              onClick={() => onDelete(s.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                      {testResults[s.id] &&
                      !(testResults[s.id]!.agent && testResults[s.id]!.rest) ? (
                        <tr>
                          <td colSpan={5}>
                            <div className="banner" style={{ marginBottom: 0 }}>
                              {testResults[s.id]!.detail}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
