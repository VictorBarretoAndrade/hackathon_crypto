import { Connection, type FetchFn } from "@solana/web3.js";
import { handleMockRpc } from "@/lib/mock/rpc";
import { IS_MOCK } from "@/lib/mode";
import { RPC_URL } from "@/lib/solana/cluster";

/**
 * Stands in for the network in mock mode: instead of an HTTP round trip to our
 * own /api/mock/rpc route, the request goes straight to the handler.
 */
const mockFetch = (async (_url: unknown, init?: { body?: unknown }) => {
  const result = handleMockRpc(JSON.parse(String(init?.body)));
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}) as unknown as FetchFn;

/** A web3.js connection wired to the mock node, for server code and tests. */
export function createMockConnection(): Connection {
  return new Connection("http://recebi-mock.invalid", {
    commitment: "confirmed",
    fetch: mockFetch,
    disableRetryOnRateLimit: true,
  });
}

/** RPC connection for server code: devnet in live mode, the mock node in mock mode. */
export function getServerConnection(): Connection {
  return IS_MOCK ? createMockConnection() : new Connection(RPC_URL, "confirmed");
}
