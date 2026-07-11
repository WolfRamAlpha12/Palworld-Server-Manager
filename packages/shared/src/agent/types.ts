/** Host agent HTTP API contracts */

export type ServiceState =
  | "active"
  | "inactive"
  | "activating"
  | "deactivating"
  | "failed"
  | "unknown";

export interface AgentHealth {
  ok: true;
  version: string;
  hostname: string;
  installRoot: string;
  serviceUnit: string;
}

export interface AgentStatus {
  service: ServiceState;
  active: boolean;
  pid?: number | null;
  lastExitCode?: number | null;
  restApiEnabled?: boolean;
  restApiPort?: number;
  settingsPath: string;
  installRoot: string;
}

export interface AgentActionResult {
  ok: boolean;
  message: string;
  status?: AgentStatus;
}

export interface AgentConfigResponse {
  settings: Record<string, string>;
  typed: Record<string, unknown>;
  path: string;
  restartRequired: boolean;
}

export interface AgentConfigUpdateRequest {
  /** Raw string values (INI literals) and/or typed values */
  settings?: Record<string, string>;
  typed?: Record<string, unknown>;
  /** Force REST API on with given port/password */
  ensureRest?: {
    enabled?: boolean;
    port?: number;
    adminPassword?: string;
  };
}

export interface AgentConfigUpdateResponse {
  ok: boolean;
  path: string;
  restartRequired: true;
  settings: Record<string, string>;
}

export interface AgentUpdateStatus {
  running: boolean;
  exitCode?: number | null;
  log: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface AgentLogsQuery {
  source?: "journal" | "file";
  lines?: number;
  follow?: boolean;
}

/** Manager-side server profile (persisted in SQLite) */
export interface ServerProfile {
  id: string;
  name: string;
  host: string;
  restPort: number;
  agentPort: number;
  /** Encrypted at rest in DB */
  adminPassword: string;
  /** Encrypted at rest in DB */
  agentSecret: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerProfileInput {
  name: string;
  host: string;
  restPort?: number;
  agentPort?: number;
  adminPassword: string;
  agentSecret: string;
}

export interface ConnectivityCheckResult {
  agent: { ok: boolean; latencyMs?: number; error?: string; health?: AgentHealth };
  rest: { ok: boolean; latencyMs?: number; error?: string; info?: unknown };
}
