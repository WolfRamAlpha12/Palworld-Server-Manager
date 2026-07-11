#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const version =
  process.env.PSM_AGENT_VERSION || pkg.version || "0.0.0";

await esbuild.build({
  entryPoints: [join(root, "src/index.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: join(root, "dist/agent.mjs"),
  define: {
    "process.env.PSM_AGENT_VERSION": JSON.stringify(version),
  },
  alias: {
    "@psm/shared": join(root, "../../packages/shared/src/index.ts"),
  },
  logLevel: "info",
});

console.log(`Bundled agent.mjs (version ${version})`);
