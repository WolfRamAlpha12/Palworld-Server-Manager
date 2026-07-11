"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  agentGet,
  agentPost,
  agentPutConfig,
  fetchSchema,
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

export default function SettingsPage() {
  const { selectedId } = useSelectedServer();
  const { toast } = useToast();
  const [categories, setCategories] = useState<
    { id: string; label: string; description: string }[]
  >([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [category, setCategory] = useState("server");
  const [restartRequired, setRestartRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (cfg.restartRequired) setRestartRequired(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () => fields.filter((f) => f.category === category),
    [fields, category],
  );

  function setValue(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function save(andRestart: boolean) {
    if (!selectedId) return;
    setBusy(true);
    try {
      // Only send known schema keys that are present
      const typed: Record<string, unknown> = {};
      for (const f of fields) {
        if (values[f.key] !== undefined) typed[f.key] = values[f.key];
      }
      await agentPutConfig(selectedId, { typed });
      setRestartRequired(true);
      toast("Settings saved — restart required to apply");
      if (andRestart) {
        await agentPost(selectedId, "restart");
        toast("Restart requested");
        setRestartRequired(false);
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
            Edit PalWorldSettings.ini by category. Changes apply on the next
            server restart.
          </p>
        </div>
        <div className="btn-row">
          <button className="btn secondary" type="button" onClick={() => load()}>
            Reload
          </button>
          <button
            className="btn secondary"
            type="button"
            disabled={busy}
            onClick={() => save(false)}
          >
            Save
          </button>
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() => save(true)}
          >
            Save & restart
          </button>
        </div>
      </div>

      {error && <div className="banner">{error}</div>}
      {restartRequired && (
        <div className="banner">
          Restart required for saved INI changes to take effect.
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

      <section className="panel">
        <p style={{ color: "var(--ink-muted)", marginTop: 0 }}>
          {categories.find((c) => c.id === category)?.description}
        </p>
        <div className="settings-grid">
          {visible.map((f) => (
            <FieldInput
              key={f.key}
              field={f}
              value={values[f.key]}
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
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (field.type === "boolean") {
    return (
      <div className="field">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={Boolean(value)}
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
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
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
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      <span className="hint">{field.description}</span>
    </div>
  );
}
