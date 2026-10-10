import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Same "@/..." alias as tsconfig.json.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)).replace(/[\\/]$/, "") },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // The mock ledger and database stay in memory: tests never write .mock-data/.
    env: { RECEBI_MOCK_PERSIST: "off" },
  },
});
