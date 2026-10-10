import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { loadState, saveState } from "@/lib/mock/persist";
import { formatUnits } from "@/lib/money/units";
import { isMemoProgram } from "@/lib/solana/memo";

/**
 * A miniature Solana, for mock mode only.
 *
 * It accepts real, signed legacy transactions, checks their signatures, runs
 * the three programs Recebi uses (SPL Token transfers, Associated Token Account
 * creation and Memo) against an in-memory table of token accounts, and stores
 * the result in the same "jsonParsed" shape a real RPC node returns. That is
 * why the import, seal and verify code does not know it is being mocked.
 *
 * It is NOT a validator: no SOL, no fees, no rent, no other programs.
 */

const TOKEN_PROGRAM = TOKEN_PROGRAM_ID.toBase58();
const ATA_PROGRAM = ASSOCIATED_TOKEN_PROGRAM_ID.toBase58();
const COMPUTE_BUDGET_PROGRAM = "ComputeBudget111111111111111111111111111111";
const MOCK_FEE_LAMPORTS = 5000;

interface TokenAccount {
  mint: string;
  owner: string;
  /** Base units, as a decimal string. */
  amount: string;
}

interface StoredTransaction {
  signature: string;
  slot: number;
  blockTime: number;
  /** Every address the transaction references, for getSignaturesForAddress. */
  accounts: string[];
  memo: string | null;
  /** The getTransaction (jsonParsed) result, ready to return. */
  response: unknown;
}

interface LedgerState {
  slot: number;
  mints: Record<string, { decimals: number }>;
  tokenAccounts: Record<string, TokenAccount>;
  transactions: StoredTransaction[];
}

/** An error the mock node reports to the client as a JSON-RPC error. */
export class MockRpcError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

function emptyState(): LedgerState {
  return { slot: 1000, mints: {}, tokenAccounts: {}, transactions: [] };
}

function state(): LedgerState {
  return loadState("ledger", emptyState);
}

function failed(message: string): MockRpcError {
  return new MockRpcError(-32002, `Transaction simulation failed: ${message}`);
}

function uiTokenAmount(amount: string, decimals: number) {
  const uiAmountString = formatUnits(BigInt(amount), decimals);
  // uiAmount is a float only because the real RPC returns one. Nobody reads it.
  return { amount, decimals, uiAmount: Number(uiAmountString), uiAmountString };
}

function tokenBalances(accounts: Record<string, TokenAccount>, keys: string[], ledger: LedgerState) {
  return keys.flatMap((address, accountIndex) => {
    const account = accounts[address];
    if (!account) return [];
    return [
      {
        accountIndex,
        mint: account.mint,
        owner: account.owner,
        programId: TOKEN_PROGRAM,
        uiTokenAmount: uiTokenAmount(account.amount, ledger.mints[account.mint].decimals),
      },
    ];
  });
}

export function ataAddress(owner: string, mint: string): string {
  return getAssociatedTokenAddressSync(new PublicKey(mint), new PublicKey(owner), true).toBase58();
}

/** Wipes the ledger. */
export function resetLedger(): void {
  saveState("ledger", emptyState());
}

export function ledgerSlot(): number {
  return state().slot;
}

/** Registers a token. There is no mint authority: tokens appear through `faucet`. */
export function registerMint(mint: string, decimals: number): void {
  const ledger = state();
  ledger.mints[mint] = { decimals };
  saveState("ledger", ledger);
}

/** Gives `owner` tokens out of thin air, creating the token account if needed. Seeding only. */
export function faucet(owner: string, mint: string, amountRaw: bigint): void {
  const ledger = state();
  if (!ledger.mints[mint]) throw new Error(`mock ledger: unknown mint ${mint}`);
  const address = ataAddress(owner, mint);
  const current = BigInt(ledger.tokenAccounts[address]?.amount ?? "0");
  ledger.tokenAccounts[address] = { mint, owner, amount: (current + amountRaw).toString() };
  saveState("ledger", ledger);
}

/**
 * Executes a signed transaction and records it. Returns its signature.
 * `blockTime` lets the seeder back-date demo payments.
 */
