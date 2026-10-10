import { afterEach, describe, expect, it, vi } from "vitest";
import type { FxRateRow } from "@/lib/db/types";
import {
  convertToBrl,
  fetchBcbPtax,
  fetchMockPtax,
  pickQuote,
  resolveRate,
  type FxDeps,
  type PtaxQuote,
} from "@/lib/fx/ptax";

// The week of 5 October 2026, as the Central Bank API really answered it.
// The 3rd and 4th are a weekend; here we also pretend Monday the 5th was a holiday.
const BCB_ANSWER = {
  value: [
    { cotacaoCompra: 5.2073, cotacaoVenda: 5.2079, dataHoraCotacao: "2026-10-01 13:10:35.4469" },
    { cotacaoCompra: 5.2232, cotacaoVenda: 5.2238, dataHoraCotacao: "2026-10-02 13:03:16.256632" },
    { cotacaoCompra: 4.9692, cotacaoVenda: 4.9698, dataHoraCotacao: "2026-10-06 13:03:21.267287" },
    { cotacaoCompra: 4.9929, cotacaoVenda: 4.9935, dataHoraCotacao: "2026-10-07 13:05:23.249063" },
  ],
};

function stubBcb(answer: unknown = BCB_ANSWER, status = 200) {
  const fetchMock = vi.fn(async (url: string) => {
    void url; // only recorded, so the tests can inspect it
    return new Response(JSON.stringify(answer), { status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function memoryFxStore() {
  const rows: FxRateRow[] = [];
  return {
    rows,
    getFxRate: async (date: string, rule: string) =>
      rows.find((row) => row.requested_date === date && row.rule === rule) ?? null,
    saveFxRate: async (row: FxRateRow) => void rows.push(row),
  };
}

function deps(today = "2026-10-10"): FxDeps & { store: ReturnType<typeof memoryFxStore> } {
  return { store: memoryFxStore(), fetcher: fetchBcbPtax, today };
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchBcbPtax", () => {
  it("asks for the period in MM-DD-YYYY and parses the quotes as strings", async () => {
    const fetchMock = stubBcb();
    const quotes = await fetchBcbPtax("2026-09-30", "2026-10-07");

    const url = decodeURIComponent(fetchMock.mock.calls[0][0]);
    expect(url).toContain("@dataInicial='09-30-2026'");
    expect(url).toContain("@dataFinalCotacao='10-07-2026'");
    expect(quotes[0]).toEqual({ date: "2026-10-01", buy: "5.2073", sell: "5.2079" });
    expect(quotes).toHaveLength(4);
  });

  it("keeps the last quote when a day has more than one", async () => {
    stubBcb({
      value: [
        { cotacaoCompra: 5.1, cotacaoVenda: 5.2, dataHoraCotacao: "2026-10-01 10:00:00.0" },
        { cotacaoCompra: 5.3, cotacaoVenda: 5.4, dataHoraCotacao: "2026-10-01 13:00:00.0" },
      ],
    });
    expect(await fetchBcbPtax("2026-10-01", "2026-10-01")).toEqual([
      { date: "2026-10-01", buy: "5.3000", sell: "5.4000" },
    ]);
  });

  it("fails clearly when the API is down or answers something else", async () => {
    stubBcb({}, 503);
    await expect(fetchBcbPtax("2026-10-01", "2026-10-02")).rejects.toThrow(/HTTP 503/);
    stubBcb({ unexpected: true });
    await expect(fetchBcbPtax("2026-10-01", "2026-10-02")).rejects.toThrow(/Unexpected answer/);
  });
});

describe("resolveRate", () => {
  it("uses the quote of the day itself on a business day", async () => {
    stubBcb();
    expect(await resolveRate(deps(), "2026-10-07", "ptax_buy")).toEqual({
      rule: "ptax_buy",
      quoteDate: "2026-10-07",
      rate: "4.9929",
    });
  });

  it("uses Friday's quote for a payment received on Saturday", async () => {
    stubBcb();
    const rate = await resolveRate(deps(), "2026-10-03", "ptax_buy");
    expect(rate).toMatchObject({ quoteDate: "2026-10-02", rate: "5.2232" });
  });

  it("skips a holiday after a weekend, back to the last business day", async () => {
    stubBcb();
    const rate = await resolveRate(deps(), "2026-10-05", "ptax_sell");
    expect(rate).toMatchObject({ quoteDate: "2026-10-02", rate: "5.2238" });
  });

  it("applies the sell rule when asked", async () => {
    stubBcb();
    expect((await resolveRate(deps(), "2026-10-07", "ptax_sell")).rate).toBe("4.9935");
  });

  it("asks the API for the day and the seven days before it", async () => {
    const fetchMock = stubBcb();
    await resolveRate(deps(), "2026-10-07", "ptax_buy");
    const url = decodeURIComponent(fetchMock.mock.calls[0][0]);
    expect(url).toContain("@dataInicial='09-30-2026'");
    expect(url).toContain("@dataFinalCotacao='10-07-2026'");
  });

  it("caches a final answer and does not call the API again", async () => {
    const fetchMock = stubBcb();
    const shared = deps();
    await resolveRate(shared, "2026-10-03", "ptax_buy");
    await resolveRate(shared, "2026-10-03", "ptax_buy");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(shared.store.rows).toEqual([
      { requested_date: "2026-10-03", rule: "ptax_buy", quote_date: "2026-10-02", rate: "5.2232" },
    ]);
  });

  it("does not cache today's fallback, because today's quote may still come out", async () => {
    const fetchMock = stubBcb();
    const today = deps("2026-10-08");
    const rate = await resolveRate(today, "2026-10-08", "ptax_buy");
    expect(rate.quoteDate).toBe("2026-10-07");
    expect(today.store.rows).toEqual([]);
    await resolveRate(today, "2026-10-08", "ptax_buy");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails when no quote exists in the whole week", async () => {
    stubBcb({ value: [] });
    await expect(resolveRate(deps(), "2026-10-07", "ptax_buy")).rejects.toThrow(/No PTAX quote/);
  });
});

describe("pickQuote", () => {
  const quotes: PtaxQuote[] = [
    { date: "2026-10-02", buy: "5.2232", sell: "5.2238" },
    { date: "2026-10-01", buy: "5.2073", sell: "5.2079" },
  ];

  it("never uses a quote from after the payment date", () => {
    expect(pickQuote(quotes, "2026-10-01")?.date).toBe("2026-10-01");
    expect(pickQuote(quotes, "2026-09-30")).toBeNull();
  });
});

describe("convertToBrl", () => {
  it("multiplies exactly and rounds half up to centavos", () => {
    expect(convertToBrl(1_200_000_000n, 6, "5.4321")).toBe("6518.52");
    expect(convertToBrl(1n, 6, "5.0000")).toBe("0.00");
    // 0.125 * 1.0000 = 0.125 -> 0.13 (a float would give 0.12)
    expect(convertToBrl(125_000n, 6, "1.0000")).toBe("0.13");
    expect(convertToBrl(85_000_000n, 6, "4.9886")).toBe("424.03");
  });
});

describe("fetchMockPtax", () => {
  it("is deterministic and has no quotes on weekends", async () => {
    const quotes = await fetchMockPtax("2026-10-01", "2026-10-07");
    expect(quotes.map((quote) => quote.date)).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
    ]);
    expect(await fetchMockPtax("2026-10-01", "2026-10-07")).toEqual(quotes);
    for (const quote of quotes) expect(quote.buy).toMatch(/^5\.\d{4}$/);
  });
});
