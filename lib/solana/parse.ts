import { isMemoProgram } from "@/lib/solana/memo";

/**
 * The slice of a "jsonParsed" transaction that we read. Written structurally so
 * it accepts both what web3.js returns (addresses as PublicKey objects) and the
 * raw RPC JSON saved in test fixtures (addresses as strings).
 */
type AddressLike = string | { toBase58(): string };

interface TokenBalanceLike {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string; decimals: number };
}

interface InstructionLike {
  programId: AddressLike;
  parsed?: unknown;
}

export interface ParsedTransactionLike {
  blockTime?: number | null;
  meta: {
    err: unknown;
    logMessages?: string[] | null;
    preTokenBalances?: TokenBalanceLike[] | null;
    postTokenBalances?: TokenBalanceLike[] | null;
    innerInstructions?: { instructions: InstructionLike[] }[] | null;
  } | null;
  transaction: {
    signatures: string[];
    message: {
      accountKeys: { pubkey: AddressLike; signer: boolean }[];
      instructions: InstructionLike[];
    };
  };
}

function toAddress(value: AddressLike): string {
  return typeof value === "string" ? value : value.toBase58();
}

export interface TokenDeltas {
  /** Net change of `mint` per wallet (not per token account), in base units. */
  byOwner: Map<string, bigint>;
  /** Decimals of the mint, as reported by the node. Null if the mint is not in the transaction. */
  decimals: number | null;
}

/**
 * How much of `mint` each wallet gained or lost in a transaction, from the
 * pre/post token balances the node reports. Balances are the ground truth: this
 * works for any program that moves tokens, not only plain transfers.
 */
export function tokenDeltasByOwner(tx: ParsedTransactionLike, mint: string): TokenDeltas {
  const byOwner = new Map<string, bigint>();
  let decimals: number | null = null;

  const apply = (balances: TokenBalanceLike[] | null | undefined, sign: 1n | -1n) => {
    for (const balance of balances ?? []) {
      if (balance.mint !== mint || !balance.owner) continue;
      decimals = balance.uiTokenAmount.decimals;
      const amount = BigInt(balance.uiTokenAmount.amount) * sign;
      byOwner.set(balance.owner, (byOwner.get(balance.owner) ?? 0n) + amount);
    }
  };
  // A token account missing from "pre" was created in this transaction (it had
  // 0); one missing from "post" was closed. Summing handles both.
  apply(tx.meta?.postTokenBalances, 1n);
  apply(tx.meta?.preTokenBalances, -1n);

  return { byOwner, decimals };
}

/** Rust prints the memo with {:?}: quoted and escaped. Undo that. */
function unquoteLoggedMemo(quoted: string): string {
  try {
    const parsed: unknown = JSON.parse(quoted);
    if (typeof parsed === "string") return parsed;
  } catch {
    // Not valid JSON escaping (rare): fall through to a plain strip.
  }
  return quoted.slice(1, -1);
}

/**
 * Every memo in a transaction. Reads Memo program instructions the node already
 * parsed (top level and inner); if there are none, falls back to the program
 * logs, which is where memos sent through other programs end up.
 */
export function extractMemos(tx: ParsedTransactionLike): string[] {
  const instructions = [
    ...tx.transaction.message.instructions,
    ...(tx.meta?.innerInstructions ?? []).flatMap((group) => group.instructions),
  ];
  const memos = instructions
    .filter((ix) => isMemoProgram(toAddress(ix.programId)) && typeof ix.parsed === "string")
    .map((ix) => ix.parsed as string);
  if (memos.length > 0) return memos;

  const fromLogs: string[] = [];
  for (const line of tx.meta?.logMessages ?? []) {
    const match = /^Program log: Memo \(len \d+\): (".*")$/.exec(line);
    if (match) fromLogs.push(unquoteLoggedMemo(match[1]));
  }
  return fromLogs;
}

/** Wallets that signed the transaction. */
export function transactionSigners(tx: ParsedTransactionLike): string[] {
  return tx.transaction.message.accountKeys
    .filter((key) => key.signer)
    .map((key) => toAddress(key.pubkey));
}

export interface IncomingTransfer {
  signature: string;
  mint: string;
  /** Amount received, in base units. Always positive. */
  amountRaw: bigint;
  decimals: number;
  /** The wallet whose balance of this mint dropped the most. Null if none did (e.g. a mint). */
  payerWallet: string | null;
  /** Unix seconds, as reported by the node. */
  blockTime: number | null;
  memo: string | null;
}

/**
 * Decides whether a transaction is an incoming payment of `mint` to
 * `ownerWallet`, and if so extracts it. Returns null for failed transactions
 * and for anything that did not increase the wallet's balance.
 */
export function extractIncomingTransfer(
  tx: ParsedTransactionLike,
  ownerWallet: string,
  mint: string,
): IncomingTransfer | null {
  if (!tx.meta || tx.meta.err) return null;

  const { byOwner, decimals } = tokenDeltasByOwner(tx, mint);
  const received = byOwner.get(ownerWallet) ?? 0n;
  if (received <= 0n || decimals === null) return null;

  let payerWallet: string | null = null;
  let largestDrop = 0n;
  for (const [owner, delta] of byOwner) {
    if (owner !== ownerWallet && delta < largestDrop) {
      largestDrop = delta;
      payerWallet = owner;
    }
  }

  const memos = extractMemos(tx);
  return {
    signature: tx.transaction.signatures[0],
    mint,
    amountRaw: received,
    decimals,
    payerWallet,
    blockTime: tx.blockTime ?? null,
    memo: memos.length > 0 ? memos.join(" | ") : null,
  };
}
