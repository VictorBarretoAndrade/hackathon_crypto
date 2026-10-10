import { PublicKey, TransactionInstruction } from "@solana/web3.js";
// Explicit import: in the browser there is no global Buffer, this is the polyfill.
import { Buffer } from "buffer";

/** SPL Memo program (v2) and its legacy version. Both only log their input. */
export const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
export const LEGACY_MEMO_PROGRAM_ID = "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo";

export function isMemoProgram(programId: string): boolean {
  return programId === MEMO_PROGRAM_ID || programId === LEGACY_MEMO_PROGRAM_ID;
}

/**
 * A memo instruction that `signer` must sign. Listing the signer matters: the
 * Memo program fails unless every listed account signed, so the memo becomes a
 * statement provably made by that wallet.
 */
export function createMemoInstruction(text: string, signer: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(MEMO_PROGRAM_ID),
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    data: Buffer.from(text, "utf8"),
  });
}

/**
 * Receipt seal, an open format any tool can check:
 *
 *   recebi:v1:<sha256 of the canonical receipt JSON, hex>:<payment signature>
 */
export function sealMemo(receiptHash: string, paymentSignature: string): string {
  return `recebi:v1:${receiptHash}:${paymentSignature}`;
}

/** Memo placed inside an invoice payment: recebi:inv:v1:<sha256 of the invoice JSON>. */
export function invoiceMemo(invoiceHash: string): string {
  return `recebi:inv:v1:${invoiceHash}`;
}
