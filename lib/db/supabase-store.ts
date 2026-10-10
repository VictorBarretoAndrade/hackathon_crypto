import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Contact,
  FxRateRow,
  Invoice,
  NewInvoice,
  NewPayout,
  NewReceipt,
  Payout,
  Profile,
  Receipt,
  ReceiptPatch,
  Store,
} from "@/lib/db/types";

/**
 * Column lists with ::text casts on every numeric column. PostgREST would
 * otherwise send them as JSON numbers, which JavaScript reads as floats.
 */
const RECEIPT_COLUMNS =
  "id, owner_wallet, source, tx_signature, mint, amount_raw, decimals, payer_wallet, block_time, " +
  "memo, category, description, contact_id, invoice_id, fx_rule, fx_date, fx_rate::text, " +
  "amount_brl::text, receipt_json, receipt_hash, seal_signature, created_at";
const FX_COLUMNS = "requested_date, rule, quote_date, rate::text";
const PAYOUT_COLUMNS =
  "id, owner_wallet, amount_raw, mint, amount_brl::text, pix_key, provider, status, created_at";

function unwrap<T>(result: { data: unknown; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`Database error (${what}): ${result.error.message}`);
  return result.data as T;
}

/**
 * Live-mode database. Uses the service_role key, which bypasses Row Level
 * Security, so this file must only ever be imported by server code. Every
 * query is scoped by wallet in the service layer.
 */
export class SupabaseStore implements Store {
  private readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async ensureProfile(wallet: string): Promise<Profile> {
    await this.db.from("profiles").upsert({ wallet }, { onConflict: "wallet", ignoreDuplicates: true });
    return unwrap<Profile>(
      await this.db.from("profiles").select("*").eq("wallet", wallet).single(),
      "profile",
    );
  }

  async updateProfile(wallet: string, patch: Partial<Profile>): Promise<Profile> {
    await this.ensureProfile(wallet);
    return unwrap<Profile>(
      await this.db.from("profiles").update(patch).eq("wallet", wallet).select("*").single(),
      "update profile",
    );
  }

  async listContacts(owner: string): Promise<Contact[]> {
    return unwrap<Contact[]>(
      await this.db.from("contacts").select("*").eq("owner_wallet", owner),
      "contacts",
    );
  }

  async upsertContact(
    owner: string,
    input: { wallet: string; name: string; kind: Contact["kind"] },
  ): Promise<Contact> {
    return unwrap<Contact>(
      await this.db
        .from("contacts")
        .upsert({ owner_wallet: owner, ...input }, { onConflict: "owner_wallet,wallet" })
        .select("*")
        .single(),
      "save contact",
    );
  }

  async listReceipts(owner: string): Promise<Receipt[]> {
    return unwrap<Receipt[]>(
      await this.db
        .from("receipts")
        .select(RECEIPT_COLUMNS)
        .eq("owner_wallet", owner)
        .order("block_time", { ascending: false }),
      "receipts",
    );
  }

  async getReceipt(id: string): Promise<Receipt | null> {
    return unwrap<Receipt | null>(
      await this.db.from("receipts").select(RECEIPT_COLUMNS).eq("id", id).maybeSingle(),
      "receipt",
    );
  }

  async insertReceipts(rows: NewReceipt[]): Promise<Receipt[]> {
    if (rows.length === 0) return [];
    // ON CONFLICT DO NOTHING: rows that already exist are skipped and are not
    // part of the returned representation.
    return unwrap<Receipt[]>(
      await this.db
        .from("receipts")
        .upsert(rows, { onConflict: "owner_wallet,tx_signature,mint", ignoreDuplicates: true })
        .select(RECEIPT_COLUMNS),
      "insert receipts",
    );
  }

  async updateReceipt(id: string, patch: ReceiptPatch): Promise<Receipt> {
    return unwrap<Receipt>(
      await this.db.from("receipts").update(patch).eq("id", id).select(RECEIPT_COLUMNS).single(),
      "update receipt",
    );
  }

  async listInvoices(owner: string): Promise<Invoice[]> {
    return unwrap<Invoice[]>(
      await this.db
        .from("invoices")
        .select("*")
        .eq("owner_wallet", owner)
        .order("created_at", { ascending: false }),
      "invoices",
    );
  }

  async getInvoice(id: string): Promise<Invoice | null> {
    return unwrap<Invoice | null>(
      await this.db.from("invoices").select("*").eq("id", id).maybeSingle(),
      "invoice",
    );
  }

  async insertInvoice(row: NewInvoice): Promise<Invoice> {
    return unwrap<Invoice>(
      await this.db.from("invoices").insert(row).select("*").single(),
      "create invoice",
    );
  }

  async markInvoicePaid(id: string, signature: string, paidAt: string): Promise<Invoice> {
    return unwrap<Invoice>(
      await this.db
        .from("invoices")
        .update({ status: "paid", paid_signature: signature, paid_at: paidAt })
        .eq("id", id)
        .select("*")
        .single(),
      "mark invoice paid",
    );
  }

  async getFxRate(requestedDate: string, rule: FxRateRow["rule"]): Promise<FxRateRow | null> {
    return unwrap<FxRateRow | null>(
      await this.db
        .from("fx_rates")
        .select(FX_COLUMNS)
        .eq("requested_date", requestedDate)
        .eq("rule", rule)
        .maybeSingle(),
      "exchange rate",
    );
  }

  async saveFxRate(row: FxRateRow): Promise<void> {
    unwrap<null>(
      await this.db.from("fx_rates").upsert(row, { onConflict: "requested_date,rule" }),
      "save exchange rate",
    );
  }

  async insertPayout(row: NewPayout): Promise<Payout> {
    return unwrap<Payout>(
      await this.db.from("payouts").insert(row).select(PAYOUT_COLUMNS).single(),
      "create payout",
    );
  }

  async listPayouts(owner: string): Promise<Payout[]> {
    return unwrap<Payout[]>(
      await this.db
        .from("payouts")
        .select(PAYOUT_COLUMNS)
        .eq("owner_wallet", owner)
        .order("created_at", { ascending: false }),
      "payouts",
    );
  }
}
