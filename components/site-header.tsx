import Link from "next/link";
import { ConnectButton } from "@/components/wallet/connect-button";

export function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-display text-2xl leading-none tracking-tight">
            Recebi
          </Link>
          {/* Hidden on very narrow phones, where the connected address needs the room. */}
          <span className="hidden rounded border border-line px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted min-[400px]:inline-block">
            Devnet
          </span>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
