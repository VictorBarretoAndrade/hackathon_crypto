import type { Connection, PublicKey, Transaction } from "@solana/web3.js";

export type SignTransaction = (transaction: Transaction) => Promise<Transaction>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Waits until a transaction is confirmed, by polling its status.
 *
 * web3.js's own confirmTransaction relies on a WebSocket subscription, which
 * some RPC providers drop and which our mock node does not have. Polling one
 * cheap method once a second works everywhere.
 */
export async function waitForSignature(
  connection: Connection,
  signature: string,
  { timeoutMs = 60_000, intervalMs = 1_000 } = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];
    if (status?.err) {
      throw new Error(`Transaction failed onchain: ${JSON.stringify(status.err)}`);
    }
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      return;
    }
    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for the transaction to confirm. Check it on the explorer.");
    }
    await sleep(intervalMs);
  }
}

/**
 * Has the wallet sign `transaction`, then sends it through OUR connection and
 * waits for confirmation. Returns the signature.
 *
 * We deliberately do not use the wallet's own "sign and send": that goes
 * through whatever network the wallet happens to be on. Sending it ourselves
 * means the transaction can only ever reach the RPC this app is configured for.
 */
export async function signAndSend(options: {
  connection: Connection;
  transaction: Transaction;
  feePayer: PublicKey;
  signTransaction: SignTransaction;
}): Promise<string> {
  const { connection, transaction, feePayer, signTransaction } = options;
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  transaction.feePayer = feePayer;
  transaction.recentBlockhash = blockhash;

  const signed = await signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    preflightCommitment: "confirmed",
  });
  await waitForSignature(connection, signature);
  return signature;
}
