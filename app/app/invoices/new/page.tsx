"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Card, Field, Notice, PageTitle, inputClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/api-client";
import { STABLE_MINTS } from "@/lib/config/mints";
import type { InvoiceView } from "@/lib/services/invoices";

export default function NewInvoicePage() {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [mint, setMint] = useState(STABLE_MINTS[0].mint);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api<{ invoice: InvoiceView }>("/api/invoices", {
        json: { client_name: clientName, client_email: clientEmail, description, amount, mint },
      });
      router.push("/app/invoices");
    } catch (caught) {
      setError(errorMessage(caught));
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl">
      <Link href="/app/invoices" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
        ← All invoices
      </Link>
      <div className="mt-6">
        <PageTitle title="New invoice" />
      </div>

      <Card className="mt-8">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Client">
            <input
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              placeholder="e.g. Acme Labs"
              maxLength={120}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Client e-mail" hint="Optional, for your records">
            <input
              type="email"
              value={clientEmail}
              onChange={(event) => setClientEmail(event.target.value)}
              placeholder="billing@acme.example"
              className={inputClass}
            />
          </Field>
          <Field label="Description">
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="e.g. Web app development, October"
              maxLength={500}
              required
              className={inputClass}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <Field label="Amount">
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                placeholder="1200.00"
                required
                className={`${inputClass} tabular-nums`}
              />
            </Field>
            <Field label="Token">
              <select value={mint} onChange={(event) => setMint(event.target.value)} className={inputClass}>
                {STABLE_MINTS.map((token) => (
                  <option key={token.mint} value={token.mint}>
                    {token.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {error && <Notice>{error}</Notice>}
          <Button type="submit" busy={saving}>
            Create invoice
          </Button>
        </form>
      </Card>
    </div>
  );
}
