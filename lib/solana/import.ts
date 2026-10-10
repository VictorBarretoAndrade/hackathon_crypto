import { PublicKey, type Connection, type ParsedTransactionWithMeta } from "@solana/web3.js";
import type { StableMint } from "@/lib/config/mints";
import { extractIncomingTransfer, type IncomingTransfer } from "@/lib/solana/parse";

const SIGNATURE_PAGE = 100;
/**
 * Transactions per JSON-RPC batch. Measured against the public devnet RPC: it
 * accepts batches of 5 and rejects batches of 10 outright.
 */
const TRANSACTION_BATCH = 5;
const PAUSE_BETWEEN_BATCHES_MS = 200;
/**
 * How long to wait before each retry after a "429 Too Many Requests". The
 * public RPC counts requests per method in 10-second windows, so the later
 * waits sit out a whole window.
 */
const RATE_LIMIT_WAITS_MS = [2_000, 5_000, 11_000, 11_000, 11_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRateLimit(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("429") || /too many requests/i.test(message);
}

/** Runs `task`, waiting and retrying while the RPC says it is being rate-limited. */
async function withRateLimitRetry<T>(task: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (!isRateLimit(error)) throw error;
      if (attempt >= RATE_LIMIT_WAITS_MS.length) {
        throw new Error(
          "The Solana RPC keeps rate-limiting us. Set NEXT_PUBLIC_RPC_URL to a devnet RPC " +
            "with an API key (Helius has a free plan) and try again.",
        );
      }
      await sleep(RATE_LIMIT_WAITS_MS[attempt]);
    }
  }
}

const TX_OPTIONS = { commitment: "confirmed", maxSupportedTransactionVersion: 0 } as const;

/**
 * Fetches parsed transactions in small batches. One batch is a single JSON-RPC
 * batch request; some free RPC plans reject those, so when a batch fails for a
 * reason other than rate limiting we fetch its transactions one at a time.
 */
async function fetchTransactions(
  connection: Connection,
  signatures: string[],
): Promise<(ParsedTransactionWithMeta | null)[]> {
  const transactions: (ParsedTransactionWithMeta | null)[] = [];
  for (let start = 0; start < signatures.length; start += TRANSACTION_BATCH) {
    const batch = signatures.slice(start, start + TRANSACTION_BATCH);
    if (start > 0) await sleep(PAUSE_BETWEEN_BATCHES_MS);
    try {
      transactions.push(
        ...(await withRateLimitRetry(() => connection.getParsedTransactions(batch, TX_OPTIONS))),
      );
    } catch (error) {
      if (isRateLimit(error)) throw error;
      for (const signature of batch) {
        transactions.push(
          await withRateLimitRetry(() => connection.getParsedTransaction(signature, TX_OPTIONS)),
        );
      }
    }
  }
  return transactions;
}

/** Signatures that touched `address`, newest first, paging with `before` up to `max`. */
async function fetchSignatures(connection: Connection, address: PublicKey, max: number): Promise<string[]> {
  const signatures: string[] = [];
  let before: string | undefined;
  while (signatures.length < max) {
    const limit = Math.min(SIGNATURE_PAGE, max - signatures.length);
    const page = await withRateLimitRetry(() =>
      connection.getSignaturesForAddress(address, { limit, before }, "confirmed"),
    );
    // Failed transactions moved no tokens: skip them before fetching anything.
    signatures.push(...page.filter((info) => !info.err).map((info) => info.signature));
    if (page.length < limit) break;
    before = page[page.length - 1].signature;
  }
  return signatures;
}

export interface ImportScan {
  transfers: IncomingTransfer[];
  /** How many transactions were inspected. */
  scanned: number;
}

/**
 * Reads a wallet's history and returns every incoming payment in the accepted
 * stablecoins.
 *
 * For each mint: find the wallet's token accounts, list the signatures that
 * touched them, fetch those transactions, and keep the ones where the wallet's
 * balance of that mint went up (see extractIncomingTransfer).
 */
export async function scanIncomingTransfers(
  connection: Connection,
  ownerWallet: string,
  mints: StableMint[],
  options: { maxSignaturesPerAccount?: number } = {},
): Promise<ImportScan> {
  const owner = new PublicKey(ownerWallet);
  const max = options.maxSignaturesPerAccount ?? 300;
  const transfers: IncomingTransfer[] = [];
  let scanned = 0;

  for (const { mint } of mints) {
    const { value: tokenAccounts } = await withRateLimitRetry(() =>
      connection.getParsedTokenAccountsByOwner(owner, { mint: new PublicKey(mint) }, "confirmed"),
    );

    // Two token accounts of the same wallet can appear in one transaction.
    const signatures = new Set<string>();
    for (const { pubkey } of tokenAccounts) {
      for (const signature of await fetchSignatures(connection, pubkey, max)) {
        signatures.add(signature);
      }
    }

    const transactions = await fetchTransactions(connection, [...signatures]);
    scanned += transactions.length;
    for (const tx of transactions) {
      const transfer = tx && extractIncomingTransfer(tx, ownerWallet, mint);
      if (transfer) transfers.push(transfer);
    }
  }
  return { transfers, scanned };
}
