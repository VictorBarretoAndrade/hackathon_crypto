import { Transaction, type Keypair } from "@solana/web3.js";
import { MOCK_USDC } from "@/lib/config/mints";
import { resetFileStore } from "@/lib/db/file-store";
import { MOCK_KEYS } from "@/lib/mock/keys";
import { faucet, processTransaction, registerMint, resetLedger } from "@/lib/mock/ledger";
import { loadState, saveState } from "@/lib/mock/persist";
import { parseUnits } from "@/lib/money/units";
import { buildPaymentInstructions } from "@/lib/solana/pay";
import { addDays, brtDate, weekday } from "@/lib/time";

/** Any valid blockhash will do: the mock ledger does not check it. */
const SEED_BLOCKHASH = "11111111111111111111111111111111";

/** Signs a real token payment with a demo key and runs it on the mock ledger. */
export function mockPay(options: {
  payer: Keypair;
  recipient: string;
  amount: string;
  memo?: string;
  reference?: string;
  blockTime?: number;
}): string {
  const transaction = new Transaction().add(
    ...buildPaymentInstructions({
      payer: options.payer.publicKey.toBase58(),
      recipient: options.recipient,
      mint: MOCK_USDC.mint,
      decimals: MOCK_USDC.decimals,
      amountRaw: parseUnits(options.amount, MOCK_USDC.decimals),
      memo: options.memo,
      reference: options.reference,
    }),
  );
  transaction.feePayer = options.payer.publicKey;
  transaction.recentBlockhash = SEED_BLOCKHASH;
  transaction.sign(options.payer);
  return processTransaction(transaction.serialize(), { blockTime: options.blockTime });
}

/** Unix seconds for a Brasília wall-clock time (UTC-3, no daylight saving). */
function brtTimestamp(date: string, time: string): number {
  return Math.floor(new Date(`${date}T${time}:00-03:00`).getTime() / 1000);
}

/**
 * Wipes the mock ledger and database and recreates the demo story: four
 * payments to Ana, as they would look before she has classified anything.
 *
 * - Acme Labs pays 1,200 for a service (with memo), on a Wednesday.
 * - A bounty platform pays 500 (with memo) on a Saturday, so its BRL value has
 *   to fall back to Friday's exchange rate.
 * - Ana's own savings wallet sends 300, with no memo.
 * - A wallet she has never seen sends 85, with no memo.
 */
export function seedMock(now: Date = new Date()): void {
  resetLedger();
  resetFileStore();
  registerMint(MOCK_USDC.mint, MOCK_USDC.decimals);

  const ana = MOCK_KEYS.ana.publicKey.toBase58();
  const payers = [MOCK_KEYS.clientAcme, MOCK_KEYS.bountyPlatform, MOCK_KEYS.anaSavings, MOCK_KEYS.stranger];
  for (const payer of payers) {
    faucet(payer.publicKey.toBase58(), MOCK_USDC.mint, parseUnits("50000", MOCK_USDC.decimals));
  }

  // The latest Saturday that is at least a week old (Brasília time), so that
  // the following Monday, Wednesday and Friday are all in the past too.
  let saturday = addDays(brtDate(now), -7);
  while (weekday(saturday) !== 6) saturday = addDays(saturday, -1);

  // Oldest first: the ledger assigns slots in the order transactions arrive.
  mockPay({
    payer: MOCK_KEYS.bountyPlatform,
    recipient: ana,
    amount: "500",
    memo: "Bounty payout: UI design",
    blockTime: brtTimestamp(saturday, "15:20"),
  });
  mockPay({
    payer: MOCK_KEYS.stranger,
    recipient: ana,
    amount: "85",
    blockTime: brtTimestamp(addDays(saturday, 2), "17:12"),
  });
  mockPay({
    payer: MOCK_KEYS.clientAcme,
    recipient: ana,
    amount: "1200",
    memo: "Acme Labs: web app development, September",
    blockTime: brtTimestamp(addDays(saturday, 4), "11:03"),
  });
  mockPay({
    payer: MOCK_KEYS.anaSavings,
    recipient: ana,
    amount: "300",
    blockTime: brtTimestamp(addDays(saturday, 6), "09:41"),
  });

  saveState("seeded", { at: now.toISOString() });
}

/** Seeds the mock world the first time it is needed. */
export function ensureMockSeeded(): void {
  const marker = loadState<{ at: string } | null>("seeded", () => null);
  if (!marker) seedMock();
}
