"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { IS_MOCK } from "@/lib/mode";

/**
 * Always visible in mock mode, on every page. Nobody looking at the screen
 * should be able to mistake simulated data for something onchain.
 */
export function MockBanner() {
  const [resetting, setResetting] = useState(false);
  if (!IS_MOCK) return null;

  async function reset() {
    setResetting(true);
    try {
      await api("/api/mock/reset", { method: "POST" });
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      // A full page load on purpose (not a router navigation): it drops every
      // piece of client state that was built on the old data.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    }
  }

  return (
    <div className="bg-ink text-paper">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-2 text-xs sm:px-8">
        <p>
          <span className="font-semibold uppercase tracking-wider">Mock mode</span>
          <span className="text-paper/70">
            {" "}
            · simulated ledger, demo wallet and sample exchange rates. Nothing here is onchain.
          </span>
        </p>
        <button
          type="button"
          onClick={reset}
          disabled={resetting}
          className="underline underline-offset-4 hover:no-underline disabled:opacity-60"
        >
          {resetting ? "Resetting…" : "Reset demo data"}
        </button>
      </div>
    </div>
  );
}
