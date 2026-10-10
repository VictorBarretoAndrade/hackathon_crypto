# Decisions

Short log of technical choices and why we made them. Newest phase last.

## Phase 0: setup

**Next.js 16 with Cache Components turned off.** `create-next-app` now enables
`cacheComponents` and `partialPrefetching` by default. With them on, any page
that reads a cookie or a route parameter must sit inside `<Suspense>` or use
`"use cache"`, or the build fails. Almost every Recebi page is per-user and
wallet-driven, so that buys us nothing and adds a class of errors. We use the
previous rendering model, which Next.js 16 still supports and documents.

**No `src/` directory.** Routes live in `app/`, logic in `lib/`, tests in
`test/`. Note that the dashboard route `/app` is the folder `app/app/`.

**Wallets are discovered through the Wallet Standard.** We pass an empty adapter
list to `WalletProvider`; Phantom, Solflare and Backpack register themselves.
This avoids `@solana/wallet-adapter-wallets`, which installs dozens of wallet
SDKs we do not need and is a common source of build problems.

**Our own connect button instead of `WalletMultiButton`.** It is about 40 lines,
matches the product's look, and renders the same HTML on the server and on the
client, so there is no hydration mismatch to work around. The wallet picker
modal still comes from `@solana/wallet-adapter-react-ui`.

**Devnet is enforced twice.** `lib/solana/cluster.ts` throws at startup if
`NEXT_PUBLIC_SOLANA_CLUSTER` is not `devnet`. Because an RPC URL does not prove
which network is behind it, we also compare the node's genesis hash with
devnet's and show the result next to the connected wallet.

**Token amounts are `bigint` in base units.** `formatUnits` builds the decimal
string by slicing digits, so no amount ever passes through a float. When it has
to shorten a number for display it truncates rather than rounds, so the UI never
shows more than the wallet holds. TypeScript targets ES2020 for `bigint`
literals; this only affects type-checking, not the browser bundle.

**Tests cover pure logic only.** Vitest runs in the `node` environment with no
jsdom or React Testing Library. The value of this product is in parsing,
hashing and currency maths, and those are plain functions.

**Light theme only, one accent colour.** Green is reserved for the Verified
seal, links and success states; buttons and text are ink. Red appears only for
Mismatch and errors. A single theme keeps the demo videos consistent.

**Known `npm audit` findings, left as they are.** All of them come from
transitive dependencies of `@solana/web3.js` v1 and the wallet adapter, have no
fix available, and are outside the code we run: `braces` belongs to React
Native's Metro bundler (pulled in by the mobile wallet adapter), `stream-json`
is used by `jayson`'s server-side stream parser (we only use its client), and
the `uuid` advisory affects v3/v5/v6 with a caller-supplied buffer (`jayson`
only calls v4). We did not run `npm audit fix --force`, which would break the
Solana stack.
