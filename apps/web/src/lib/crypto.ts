import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = process.env.PSM_DATA_DIR ?? join(process.cwd(), "data");
const KEY_PATH = join(DATA_DIR, "encryption.key");

function ensureKey(): Buffer {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (existsSync(KEY_PATH)) {
    return Buffer.from(readFileSync(KEY_PATH, "utf8").trim(), "hex");
  }
  const key = randomBytes(32);
  writeFileSync(KEY_PATH, key.toString("hex"), { mode: 0o600 });
  return key;
}

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (!cachedKey) cachedKey = ensureKey();
  return cachedKey;
}

/** Encrypt a UTF-8 string; returns `iv:tag:ciphertext` hex. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decrypt(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Invalid ciphertext");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

export function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function dataDir(): string {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  return DATA_DIR;
}

export function keyPath(): string {
  return KEY_PATH;
}

/** Derive a stable key from env override if provided (for multi-replica). */
export function useEnvKeyIfPresent(): void {
  const envKey = process.env.PSM_ENCRYPTION_KEY;
  if (envKey) {
    cachedKey = scryptSync(envKey, "psm-salt", 32);
  }
}
