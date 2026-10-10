/**
 * The text a wallet signs to log in. Plain and readable on purpose: the wallet
 * shows it to the user, who should understand what they are approving.
 * The nonce makes every login message unique, so an old signature cannot be reused.
 */
export function buildSignInMessage(input: {
  wallet: string;
  origin: string;
  network: string;
  nonce: string;
  issuedAt: string;
}): string {
  return [
    "Recebi wants you to sign in with your Solana account:",
    input.wallet,
    "",
    "Sign in to Recebi. This is not a transaction and costs nothing.",
    "",
    `URI: ${input.origin}`,
    `Network: ${input.network}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
  ].join("\n");
}
