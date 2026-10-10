"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import type { FxRule } from "@/lib/db/types";

type SessionState =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "signed_in"; wallet: string; fxRule: FxRule };

interface SessionContextValue {
  session: SessionState;
  /** Asks the connected wallet to sign the login message. */
  signIn: () => Promise<void>;
  /** Ends the session and disconnects the wallet. */
  signOut: () => Promise<void>;
  setFxRule: (rule: FxRule) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

type Me = { wallet: string | null; fx_rule: FxRule | null };

/**
 * Knows who is signed in. The session itself is an httpOnly cookie the page
 * cannot read, so this asks the server (/api/auth/me) and keeps the answer.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { publicKey, signMessage, disconnect } = useWallet();
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const connectedWallet = publicKey?.toBase58() ?? null;

  useEffect(() => {
    let cancelled = false;
    api<Me>("/api/auth/me")
      .then((me) => {
        if (cancelled) return;
        setSession(
          me.wallet
            ? { status: "signed_in", wallet: me.wallet, fxRule: me.fx_rule ?? "ptax_buy" }
            : { status: "signed_out" },
        );
      })
      .catch(() => {
        if (!cancelled) setSession({ status: "signed_out" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    setSession({ status: "signed_out" });
    await disconnect().catch(() => {});
  }, [disconnect]);

  // The session belongs to one wallet. If the user switches account in the
  // wallet, the old session must not keep acting for the previous one.
  const sessionWallet = session.status === "signed_in" ? session.wallet : null;
  useEffect(() => {
    if (sessionWallet && connectedWallet && sessionWallet !== connectedWallet) {
      api("/api/auth/logout", { method: "POST" })
        .catch(() => {})
        .then(() => setSession({ status: "signed_out" }));
    }
  }, [sessionWallet, connectedWallet]);

  const signIn = useCallback(async () => {
    if (!connectedWallet) throw new Error("Connect a wallet first.");
    if (!signMessage) throw new Error("This wallet cannot sign messages. Try Phantom.");
    const { message } = await api<{ message: string }>("/api/auth/nonce", {
      json: { wallet: connectedWallet },
    });
    const signature = await signMessage(new TextEncoder().encode(message));
    const me = await api<{ wallet: string; fx_rule: FxRule }>("/api/auth/verify", {
      json: { wallet: connectedWallet, signature: bs58.encode(signature) },
    });
    setSession({ status: "signed_in", wallet: me.wallet, fxRule: me.fx_rule });
  }, [connectedWallet, signMessage]);

  const setFxRule = useCallback((rule: FxRule) => {
    setSession((current) => (current.status === "signed_in" ? { ...current, fxRule: rule } : current));
  }, []);

  const value = useMemo(
    () => ({ session, signIn, signOut, setFxRule }),
    [session, signIn, signOut, setFxRule],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>");
  return value;
}
