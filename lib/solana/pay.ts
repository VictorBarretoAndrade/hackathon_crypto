import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { formatUnits } from "@/lib/money/units";
import { createMemoInstruction } from "@/lib/solana/memo";

export interface TokenPayment {
  payer: string;
  recipient: string;
  mint: string;
  decimals: number;
  amountRaw: bigint;
  /** Signed by the payer through the Memo program. */
  memo?: string;
  /** Solana Pay reference: a random public key that makes the payment findable. */
  reference?: string;
}

/**
 * Instructions for a token payment, the same ones a Solana Pay wallet builds:
 *
 * 1. create the recipient's token account if it does not exist yet (idempotent);
 * 2. a memo signed by the payer;
 * 3. the transfer, with the reference attached as an extra read-only,
 *    non-signer account. The Token program ignores it, but it makes the
 *    transaction show up in getSignaturesForAddress(reference).
 */
export function buildPaymentInstructions(payment: TokenPayment): TransactionInstruction[] {
  const payer = new PublicKey(payment.payer);
  const recipient = new PublicKey(payment.recipient);
  const mint = new PublicKey(payment.mint);
  const source = getAssociatedTokenAddressSync(mint, payer);
  const destination = getAssociatedTokenAddressSync(mint, recipient);

  const instructions: TransactionInstruction[] = [
    createAssociatedTokenAccountIdempotentInstruction(payer, destination, recipient, mint),
  ];
  if (payment.memo) instructions.push(createMemoInstruction(payment.memo, payer));

  const transfer = createTransferCheckedInstruction(
    source,
    mint,
    destination,
    payer,
    payment.amountRaw,
    payment.decimals,
  );
  if (payment.reference) {
    transfer.keys.push({
      pubkey: new PublicKey(payment.reference),
      isSigner: false,
      isWritable: false,
    });
  }
  instructions.push(transfer);
  return instructions;
}

/**
 * A Solana Pay transfer request URL, built by hand from the specification
 * (https://docs.solanapay.com/spec) so we do not depend on @solana/pay.
 */
export function buildSolanaPayUrl(request: {
  recipient: string;
  mint: string;
  decimals: number;
  amountRaw: bigint;
  reference: string;
  label: string;
  message: string;
  memo: string;
}): string {
  const params = [
    `amount=${formatUnits(request.amountRaw, request.decimals)}`,
    `spl-token=${request.mint}`,
    `reference=${request.reference}`,
    `label=${encodeURIComponent(request.label)}`,
    `message=${encodeURIComponent(request.message)}`,
    `memo=${encodeURIComponent(request.memo)}`,
  ];
  return `solana:${request.recipient}?${params.join("&")}`;
}
