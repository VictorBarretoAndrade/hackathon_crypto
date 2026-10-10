import Decimal from "decimal.js";
import type { FxRule, Store } from "@/lib/db/types";
import { formatUnits } from "@/lib/money/units";
import { addDays, weekday } from "@/lib/time";

/** One day's closing PTAX: BRL per 1 USD, as decimal strings with 4 places. */
export interface PtaxQuote {
  /** YYYY-MM-DD */
  date: string;
  buy: string;
  sell: string;
}

/** Returns the quotes published between two dates, inclusive. */
export type PtaxFetcher = (startDate: string, endDate: string) => Promise<PtaxQuote[]>;

const OLINDA =
  "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/" +
  "CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)";

/** The API wants MM-DD-YYYY. */
function toBcbDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${month}-${day}-${year}`;
}

/**
 * The Central Bank's public PTAX API (Olinda). No key needed. Days without a
 * quote (weekends, holidays) are simply absent from the answer.
 *
 * Response, checked against a real call:
 *   { "value": [ { "cotacaoCompra": 5.2073, "cotacaoVenda": 5.2079,
 *                  "dataHoraCotacao": "2026-10-01 13:10:35.4469" } ] }
 */
export const fetchBcbPtax: PtaxFetcher = async (startDate, endDate) => {
  const url =
    `${OLINDA}?@dataInicial='${toBcbDate(startDate)}'` +
    `&@dataFinalCotacao='${toBcbDate(endDate)}'&$format=json`;
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    throw new Error(`The Central Bank PTAX API answered HTTP ${response.status}`);
  }
  const body = (await response.json()) as {
    value?: { cotacaoCompra: number; cotacaoVenda: number; dataHoraCotacao: string }[];
  };
  if (!Array.isArray(body.value)) {
    throw new Error("Unexpected answer from the Central Bank PTAX API");
  }

  // Keep one quote per day: the last one published.
  const latest = new Map<string, { at: string; quote: PtaxQuote }>();
  for (const row of body.value) {
    const date = row.dataHoraCotacao.slice(0, 10);
    const previous = latest.get(date);
    if (previous && previous.at > row.dataHoraCotacao) continue;
    latest.set(date, {
      at: row.dataHoraCotacao,
      quote: {
        date,
        // The API sends JSON numbers. String() gives back the exact digits the
        // bank published (4 or 5 places), which Decimal then takes as text.
        buy: new Decimal(String(row.cotacaoCompra)).toFixed(4),
        sell: new Decimal(String(row.cotacaoVenda)).toFixed(4),
      },
    });
  }
  return [...latest.values()].map((entry) => entry.quote);
};

/**
 * Synthetic rates for mock mode: one quote per weekday, derived from the date
 * so they are stable between runs. They are plausible, not real.
 */
export const fetchMockPtax: PtaxFetcher = async (startDate, endDate) => {
  const quotes: PtaxQuote[] = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    const day = weekday(date);
    if (day === 0 || day === 6) continue;
    const seed = [...date].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 9973, 7);
    const buyTenThousandths = 53_000 + (seed % 1_500);
    quotes.push({
      date,
      buy: new Decimal(buyTenThousandths).div(10_000).toFixed(4),
      sell: new Decimal(buyTenThousandths + 6).div(10_000).toFixed(4),
    });
  }
  return quotes;
};

/** The most recent quote on or before `date`. Null if there is none. */
export function pickQuote(quotes: PtaxQuote[], date: string): PtaxQuote | null {
  let best: PtaxQuote | null = null;
  for (const quote of quotes) {
    if (quote.date <= date && (!best || quote.date > best.date)) best = quote;
  }
  return best;
}

export interface ResolvedRate {
  rule: FxRule;
  /** The business day whose quote was used. May be earlier than the payment date. */
  quoteDate: string;
  rate: string;
}

export interface FxDeps {
  store: Pick<Store, "getFxRate" | "saveFxRate">;
  fetcher: PtaxFetcher;
  /** Today's date in Brasília time, YYYY-MM-DD. */
  today: string;
}

/** How far back we look for a quote. Covers weekends and long holidays. */
const LOOKBACK_DAYS = 7;

/**
 * The PTAX rate to use for a payment received on `date`: that day's quote, or
 * the latest earlier one within a week (weekend, holiday, or today's quote not
 * published yet).
 */
export async function resolveRate(deps: FxDeps, date: string, rule: FxRule): Promise<ResolvedRate> {
  const cached = await deps.store.getFxRate(date, rule);
  if (cached) return { rule, quoteDate: cached.quote_date, rate: cached.rate };

  const start = addDays(date, -LOOKBACK_DAYS);
  const quote = pickQuote(await deps.fetcher(start, date), date);
  if (!quote) {
    throw new Error(`No PTAX quote was published between ${start} and ${date}`);
  }
  const rate = rule === "ptax_buy" ? quote.buy : quote.sell;

  // Only cache answers that can no longer change. For today, a fallback to the
  // previous business day is temporary: today's quote comes out around 13:00.
  if (quote.date === date || date < deps.today) {
    await deps.store.saveFxRate({ requested_date: date, rule, quote_date: quote.date, rate });
  }
  return { rule, quoteDate: quote.date, rate };
}

/** Token amount times rate, rounded half-up to centavos: "6518.52". */
export function convertToBrl(amountRaw: bigint, decimals: number, rate: string): string {
  return new Decimal(formatUnits(amountRaw, decimals))
    .mul(rate)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2);
}
