import type { Connection } from "@solana/web3.js";
import { FileStore } from "@/lib/db/file-store";
import { SupabaseStore } from "@/lib/db/supabase-store";
import type { Store } from "@/lib/db/types";
import { ConfigError } from "@/lib/errors";
import { fetchBcbPtax, fetchMockPtax, type PtaxFetcher } from "@/lib/fx/ptax";
import { ensureMockSeeded } from "@/lib/mock/seed";
import { IS_MOCK } from "@/lib/mode";
import { getServerConnection } from "@/lib/solana/server-connection";

/**
 * Everything the service layer needs from the outside world. Services take
 * this as an argument instead of importing it, which is what lets the same
 * code run against devnet + Supabase, against the mock node, and in tests.
 */
export interface Deps {
  store: Store;
  connection: Connection;
  fetchPtax: PtaxFetcher;
  now: () => Date;
}

function liveStore(): Store {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new ConfigError(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, " +
        "or set NEXT_PUBLIC_RECEBI_MODE=mock to run without a database.",
    );
  }
  return new SupabaseStore(url, key);
}

/** The real dependencies for the current mode. Server only. */
export function getDeps(): Deps {
  if (IS_MOCK) ensureMockSeeded();
  return {
    store: IS_MOCK ? new FileStore() : liveStore(),
    connection: getServerConnection(),
    fetchPtax: IS_MOCK ? fetchMockPtax : fetchBcbPtax,
    now: () => new Date(),
  };
}
