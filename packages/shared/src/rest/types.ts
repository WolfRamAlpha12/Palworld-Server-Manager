/** Official Palworld REST API types (/v1/api/*) */

export interface RestInfo {
  version?: string;
  servername?: string;
  description?: string;
  [key: string]: unknown;
}

export interface RestMetrics {
  currentplayernum?: number;
  serverfps?: number;
  serverframetime?: number;
  maxplayernum?: number;
  uptime?: number;
  [key: string]: unknown;
}

export interface RestPlayer {
  name?: string;
  playerId?: string;
  userId?: string;
  ip?: string;
  ping?: number;
  location_x?: number;
  location_y?: number;
  level?: number;
  [key: string]: unknown;
}

export interface RestPlayersResponse {
  players?: RestPlayer[];
  [key: string]: unknown;
}

export interface RestAnnounceBody {
  message: string;
}

export interface RestKickBanBody {
  userid: string;
  message?: string;
}

export interface RestUnbanBody {
  userid: string;
}

export interface RestShutdownBody {
  waittime?: number;
  message?: string;
}

export type RestEndpoint =
  | "info"
  | "settings"
  | "metrics"
  | "players"
  | "announce"
  | "kick"
  | "ban"
  | "unban"
  | "save"
  | "shutdown"
  | "stop";

export const REST_GET_ENDPOINTS = [
  "info",
  "settings",
  "metrics",
  "players",
] as const;

export const REST_POST_ENDPOINTS = [
  "announce",
  "kick",
  "ban",
  "unban",
  "save",
  "shutdown",
  "stop",
] as const;
