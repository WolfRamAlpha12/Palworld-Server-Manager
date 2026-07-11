"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  agentGet,
  agentPost,
  agentPutConfig,
  fetchSchema,
  restPost,
} from "@/lib/api";
import { useSelectedServer } from "@/lib/selection";
import { useToast } from "@/components/Toast";
import { NeedServer } from "@/components/NeedServer";

type Field = {
  key: string;
  type: string;
  category: string;
  label: string;
  description: string;
  sensitive: boolean;
  enumValues?: string[];
  min?: number;
  max?: number;
};

type AgentStatus = {
  service: string;
  active: boolean;
  pid?: number | null;
};

const DEFAULT_SHUTDOWN_WAIT = 10;
const DEFAULT_SHUTDOWN_MESSAGE =
  "Server being restarted to make config changes";

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export default function SettingsPage() {
  const { selectedId } = useSelectedServer();
  const { toast } = useToast();
  const [categories, setCategories] = useState<
    { id: string; label: string; description: string }[]
  >([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [category, setCategory] = useState("server");
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [startRequired, setStartRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showShutdownPrompt, setShowShutdownPrompt] = useState(false);
  const [shutdownWait, setShutdownWait] = useState(DEFAULT_SHUTDOWN_WAIT);
  const [shutdownMessage, setShutdownMessage] = useState(
    DEFAULT_SHUTDOWN_MESSAGE,
  );

  const serverLive = Boolean(status?.active);
  const canEdit = status !== null && !status.active;

  const load = useCallback(async () => {
    if (!selectedId) return;
    setError(null);
    try {
      const [schema, cfg] = await Promise.all([
        fetchSchema(),
        agentGet(selectedId, "config") as Promise<{
          typed: Record<string, unknown>;
          restartRequired?: boolean;
        }>,
      ]);
      setCategories(schema.categories);
      setFields(schema.fields as Field[]);
      setValues(cfg.typed ?? {});

      try {
        const st = (await agentGet(selectedId, "status")) as AgentStatus;
        setStatus(st);
        if (cfg.restartRequired && !st.active) setStartRequired(true);
      } catch (statusErr) {
        setStatus(null);
        setError(
          statusErr instanceof Error
            ? `Could not read server status: ${statusErr.message}`
            : String(statusErr),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedId || !serverLive) return;
    const t = setInterval(async () => {
      try {
        const st = (await agentGet(selectedId, "status")) as AgentStatus;
        setStatus(st);
      } catch {
        /* ignore poll errors */
      }
    }, 5000);
    return () => clearInterval(t);
  }, [selectedId, serverLive]);

  const visible = useMemo(
    () => fields.filter((f) => f.category === category),
    [fields, category],
  );

  function setValue(key: string, value: unknown) {
    if (!canEdit) return;
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function waitUntilStopped(timeoutMs: number) {
    if (!selectedId) return false;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const st = (await agentGet(selectedId, "status")) as AgentStatus;
      setStatus(st);
      if (!st.active) return true;
      await sleep(2000);
    }
    return false;
  }

  async function confirmShutdownForEdit() {
    if (!selectedId) return;
    const waitSec = Math.max(0, Math.floor(Number(shutdownWait) || 0));
    const message =
      shutdownMessage.trim() || DEFAULT_SHUTDOWN_MESSAGE;

    setBusy(true);
    setShowShutdownPrompt(false);
    toast(
      `Shutting down the server for config edits (${waitSec}s warning)…`,
    );
    try {
      try {
        await restPost(selectedId, "shutdown", {
          waittime: waitSec,
          message,
        });
      } catch (err) {
        toast(
          `Graceful REST shutdown failed (${err instanceof Error ? err.message : String(err)}). Stopping via agent…`,
          { error: true },
        );
        await agentPost(selectedId, "stop");
      }

      const stopped = await waitUntilStopped((waitSec + 45) * 1000);
      // Ensure systemd keeps it down (REST exits can look like failures).
      await agentPost(selectedId, "stop");
      const st = (await agentGet(selectedId, "status")) as AgentStatus;
      setStatus(st);

      if (!stopped && st.active) {
        toast("Server is still running — could not unlock settings editing", {
          error: true,
        });
      } else {
        toast("Server stopped. You can edit and save settings now.");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), { error: true });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function save(andStart: boolean) {
    if (!selectedId) return;
    if (!canEdit) {
      toast("Stop the server before saving settings", { error: true });
      return;
    }
    setBusy(true);
    try {
      const typed: Record<string, unknown> = {};
      for (const f of fields) {
        if (values[f.key] !== undefined) typed[f.key] = values[f.key];
      }
      await agentPutConfig(selectedId, { typed });
      setStartRequired(true);
      toast("Settings saved — start the server to apply");
      if (andStart) {
        await agentPost(selectedId, "start");
        toast("Server start requested");
        setStartRequired(false);
        await sleep(1500);
        const st = (await agentGet(selectedId, "status")) as AgentStatus;
        setStatus(st);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), { error: true });
    } finally {
      setBusy(false);
    }
  }

  if (!selectedId) return <NeedServer />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>
            View PalWorldSettings.ini by category. Palworld overwrites this file
            when the server shuts down, so edits are only allowed while it is
            stopped.
          </p>
        </div>
        <div className="btn-row">
          <button
            className="btn secondary"
            type="button"
            disabled={busy}
            onClick={() => load()}
          >
            Reload
          </button>
          {serverLive ? (
            <button
              className="btn warn"
              type="button"
              disabled={busy}
              onClick={() => setShowShutdownPrompt(true)}
            >
              Shut down to edit
            </button>
          ) : (
            <>
              <button
                className="btn secondary"
                type="button"
                disabled={busy || !canEdit}
                onClick={() => save(false)}
              >
                Save
              </button>
              <button
                className="btn"
                type="button"
                disabled={busy || !canEdit}
                onClick={() => save(true)}
              >
                Save & start
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="banner">{error}</div>}

      {serverLive && (
        <div className="banner">
          Server is live — settings are read-only. Shut down first to make
          changes; otherwise Palworld will discard INI edits on exit.
        </div>
      )}

      {showShutdownPrompt && (
        <section className="panel shutdown-prompt">
          <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.35rem" }}>
            Shut down to edit settings?
          </h2>
          <p style={{ color: "var(--ink-muted)", marginTop: 0 }}>
            This turns the server off after a player warning. You can edit and
            save once it is stopped, then start it again.
          </p>
          <div className="settings-grid" style={{ marginBottom: "1rem" }}>
            <div className="field">
              <label htmlFor="shutdown-wait">Warning time (seconds)</label>
              <input
                id="shutdown-wait"
                type="number"
                min={0}
                max={600}
                value={shutdownWait}
                onChange={(e) => setShutdownWait(Number(e.target.value))}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="shutdown-message">Shutdown message</label>
              <input
                id="shutdown-message"
                value={shutdownMessage}
                onChange={(e) => setShutdownMessage(e.target.value)}
              />
            </div>
          </div>
          <div className="btn-row">
            <button
              className="btn secondary"
              type="button"
              disabled={busy}
              onClick={() => setShowShutdownPrompt(false)}
            >
              Cancel
            </button>
            <button
              className="btn danger"
              type="button"
              disabled={busy}
              onClick={() => confirmShutdownForEdit()}
            >
              Shut down server
            </button>
          </div>
        </section>
      )}

      {!serverLive && startRequired && (
        <div className="banner">
          Start the server for saved INI changes to take effect.
        </div>
      )}

      <div className="tabs">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={category === c.id ? "active" : undefined}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <section className={`panel${canEdit ? "" : " settings-readonly"}`}>
        <p style={{ color: "var(--ink-muted)", marginTop: 0 }}>
          {categories.find((c) => c.id === category)?.description}
        </p>
        <div className="settings-grid">
          {visible.map((f) => (
            <FieldInput
              key={f.key}
              field={f}
              value={values[f.key]}
              disabled={!canEdit}
              onChange={(v) => setValue(f.key, v)}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  if (field.type === "boolean") {
    return (
      <div className="field">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          {field.label}
        </label>
        <span className="hint">{field.description}</span>
      </div>
    );
  }

  if (field.type === "enum" && field.enumValues) {
    return (
      <div className="field">
        <label htmlFor={field.key}>{field.label}</label>
        <select
          id={field.key}
          value={String(value ?? "")}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.enumValues.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <span className="hint">{field.description}</span>
      </div>
    );
  }

  if (field.type === "stringList") {
    const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
    return (
      <div className="field">
        <label htmlFor={field.key}>{field.label}</label>
        <input
          id={field.key}
          value={text}
          disabled={disabled}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          placeholder="Comma-separated"
        />
        <span className="hint">{field.description}</span>
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div className="field">
        <label htmlFor={field.key}>{field.label}</label>
        <input
          id={field.key}
          type="number"
          value={value === undefined || value === null ? "" : Number(value)}
          min={field.min}
          max={field.max}
          step="any"
          disabled={disabled}
          onChange={(e) =>
            onChange(e.target.value === "" ? 0 : Number(e.target.value))
          }
        />
        <span className="hint">{field.description}</span>
      </div>
    );
  }

  return (
    <div className="field">
      <label htmlFor={field.key}>{field.label}</label>
      <input
        id={field.key}
        type={field.sensitive ? "password" : "text"}
        value={String(value ?? "")}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      <span className="hint">{field.description}</span>
    </div>
  );
}