export function processTransaction(raw: Uint8Array, options: { blockTime?: number } = {}): string {
  const ledger = state();

  let tx: Transaction;
  try {
    tx = Transaction.from(raw);
  } catch {
    throw new MockRpcError(-32602, "mock ledger: could not decode the transaction");
  }
  if (!tx.signature || !tx.verifySignatures()) {
    throw new MockRpcError(
      -32003,
      "Transaction signature verification failure (the mock ledger accepts legacy transactions only)",
    );
  }

  const signature = bs58.encode(tx.signature);
  if (ledger.transactions.some((stored) => stored.signature === signature)) return signature;

  const message = tx.compileMessage();
  const keys = message.accountKeys.map((key) => key.toBase58());
  const signers = new Set(keys.filter((_, index) => message.isAccountSigner(index)));

  // Instructions run against a copy, so a failing transaction changes nothing.
  const accounts: Record<string, TokenAccount> = structuredClone(ledger.tokenAccounts);
  const preTokenBalances = tokenBalances(accounts, keys, ledger);
  const logMessages: string[] = [];
  const instructions: unknown[] = [];
  const memos: string[] = [];

  for (const ix of tx.instructions) {
    const programId = ix.programId.toBase58();
    const ixKeys = ix.keys.map((key) => key.pubkey.toBase58());
    logMessages.push(`Program ${programId} invoke [1]`);

    if (isMemoProgram(programId)) {
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(ix.data);
      } catch {
        throw failed("memo is not valid UTF-8");
      }
      if (ixKeys.some((key) => !signers.has(key))) {
        throw failed("memo lists an account that did not sign");
      }
      memos.push(text);
      logMessages.push(`Program log: Memo (len ${ix.data.length}): ${JSON.stringify(text)}`);
      instructions.push({ parsed: text, program: "spl-memo", programId, stackHeight: 1 });
    } else if (programId === TOKEN_PROGRAM) {
      instructions.push(runTokenInstruction(ix.data, ixKeys, signers, accounts, ledger));
    } else if (programId === ATA_PROGRAM) {
      instructions.push(runAtaInstruction(ix.data, ixKeys, accounts, ledger));
    } else if (programId === COMPUTE_BUDGET_PROGRAM) {
      instructions.push({ programId, accounts: [], data: bs58.encode(ix.data), stackHeight: 1 });
    } else {
      throw failed(`the mock ledger does not implement program ${programId}`);
    }
    logMessages.push(`Program ${programId} success`);
  }

  const slot = ledger.slot + 1;
  const blockTime = options.blockTime ?? Math.floor(Date.now() / 1000);
  const response = {
    slot,
    blockTime,
    version: "legacy",
    transaction: {
      signatures: tx.signatures.map((entry) => bs58.encode(entry.signature!)),
      message: {
        accountKeys: keys.map((pubkey, index) => ({
          pubkey,
          signer: message.isAccountSigner(index),
          writable: message.isAccountWritable(index),
          source: "transaction",
        })),
        instructions,
        recentBlockhash: tx.recentBlockhash,
      },
    },
    meta: {
      err: null,
      status: { Ok: null },
      fee: MOCK_FEE_LAMPORTS,
      preBalances: keys.map(() => 0),
      postBalances: keys.map(() => 0),
      innerInstructions: [],
      logMessages,
      preTokenBalances,
      postTokenBalances: tokenBalances(accounts, keys, ledger),
      rewards: [],
      computeUnitsConsumed: 0,
    },
  };

  ledger.slot = slot;
  ledger.tokenAccounts = accounts;
  ledger.transactions.push({
    signature,
    slot,
    blockTime,
    accounts: keys,
    memo: memos.length > 0 ? memos.join("; ") : null,
    response,
  });
  saveState("ledger", ledger);
  return signature;
}

