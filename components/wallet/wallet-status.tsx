"use client";

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { STABLE_MINTS } from "@/lib/config/mints";
import { formatUnits } from "@/lib/money/units";
import { DEVNET_GENESIS_HASH, explorerAddressUrl } from "@/lib/solana/cluster";

const LAMPORTS_DECIMALS = 9;

type NetworkCheck =
  | { status: "ready"; address: string; isDevnet: boolean; lamports: bigint }
  | { status: "error"; address: string; message: string };

/**
 * Shown once a wallet is connected: the full address, plus a live read from
 * the RPC proving that we are talking to devnet and can see the account.
 */
export function WalletStatus() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const address = publicKey?.toBase58() ?? null;
  const [check, setCheck] = useState<NetworkCheck | null>(null);

  useEffect(() => {
    if (!publicKey) return;
    const address = publicKey.toBase58();
    let cancelled = false;

    Promise.all([connection.getGenesisHash(), connection.getBalance(publicKey)])
      .then(([genesisHash, lamports]) => {
        if (cancelled) return;
        setCheck({
          status: "ready",
          address,
          isDevnet: genesisHash === DEVNET_GENESIS_HASH,
          lamports: BigInt(lamports),
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setCheck({ status: "error", address, message });
      });

    return () => {
      cancelled = true;
    };
  }, [connection, publicKey]);

  if (!address) {
    return (
      <p className="text-sm text-muted">
        Use Phantom with testnet mode on and the network set to{" "}
        <span className="font-medium text-ink">Solana Devnet</span>.
      </p>
    );
  }

  // A result for a previous wallet is stale: treat it as still loading.
  const current = check?.address === address ? check : null;

  return (
    <section
      aria-label="Connected wallet"
      className="rounded-lg border border-line bg-surface p-5 sm:p-6"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-muted">Connected wallet</p>
      <p className="mt-2 break-all font-mono text-sm sm:text-base">{address}</p>

      <dl className="mt-5 grid gap-4 border-t border-line pt-5 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted">Network</dt>
          <dd className="mt-1 font-medium">
            {current === null && "Checking…"}
            {current?.status === "ready" && current.isDevnet && (
              <span className="text-accent">Solana Devnet ✓</span>
            )}
            {current?.status === "ready" && !current.isDevnet && (
              <span className="text-danger">RPC is not devnet</span>
            )}
            {current?.status === "error" && <span className="text-danger">RPC unreachable</span>}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Balance</dt>
          <dd className="mt-1 font-medium tabular-nums">
            {current?.status === "ready"
              ? `${formatUnits(current.lamports, LAMPORTS_DECIMALS, { maxFractionDigits: 4 })} SOL`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Accepted tokens</dt>
          <dd className="mt-1 font-medium">{STABLE_MINTS.map((mint) => mint.label).join(", ")}</dd>
        </div>
      </dl>

      {current?.status === "ready" && !current.isDevnet && (
        <p className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          NEXT_PUBLIC_RPC_URL points to another network. Recebi only works on devnet.
        </p>
      )}
      {current?.status === "error" && (
        <p className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          Could not reach the RPC: {current.message}
        </p>
      )}

      <a
        href={explorerAddressUrl(address)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-block text-sm text-accent underline-offset-4 hover:underline"
      >
        View on Solana Explorer ↗
      </a>
    </section>
  );
}
