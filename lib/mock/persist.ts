import fs from "node:fs";
import path from "node:path";

/**
 * Tiny JSON-file persistence for mock mode, so the demo data survives a dev
 * server restart. State lives on globalThis because Next.js may load a module
 * more than once (one copy per route in development); the file is only a backup.
 *
 * RECEBI_MOCK_PERSIST=off keeps everything in memory (used by the tests).
 */
function mockDir(): string {
  return process.env.RECEBI_MOCK_DIR || path.join(process.cwd(), ".mock-data");
}

function persistenceEnabled(): boolean {
  return process.env.RECEBI_MOCK_PERSIST !== "off";
}

const globalStore = globalThis as { __recebiMock?: Record<string, unknown> };

/** Returns the shared state called `name`, loading it from disk or creating it. */
export function loadState<T>(name: string, create: () => T): T {
  globalStore.__recebiMock ??= {};
  const cache = globalStore.__recebiMock;
  if (!(name in cache)) {
    let state: T | undefined;
    if (persistenceEnabled()) {
      try {
        state = JSON.parse(fs.readFileSync(path.join(mockDir(), `${name}.json`), "utf8")) as T;
      } catch {
        // No file yet, or unreadable: start fresh.
      }
    }
    cache[name] = state ?? create();
  }
  return cache[name] as T;
}

/** Replaces the shared state called `name` and writes it to disk. */
export function saveState<T>(name: string, state: T): void {
  globalStore.__recebiMock ??= {};
  globalStore.__recebiMock[name] = state;
  if (!persistenceEnabled()) return;
  try {
    fs.mkdirSync(mockDir(), { recursive: true });
    fs.writeFileSync(path.join(mockDir(), `${name}.json`), JSON.stringify(state, null, 2));
  } catch {
    // Read-only file system (e.g. serverless): keep working from memory.
  }
}
