import { SiteHeader } from "@/components/site-header";
import { WalletStatus } from "@/components/wallet/wallet-status";

const STEPS = [
  {
    title: "Import",
    body: "Recebi reads your wallet's onchain history and lists every incoming stablecoin payment, with date, amount, payer and memo.",
  },
  {
    title: "Seal",
    body: "Classify each payment, value it in BRL at the Central Bank's PTAX rate, and seal the receipt's hash on Solana with one signature.",
  },
  {
    title: "Verify",
    body: "Your accountant or exchange opens a public link and checks the receipt against the chain. Nobody has to trust Recebi.",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 sm:px-8">
        <section className="pb-14 pt-16 sm:pb-20 sm:pt-24">
          <h1 className="max-w-3xl font-display text-5xl leading-[1.05] tracking-tight sm:text-7xl">
            Proof of income for Brazilians paid in stablecoins.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            Connect a Solana wallet and every incoming stablecoin payment becomes an
            accountant-ready record: classified, valued in BRL at the Central Bank&apos;s official
            PTAX rate, and backed by a receipt anyone can verify onchain.
          </p>
          <div className="mt-10 max-w-2xl">
            <WalletStatus />
          </div>
        </section>

        <section aria-label="How it works" className="border-t border-line py-14 sm:py-20">
          <ol className="grid gap-10 sm:grid-cols-3 sm:gap-8">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <p className="font-mono text-sm tabular-nums text-accent">0{index + 1}</p>
                <h2 className="mt-3 font-display text-3xl">{step.title}</h2>
                <p className="mt-3 leading-7 text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <footer className="border-t border-line">
        <p className="mx-auto w-full max-w-5xl px-5 py-6 text-sm text-muted sm:px-8">
          Devnet only. Recebi does not convert currency, custody funds or calculate taxes.
        </p>
      </footer>
    </>
  );
}
