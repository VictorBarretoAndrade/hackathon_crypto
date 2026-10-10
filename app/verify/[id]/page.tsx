"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Loading, Notice } from "@/components/ui";
import { Verifier } from "@/components/verify/verifier";
import { api, errorMessage } from "@/lib/api-client";

interface PublishedReceipt {
  receipt_json: string;
  seal_signature: string;
}

/**
 * Public verification by link. Our API only hands over the sealed receipt and
 * the seal's signature; every check then happens in the browser against the RPC.
 */
export default function VerifyByIdPage() {
  const { id } = useParams<{ id: string }>();
  const [published, setPublished] = useState<PublishedReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<PublishedReceipt>(`/api/public/receipts/${id}`)
      .then((loaded) => {
        if (!cancelled) setPublished(loaded);
      })
      .catch((caught) => {
        if (!cancelled) setError(errorMessage(caught));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-sm text-muted">Receipt verification</p>
        <div className="mt-6">
          {error && <Notice>{error}</Notice>}
          {!error && !published && <Loading label="Loading the receipt…" />}
          {published && (
            <Verifier
              // Pretty-printed for the tamper test; the hash ignores whitespace.
              initialReceiptJson={JSON.stringify(JSON.parse(published.receipt_json), null, 2)}
              initialSealSignature={published.seal_signature}
              autoRun
            />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
