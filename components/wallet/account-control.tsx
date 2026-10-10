"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useState } from "react";
import { useSession } from "@/components/providers/session-provider";
import { Button } from "@/components/ui";
import { errorMessage } from "@/lib/api-client";
import { shortAddress } from "@/lib/format";
import { MOCK_WALLET_NAME } from "@/lib/mock/wallet-adapter";
import { IS_MOCK } from "@/lib/mode";

/** Opens the wallet picker in live mode; in mock mode connects the demo wallet directly. */
export function useConnectWallet() {
  const { wallet, connect, select } = useWallet();
  const { setVisible } = useWalletModal();

  return function connectWallet() {
    if (IS_MOCK) {
      // Selecting is enough: WalletProvider connects a wallet the user just picked.
      if (wallet?.adapter.name === MOCK_WALLET_NAME) connect().catch(() => {});
      else select(MOCK_WALLET_NAME);
    } else if (wallet) {
      // A wallet picked earlier but not connected (e.g. the request was
      // dismissed) will not reconnect from the picker, so ask it directly.
      connect().catch(() => setVisible(true));
    } else {
      setVisible(true);
    }
  };
}

/**
 * The account area of the header, in three states:
 * no wallet -> "Connect wallet"; wallet but no session -> "Sign in";
 * signed in -> address and "Sign out".
 */
export function AccountControl({ onSignedIn }: { onSignedIn?: () => void }) {
  const { publicKey, connecting } = useWallet();
  const { session, signIn, signOut } = useSession();
  const connectWallet = useConnectWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signIn();
      onSignedIn?.();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (!publicKey) {
    return (
      <Button onClick={connectWallet} busy={connecting}>
        {IS_MOCK ? "Use demo wallet" : "Connect wallet"}
      </Button>
    );
  }

  const signedIn = session.status === "signed_in";
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        <span
          className="rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm tabular-nums"
          title={publicKey.toBase58()}
        >
          {shortAddress(publicKey.toBase58())}
        </span>
        {!signedIn && (
          <Button onClick={handleSignIn} busy={busy || session.status === "loading"}>
            Sign in
          </Button>
        )}
        <button
          type="button"
          onClick={() => signOut()}
          className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          {signedIn ? "Sign out" : "Disconnect"}
        </button>
      </div>
      {error && <p className="max-w-xs text-right text-xs text-danger">{error}</p>}
    </div>
  );
}
