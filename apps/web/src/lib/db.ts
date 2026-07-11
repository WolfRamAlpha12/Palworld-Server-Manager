import Database from "better-sqlite3";
import { join } from "node:path";
import { v4 as uuid } from "uuid";
import type { ServerProfile, ServerProfileInput } from "@psm/shared";
import { dataDir, decrypt, encrypt, useEnvKeyIfPresent } from "./crypto";

useEnvKeyIfPresent();

type Row = {
  id: string;
  name: string;
  host: string;
  rest_port: number;
  agent_port: number;
  admin_password_enc: string;
  agent_secret_enc: string;
  created_at: string;
  updated_at: string;
};

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  const path = join(dataDir(), "manager.db");
  db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      rest_port INTEGER NOT NULL DEFAULT 8212,
      agent_port INTEGER NOT NULL DEFAULT 9100,
      admin_password_enc TEXT NOT NULL,
      agent_secret_enc TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

function rowToProfile(row: Row): ServerProfile {
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    restPort: row.rest_port,
    agentPort: row.agent_port,
    adminPassword: decrypt(row.admin_password_enc),
    agentSecret: decrypt(row.agent_secret_enc),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Public shape without secrets */
export function toPublic(profile: ServerProfile) {
  return {
    id: profile.id,
    name: profile.name,
    host: profile.host,
    restPort: profile.restPort,
    agentPort: profile.agentPort,
    hasAdminPassword: Boolean(profile.adminPassword),
    hasAgentSecret: Boolean(profile.agentSecret),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export function listServers(): ServerProfile[] {
  const rows = getDb()
    .prepare("SELECT * FROM servers ORDER BY name COLLATE NOCASE")
    .all() as Row[];
  return rows.map(rowToProfile);
}

export function getServer(id: string): ServerProfile | null {
  const row = getDb().prepare("SELECT * FROM servers WHERE id = ?").get(id) as
    | Row
    | undefined;
  return row ? rowToProfile(row) : null;
}

export function createServer(input: ServerProfileInput): ServerProfile {
  const now = new Date().toISOString();
  const profile: ServerProfile = {
    id: uuid(),
    name: input.name.trim(),
    host: input.host.trim(),
    restPort: input.restPort ?? 8212,
    agentPort: input.agentPort ?? 9100,
    adminPassword: input.adminPassword,
    agentSecret: input.agentSecret,
    createdAt: now,
    updatedAt: now,
  };
  getDb()
    .prepare(
      `INSERT INTO servers
      (id, name, host, rest_port, agent_port, admin_password_enc, agent_secret_enc, created_at, updated_at)
      VALUES (@id, @name, @host, @rest_port, @agent_port, @admin_password_enc, @agent_secret_enc, @created_at, @updated_at)`,
    )
    .run({
      id: profile.id,
      name: profile.name,
      host: profile.host,
      rest_port: profile.restPort,
      agent_port: profile.agentPort,
      admin_password_enc: encrypt(profile.adminPassword),
      agent_secret_enc: encrypt(profile.agentSecret),
      created_at: profile.createdAt,
      updated_at: profile.updatedAt,
    });
  return profile;
}

export function updateServer(
  id: string,
  input: Partial<ServerProfileInput>,
): ServerProfile | null {
  const existing = getServer(id);
  if (!existing) return null;
  const updated: ServerProfile = {
    ...existing,
    name: input.name?.trim() ?? existing.name,
    host: input.host?.trim() ?? existing.host,
    restPort: input.restPort ?? existing.restPort,
    agentPort: input.agentPort ?? existing.agentPort,
    adminPassword:
      input.adminPassword !== undefined && input.adminPassword !== ""
        ? input.adminPassword
        : existing.adminPassword,
    agentSecret:
      input.agentSecret !== undefined && input.agentSecret !== ""
        ? input.agentSecret
        : existing.agentSecret,
    updatedAt: new Date().toISOString(),
  };
  getDb()
    .prepare(
      `UPDATE servers SET
        name = @name,
        host = @host,
        rest_port = @rest_port,
        agent_port = @agent_port,
        admin_password_enc = @admin_password_enc,
        agent_secret_enc = @agent_secret_enc,
        updated_at = @updated_at
      WHERE id = @id`,
    )
    .run({
      id,
      name: updated.name,
      host: updated.host,
      rest_port: updated.restPort,
      agent_port: updated.agentPort,
      admin_password_enc: encrypt(updated.adminPassword),
      agent_secret_enc: encrypt(updated.agentSecret),
      updated_at: updated.updatedAt,
    });
  return updated;
}

export function deleteServer(id: string): boolean {
  const result = getDb().prepare("DELETE FROM servers WHERE id = ?").run(id);
  return result.changes > 0;
}
