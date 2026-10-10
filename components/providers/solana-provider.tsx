"use client";

import type { ReactNode } from "react";
import type { ConnectionConfig } from "@solana/web3.js";
import type { Adapter, WalletError } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { RPC_URL } from "@/lib/solana/cluster";

// Phantom (and Solflare, Backpack...) announce themselves through the Wallet
// Standard, and WalletProvider picks them up on its own. No adapter list needed.
const WALLETS: Adapter[] = [];

// Declared once at module level: ConnectionProvider builds a new Connection
// whenever this object's identity changes.
const CONNECTION_CONFIG: ConnectionConfig = { commitment: "confirmed" };

function logWalletError(error: WalletError) {
  console.error(`[wallet] ${error.name}: ${error.message}`);
}

/** Gives every client component access to the devnet RPC and the user's wallet. */
export function SolanaProvider({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider endpoint={RPC_URL} config={CONNECTION_CONFIG}>
      <WalletProvider wallets={WALLETS} autoConnect onError={logWalletError}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
