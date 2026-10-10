// Starts the dev server in a given mode, on any OS:
//   node scripts/dev.mjs mock
//   node scripts/dev.mjs live
// A variable set here wins over the one in .env.local.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const mode = process.argv[2];
if (mode !== "mock" && mode !== "live") {
  console.error("Usage: node scripts/dev.mjs <mock|live>");
  process.exit(1);
}

const next = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const child = spawn(process.execPath, [next, "dev", ...process.argv.slice(3)], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_RECEBI_MODE: mode },
});
child.on("exit", (code) => process.exit(code ?? 0));
