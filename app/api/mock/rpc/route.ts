import { NextResponse } from "next/server";
import { notFound } from "@/lib/errors";
import { route } from "@/lib/http";
import { handleMockRpc } from "@/lib/mock/rpc";
import { ensureMockSeeded } from "@/lib/mock/seed";
import { IS_MOCK } from "@/lib/mode";

/**
 * The fake Solana node of mock mode, speaking JSON-RPC. The browser's web3.js
 * Connection points here instead of at devnet. Does not exist in live mode.
 */
export const POST = route(async (request: Request) => {
  if (!IS_MOCK) throw notFound("Route");
  ensureMockSeeded();
  return NextResponse.json(handleMockRpc(await request.json()));
});
