import { Connection } from "@solana/web3.js";

/** Recebi is a devnet-only MVP. There is no mainnet code path. */
export const CLUSTER = "devnet";

export const PUBLIC_DEVNET_RPC = "https://api.devnet.solana.com";

/**
 * Genesis hash of Solana devnet. An RPC URL says nothing reliable about the
 * network behind it, so we ask the node and compare.
 */
export const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

/** Throws unless the configured cluster is devnet (or unset). */
export function assertDevnetCluster(value: string | undefined): void {
  const cluster = value?.trim() || CLUSTER;
  if (cluster !== CLUSTER) {
    throw new Error(
      `NEXT_PUBLIC_SOLANA_CLUSTER is "${cluster}", but Recebi only runs on devnet`,
    );
  }
}

/** The configured RPC URL, or the public devnet endpoint when none is set. */
export function resolveRpcUrl(value: string | undefined): string {
  return value?.trim() || PUBLIC_DEVNET_RPC;
}

assertDevnetCluster(process.env.NEXT_PUBLIC_SOLANA_CLUSTER);

export const RPC_URL = resolveRpcUrl(process.env.NEXT_PUBLIC_RPC_URL);

/** A new RPC connection, for server code. Client code uses useConnection(). */
export function createConnection(): Connection {
  return new Connection(RPC_URL, "confirmed");
}

/** True when the node behind `connection` really is on devnet. */
export async function isDevnet(connection: Connection): Promise<boolean> {
  return (await connection.getGenesisHash()) === DEVNET_GENESIS_HASH;
}

export function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${CLUSTER}`;
}

export function explorerAddressUrl(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=${CLUSTER}`;
}
