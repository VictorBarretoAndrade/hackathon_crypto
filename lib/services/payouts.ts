import Decimal from "decimal.js";
import { findStableMint } from "@/lib/config/mints";
import type { Payout } from "@/lib/db/types";
import { badRequest } from "@/lib/errors";
import { resolveRate } from "@/lib/fx/ptax";
import { formatTokenAmount, formatUnits, parseUnits } from "@/lib/money/units";
import type { Deps } from "@/lib/services/deps";
import { brtDate } from "@/lib/time";

export interface PayoutRequest {
  owner: string;
  mint: string;
  /** Decimal string typed by the user, e.g. "500" or "500.25". */
  amount: string;
}

export interface PayoutQuote {
  provider: string;
  simulated: boolean;
  symbol: string;
  mint: string;
  /** Display amount, e.g. "500.00". */
  amount: string;
  amount_raw: string;
  /** PTAX sell rate and the business day it comes from. */
  ptax_rate: string;
  ptax_date: string;
  /** The provider's margin, in basis points (50 = 0.50%). */
  spread_bps: number;
  /** PTAX sell minus the spread: what the user actually gets per token. */
  effective_rate: string;
  amount_brl: string;
}

/**
 * A cash-out rail. Recebi itself never converts or moves money: in production
 * this interface is implemented by a partner authorised by the Central Bank.
 */
export interface PayoutProvider {
  readonly name: string;
  quote(request: PayoutRequest): Promise<PayoutQuote>;
  requestPayout(request: PayoutRequest & { pixKey: string }): Promise<Payout>;
}

const DEFAULT_SPREAD_BPS = 50;

function spreadBps(): number {
  const configured = Number(process.env.PAYOUT_SPREAD_BPS);
  return Number.isInteger(configured) && configured >= 0 && configured < 10_000
    ? configured
    : DEFAULT_SPREAD_BPS;
}

/**
 * The only provider in the MVP. It quotes from the PTAX sell rate minus a
 * fixed spread and writes a row to `payouts` so the flow can be demonstrated.
 * NO TOKENS MOVE AND NO PIX IS SENT.
 */
export class SimulatedPixProvider implements PayoutProvider {
  readonly name = "simulated_pix";

  constructor(private readonly deps: Deps) {}

  async quote(request: PayoutRequest): Promise<PayoutQuote> {
    const token = findStableMint(request.mint);
    if (!token) throw badRequest("Choose one of the accepted tokens");
    let amountRaw: bigint;
    try {
      amountRaw = parseUnits(request.amount, token.decimals);
    } catch (error) {
      throw badRequest(error instanceof Error ? error.message : "Invalid amount");
    }
    if (amountRaw <= 0n) throw badRequest("The amount must be greater than zero");

    const today = brtDate(this.deps.now());
    const ptax = await resolveRate(
      { store: this.deps.store, fetcher: this.deps.fetchPtax, today },
      today,
      "ptax_sell",
    );
    const bps = spreadBps();
    const effectiveRate = new Decimal(ptax.rate).mul(new Decimal(10_000 - bps).div(10_000));
    return {
      provider: this.name,
      simulated: true,
      symbol: token.symbol,
      mint: token.mint,
      amount: formatTokenAmount(amountRaw, token.decimals),
      amount_raw: amountRaw.toString(),
      ptax_rate: ptax.rate,
      ptax_date: ptax.quoteDate,
      spread_bps: bps,
      effective_rate: effectiveRate.toFixed(4, Decimal.ROUND_DOWN),
      // Rounded down: a quote must never promise more than will arrive.
      amount_brl: new Decimal(formatUnits(amountRaw, token.decimals))
        .mul(effectiveRate)
        .toFixed(2, Decimal.ROUND_DOWN),
    };
  }

  async requestPayout(request: PayoutRequest & { pixKey: string }): Promise<Payout> {
    const pixKey = request.pixKey.trim();
    if (!pixKey) throw badRequest("Enter a Pix key");
    if (pixKey.length > 140) throw badRequest("The Pix key is too long");

    const quote = await this.quote(request);
    await this.deps.store.ensureProfile(request.owner);
    return this.deps.store.insertPayout({
      owner_wallet: request.owner,
      amount_raw: quote.amount_raw,
      mint: quote.mint,
      amount_brl: quote.amount_brl,
      pix_key: pixKey,
      provider: this.name,
      status: "simulated",
    });
  }
}

export function getPayoutProvider(deps: Deps): PayoutProvider {
  return new SimulatedPixProvider(deps);
}
