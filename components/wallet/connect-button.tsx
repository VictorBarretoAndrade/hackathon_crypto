"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { shortAddress } from "@/lib/format";

/**
 * Connect / disconnect control. Not connected: opens the wallet picker.
 * Connected: shows the short address and a disconnect action.
 */
export function ConnectButton() {
  const { publicKey, wallet, connecting, disconnecting, connect, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  if (publicKey) {
    return (
      <div className="flex items-center gap-3">
        <span
          className="rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm tabular-nums"
          title={publicKey.toBase58()}
        >
          {shortAddress(publicKey.toBase58())}
        </span>
        <button
          type="button"
          onClick={() => disconnect().catch(() => {})}
          disabled={disconnecting}
          className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
        >
          Disconnect
        </button>
      </div>
    );
  }

  function handleConnect() {
    // A wallet picked earlier but not connected (e.g. the request was
    // dismissed) will not reconnect from the picker, so ask it directly.
    if (wallet) {
      connect().catch(() => setVisible(true));
    } else {
      setVisible(true);
    }
  }

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={connecting}
      className="inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm font-medium text-paper transition-colors hover:bg-ink/85 disabled:opacity-60"
    >
      {connecting ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
