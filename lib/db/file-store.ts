import { randomUUID } from "node:crypto";
import { loadState, saveState } from "@/lib/mock/persist";
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

interface Tables {
  profiles: Profile[];
  contacts: Contact[];
  receipts: Receipt[];
  invoices: Invoice[];
  fx_rates: FxRateRow[];
  payouts: Payout[];
}

function emptyTables(): Tables {
  return { profiles: [], contacts: [], receipts: [], invoices: [], fx_rates: [], payouts: [] };
}

/** Wipes the mock database. */
export function resetFileStore(): void {
  saveState("db", emptyTables());
}

function newestFirst<T>(rows: T[], key: (row: T) => string): T[] {
  return [...rows].sort((a, b) => key(b).localeCompare(key(a)));
}

/**
 * The mock-mode database: the same tables as Supabase, kept in memory and
 * mirrored to .mock-data/db.json. Methods return copies, so callers cannot
 * change stored rows by accident, exactly as with a real database.
 */
export class FileStore implements Store {
  private get tables(): Tables {
    return loadState("db", emptyTables);
  }

  private commit(): void {
    saveState("db", this.tables);
  }

  async ensureProfile(wallet: string): Promise<Profile> {
    let profile = this.tables.profiles.find((row) => row.wallet === wallet);
    if (!profile) {
      profile = {
        wallet,
        display_name: null,
        fx_rule: "ptax_buy",
        created_at: new Date().toISOString(),
      };
      this.tables.profiles.push(profile);
      this.commit();
    }
    return { ...profile };
  }

  async updateProfile(wallet: string, patch: Partial<Profile>): Promise<Profile> {
    await this.ensureProfile(wallet);
    const profile = this.tables.profiles.find((row) => row.wallet === wallet)!;
    Object.assign(profile, patch);
    this.commit();
    return { ...profile };
  }

  async listContacts(owner: string): Promise<Contact[]> {
    return this.tables.contacts.filter((row) => row.owner_wallet === owner).map((row) => ({ ...row }));
  }

  async upsertContact(
    owner: string,
    input: { wallet: string; name: string; kind: Contact["kind"] },
  ): Promise<Contact> {
    let contact = this.tables.contacts.find(
      (row) => row.owner_wallet === owner && row.wallet === input.wallet,
    );
    if (contact) {
      contact.name = input.name;
      contact.kind = input.kind;
    } else {
      contact = { id: randomUUID(), owner_wallet: owner, ...input };
      this.tables.contacts.push(contact);
    }
    this.commit();
    return { ...contact };
  }

  async listReceipts(owner: string): Promise<Receipt[]> {
    const rows = this.tables.receipts.filter((row) => row.owner_wallet === owner);
    return newestFirst(rows, (row) => row.block_time).map((row) => ({ ...row }));
  }

  async getReceipt(id: string): Promise<Receipt | null> {
    const receipt = this.tables.receipts.find((row) => row.id === id);
    return receipt ? { ...receipt } : null;
  }

  async insertReceipts(rows: NewReceipt[]): Promise<Receipt[]> {
    const inserted: Receipt[] = [];
    for (const row of rows) {
      const exists = this.tables.receipts.some(
        (existing) =>
          existing.owner_wallet === row.owner_wallet &&
          existing.tx_signature === row.tx_signature &&
          existing.mint === row.mint,
      );
      if (exists) continue;
      const receipt: Receipt = { ...row, id: randomUUID(), created_at: new Date().toISOString() };
      this.tables.receipts.push(receipt);
      inserted.push({ ...receipt });
    }
    if (inserted.length > 0) this.commit();
    return inserted;
  }

  async updateReceipt(id: string, patch: ReceiptPatch): Promise<Receipt> {
    const receipt = this.tables.receipts.find((row) => row.id === id);
    if (!receipt) throw new Error(`Receipt ${id} not found`);
    Object.assign(receipt, patch);
    this.commit();
    return { ...receipt };
  }

  async listInvoices(owner: string): Promise<Invoice[]> {
    const rows = this.tables.invoices.filter((row) => row.owner_wallet === owner);
    return newestFirst(rows, (row) => row.created_at).map((row) => ({ ...row }));
  }

  async getInvoice(id: string): Promise<Invoice | null> {
    const invoice = this.tables.invoices.find((row) => row.id === id);
    return invoice ? { ...invoice } : null;
  }

  async insertInvoice(row: NewInvoice): Promise<Invoice> {
    const invoice: Invoice = {
      ...row,
      id: randomUUID(),
      status: "pending",
      paid_signature: null,
      created_at: new Date().toISOString(),
      paid_at: null,
    };
    this.tables.invoices.push(invoice);
    this.commit();
    return { ...invoice };
  }

  async markInvoicePaid(id: string, signature: string, paidAt: string): Promise<Invoice> {
    const invoice = this.tables.invoices.find((row) => row.id === id);
    if (!invoice) throw new Error(`Invoice ${id} not found`);
    Object.assign(invoice, { status: "paid", paid_signature: signature, paid_at: paidAt });
    this.commit();
    return { ...invoice };
  }

  async getFxRate(requestedDate: string, rule: FxRateRow["rule"]): Promise<FxRateRow | null> {
    const row = this.tables.fx_rates.find(
      (entry) => entry.requested_date === requestedDate && entry.rule === rule,
    );
    return row ? { ...row } : null;
  }

  async saveFxRate(row: FxRateRow): Promise<void> {
    const rates = this.tables.fx_rates;
    const index = rates.findIndex(
      (entry) => entry.requested_date === row.requested_date && entry.rule === row.rule,
    );
    if (index >= 0) rates[index] = { ...row };
    else rates.push({ ...row });
    this.commit();
  }

  async insertPayout(row: NewPayout): Promise<Payout> {
    const payout: Payout = { ...row, id: randomUUID(), created_at: new Date().toISOString() };
    this.tables.payouts.push(payout);
    this.commit();
    return { ...payout };
  }

  async listPayouts(owner: string): Promise<Payout[]> {
    const rows = this.tables.payouts.filter((row) => row.owner_wallet === owner);
    return newestFirst(rows, (row) => row.created_at).map((row) => ({ ...row }));
  }
}