function runTokenInstruction(
  data: Buffer,
  keys: string[],
  signers: Set<string>,
  accounts: Record<string, TokenAccount>,
  ledger: LedgerState,
): unknown {
  const TRANSFER = 3;
  const TRANSFER_CHECKED = 12;
  const kind = data[0];
  if (kind !== TRANSFER && kind !== TRANSFER_CHECKED) {
    throw failed(`the mock ledger does not implement token instruction ${kind}`);
  }

  const amount = data.readBigUInt64LE(1);
  const checked = kind === TRANSFER_CHECKED;
  // TransferChecked: [source, mint, destination, authority]. Transfer: [source, destination, authority].
  const sourceKey = keys[0];
  const mintKey = checked ? keys[1] : null;
  const destinationKey = checked ? keys[2] : keys[1];
  const authority = checked ? keys[3] : keys[2];

  const source = accounts[sourceKey];
  const destination = accounts[destinationKey];
  if (!source) throw failed("source token account does not exist");
  if (!destination) throw failed("destination token account does not exist");
  if (source.mint !== destination.mint) throw failed("token accounts are for different mints");
  if (source.owner !== authority) throw failed("authority does not own the source account");
  if (!signers.has(authority)) throw failed("authority did not sign");

  const decimals = ledger.mints[source.mint].decimals;
  if (checked && (mintKey !== source.mint || data[9] !== decimals)) {
    throw failed("mint or decimals do not match the source account");
  }
  if (BigInt(source.amount) < amount) throw failed("insufficient funds");

  accounts[sourceKey] = { ...source, amount: (BigInt(source.amount) - amount).toString() };
  // Read the destination again: it may be the same account as the source.
  const target = accounts[destinationKey];
  accounts[destinationKey] = { ...target, amount: (BigInt(target.amount) + amount).toString() };

  const info = checked
    ? {
        authority,
        destination: destinationKey,
        mint: source.mint,
        source: sourceKey,
        tokenAmount: uiTokenAmount(amount.toString(), decimals),
      }
    : { amount: amount.toString(), authority, destination: destinationKey, source: sourceKey };
  return {
    parsed: { info, type: checked ? "transferChecked" : "transfer" },
    program: "spl-token",
    programId: TOKEN_PROGRAM,
    stackHeight: 1,
  };
}

function runAtaInstruction(
  data: Buffer,
  keys: string[],
  accounts: Record<string, TokenAccount>,
  ledger: LedgerState,
): unknown {
  // Data is empty or [0] for Create, [1] for CreateIdempotent.
  const idempotent = data.length > 0 && data[0] === 1;
  const [payer, account, wallet, mint, systemProgram, tokenProgram] = keys;

  if (!ledger.mints[mint]) throw failed(`unknown mint ${mint}`);
  if (account !== ataAddress(wallet, mint)) {
    throw failed("account is not the associated token address of this wallet and mint");
  }
  if (accounts[account]) {
    if (!idempotent) throw failed("associated token account already exists");
  } else {
    accounts[account] = { mint, owner: wallet, amount: "0" };
  }

  return {
    parsed: {
      info: { account, mint, source: payer, systemProgram, tokenProgram, wallet },
      type: idempotent ? "createIdempotent" : "create",
    },
    program: "spl-associated-token-account",
    programId: ATA_PROGRAM,
    stackHeight: 1,
  };
}

export function getTransaction(signature: string): unknown {
  return state().transactions.find((stored) => stored.signature === signature)?.response ?? null;
}

export function getSignatureStatus(signature: string): unknown {
  const stored = state().transactions.find((entry) => entry.signature === signature);
  if (!stored) return null;
  return { slot: stored.slot, confirmations: null, err: null, confirmationStatus: "finalized" };
}

/** Newest first, like a real node. `before` is a signature to page from. */
export function getSignaturesForAddress(
  address: string,
  options: { limit?: number; before?: string } = {},
): unknown[] {
  const newestFirst = state()
    .transactions.filter((stored) => stored.accounts.includes(address))
    .reverse();
  const start = options.before
    ? newestFirst.findIndex((stored) => stored.signature === options.before) + 1
    : 0;
  return newestFirst.slice(start, start + (options.limit ?? 1000)).map((stored) => ({
    signature: stored.signature,
    slot: stored.slot,
    err: null,
    memo: stored.memo ? `[${Buffer.byteLength(stored.memo)}] ${stored.memo}` : null,
    blockTime: stored.blockTime,
    confirmationStatus: "finalized",
  }));
}

/** Token accounts of `owner`, optionally only for one mint, in jsonParsed shape. */
export function getTokenAccountsByOwner(owner: string, mint?: string): unknown[] {
  const ledger = state();
  return Object.entries(ledger.tokenAccounts)
    .filter(([, account]) => account.owner === owner && (!mint || account.mint === mint))
    .map(([pubkey, account]) => ({
      pubkey,
      account: {
        executable: false,
        owner: TOKEN_PROGRAM,
        lamports: 2039280,
        rentEpoch: 0,
        space: 165,
        data: {
          program: "spl-token",
          space: 165,
          parsed: {
            type: "account",
            info: {
              isNative: false,
              mint: account.mint,
              owner: account.owner,
              state: "initialized",
              tokenAmount: uiTokenAmount(account.amount, ledger.mints[account.mint].decimals),
            },
          },
        },
      },
    }));
}
