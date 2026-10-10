# Recebi

Proof of income for Brazilians paid in stablecoins.

Connect a Solana wallet and every incoming stablecoin payment becomes an
accountant-ready record: classified, valued in BRL at the Central Bank's
official PTAX rate, and backed by a receipt anyone can verify onchain.

> **Status:** work in progress, built for Colosseum's Crypto World's Fair
> hackathon. Devnet only. So far the app connects a wallet and checks the
> network; import, sealing and verification are being built next.

Recebi does not convert currency, custody funds or calculate taxes.

## Run it locally

Requirements: Node.js 20 or newer, and [Phantom](https://phantom.com) with
testnet mode on and the network set to **Solana Devnet**
(Settings > Developer Settings > Testnet Mode).

```bash
npm install
cp .env.example .env.local   # then fill in the blanks
npm run dev
```

Open http://localhost:3000 and click **Connect wallet**.

### Environment variables

`.env.example` documents every variable. For the current stage the defaults
work as they are; `NEXT_PUBLIC_RPC_URL` can stay empty to use the public devnet
RPC, though a free keyed endpoint (Helius, for example) is more reliable.

### Database

Create a free Supabase project, open the SQL Editor and run
[`supabase/schema.sql`](supabase/schema.sql). Row Level Security is enabled on
every table with no policies: only the server, using the `service_role` key,
can read or write.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |

## Project layout

```
app/          pages and API routes (Next.js App Router)
components/   React components
lib/          logic: config, Solana, money
supabase/     database schema
test/         unit tests
```

Technical choices and their reasons are logged in [DECISIONS.md](DECISIONS.md).

## License

[MIT](LICENSE)
