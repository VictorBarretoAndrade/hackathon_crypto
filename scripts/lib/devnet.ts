// Shared helpers for the devnet scripts (seed-demo.ts and live-check.ts).
import fs from "node:fs";
import path from "node:path";
import { Connection, Keypair, Transaction, type Signer } from "@solana/web3.js";

export const KEYS_DIR = path.join(process.cwd(), ".demo-keys");

/** Loads .env.local into process.env (scripts do not get it from Next.js). */
export function loadEnv(): void {
  for (const file of [".env.local", ".env"]) {
    if (fs.existsSync(file)) process.loadEnvFile(file);
  }
}

/** A devnet connection, refusing anything that is not devnet. */
export async function devnetConnection(): Promise<Connection> {
  const url = process.env.NEXT_PUBLIC_RPC_URL?.trim() || "https://api.devnet.solana.com";
  const connection = new Connection(url, "confirmed");
  const genesis = await connection.getGenesisHash();
  if (genesis !== "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG") {
    throw new Error(`NEXT_PUBLIC_RPC_URL is not a devnet RPC (genesis ${genesis}). Refusing to continue.`);
  }
  return connection;
}

/**
 * Loads a keypair from .demo-keys/<name>.json, creating it on first use. The
 * format is the Solana CLI's: a JSON array of the 64 secret key bytes.
 * DEVNET ONLY. The folder is git-ignored.
 */
export function loadOrCreateKeypair(name: string): Keypair {
  const file = path.join(KEYS_DIR, `${name}.json`);
  if (fs.existsSync(file)) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))));
  }
  const keypair = Keypair.generate();
  fs.mkdirSync(KEYS_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify([...keypair.secretKey]));
  return keypair;
}

export function hasKeypair(name: string): boolean {
  return fs.existsSync(path.join(KEYS_DIR, `${name}.json`));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls until a signature is confirmed (no WebSocket needed). */
export async function confirm(connection: Connection, signature: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const status = (await connection.getSignatureStatuses([signature])).value[0];
    if (status?.err) throw new Error(`Transaction ${signature} failed: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    await sleep(1000);
  }
  throw new Error(`Transaction ${signature} was not confirmed within 60 seconds`);
}

/** Signs, sends and confirms a transaction. The first signer pays the fee. */
export async function sendTransaction(
  connection: Connection,
  transaction: Transaction,
  signers: Signer[],
): Promise<string> {
  transaction.feePayer = signers[0].publicKey;
  transaction.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  transaction.sign(...signers);
  const signature = await connection.sendRawTransaction(transaction.serialize());
  await confirm(connection, signature);
  return signature;
}
