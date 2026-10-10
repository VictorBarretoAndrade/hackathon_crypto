// HTTP smoke test for mock mode. Start the app with `npm run dev:mock`, then:
//   node scripts/smoke-mock.mjs [http://localhost:3000]
// It signs in as the demo wallet and walks through every API route, including
// a real signed memo transaction sent to the mock node. It RESETS the mock data.
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

const BASE = process.argv[2] ?? "http://localhost:3000";
const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

// Same derivation as lib/mock/keys.ts. These demo keys are public by design.
const ana = Keypair.fromSeed(
  nacl.hash(new TextEncoder().encode("recebi-mock:wallet:ana")).slice(0, 32),
);
const wallet = ana.publicKey.toBase58();

const cookies = new Map();
let failures = 0;

function check(label, condition, detail = "") {
  if (!condition) failures++;
  console.log(`${condition ? "ok  " : "FAIL"} ${label}${detail ? `  (${detail})` : ""}`);
}

async function call(method, path, body, { auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth && cookies.size > 0) {
    headers.Cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  }
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(";");
    const index = pair.indexOf("=");
    const value = pair.slice(index + 1);
    if (value) cookies.set(pair.slice(0, index), value);
    else cookies.delete(pair.slice(0, index));
  }
  return response;
}

const json = async (method, path, body, options) => {
  const response = await call(method, path, body, options);
  return { status: response.status, body: await response.json() };
};

// --- Access control ---------------------------------------------------------
check("private routes need a session", (await json("GET", "/api/receipts")).status === 401);

await json("POST", "/api/mock/reset");

// --- Login by signing a message --------------------------------------------
const nonce = await json("POST", "/api/auth/nonce", { wallet });
check("nonce message names the wallet", nonce.body.message?.includes(wallet));

const forged = bs58.encode(nacl.sign.detached(new TextEncoder().encode("something else"), ana.secretKey));
check(
  "a signature over another message is rejected",
  (await json("POST", "/api/auth/verify", { wallet, signature: forged })).status === 401,
);

const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(nonce.body.message), ana.secretKey));
const login = await json("POST", "/api/auth/verify", { wallet, signature });
check("login succeeds", login.status === 200 && login.body.wallet === wallet, JSON.stringify(login.body));
check("session is an httpOnly cookie", cookies.has("recebi_session"));
check("/api/auth/me returns the wallet", (await json("GET", "/api/auth/me")).body.wallet === wallet);

// --- Import -----------------------------------------------------------------
const first = await json("POST", "/api/receipts/import");
check("import finds the 4 demo payments", first.body.imported === 4, JSON.stringify(first.body));
check("importing again adds nothing", (await json("POST", "/api/receipts/import")).body.imported === 0);

let { receipts } = (await json("GET", "/api/receipts")).body;
check("4 receipts listed, all valued in BRL", receipts.length === 4 && receipts.every((r) => r.amount_brl));
const acme = receipts.find((r) => r.amount === "1,200.00");

// --- Classify ---------------------------------------------------------------
const classified = await json("PATCH", `/api/receipts/${acme.id}`, {
  category: "service",
  description: "Web app development, September",
  contact: { name: "Acme Labs", kind: "client" },
});
check("classification is saved", classified.body.receipt?.status === "classified", JSON.stringify(classified.body));
check(
  "unknown category is rejected",
  (await json("PATCH", `/api/receipts/${acme.id}`, { category: "bribe" })).status === 400,
);

// --- Seal -------------------------------------------------------------------
const draft = await json("POST", `/api/receipts/${acme.id}/seal`);
check("seal draft has a 64-hex hash", /^[0-9a-f]{64}$/.test(draft.body.receipt_hash ?? ""), JSON.stringify(draft.body).slice(0, 120));
check("memo follows recebi:v1:<hash>:<payment_tx>", draft.body.memo === `recebi:v1:${draft.body.receipt_hash}:${acme.tx_signature}`);

const connection = new Connection(`${BASE}/api/mock/rpc`, "confirmed");
const memoTx = new Transaction().add(
  new TransactionInstruction({
    programId: MEMO_PROGRAM,
    keys: [{ pubkey: ana.publicKey, isSigner: true, isWritable: false }],
    data: Buffer.from(draft.body.memo, "utf8"),
  }),
);
memoTx.feePayer = ana.publicKey;
memoTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
memoTx.sign(ana);
const sealSignature = await connection.sendRawTransaction(memoTx.serialize());
const status = (await connection.getSignatureStatuses([sealSignature])).value[0];
check("mock node confirms the seal transaction", status?.confirmationStatus === "finalized");

const sealed = await json("PUT", `/api/receipts/${acme.id}/seal`, { signature: sealSignature });
check("receipt is sealed", sealed.body.receipt?.status === "sealed", JSON.stringify(sealed.body).slice(0, 160));
check(
  "a sealed receipt cannot be edited",
  (await json("PATCH", `/api/receipts/${acme.id}`, { category: "prize" })).status === 409,
);

const published = await json("GET", `/api/public/receipts/${acme.id}`, undefined, { auth: false });
check("sealed receipt is public", published.body.seal_signature === sealSignature);
check("public receipt is marked recebi:mock", JSON.parse(published.body.receipt_json).network === "recebi:mock");
const unsealed = receipts.find((r) => r.id !== acme.id);
check(
  "an unsealed receipt is not public",
  (await json("GET", `/api/public/receipts/${unsealed.id}`, undefined, { auth: false })).status === 404,
);

// --- Invoice ----------------------------------------------------------------
const mint = acme.mint;
const created = await json("POST", "/api/invoices", {
  client_name: "Acme Labs",
  description: "October retainer",
  amount: "2500",
  mint,
});
const invoice = created.body.invoice;
check("invoice INV-0001 created", invoice?.number === "INV-0001", JSON.stringify(created.body).slice(0, 160));
check("Solana Pay URL starts with solana:<recipient>", invoice.solana_pay_url.startsWith(`solana:${wallet}?amount=2500&spl-token=${mint}`));
check(
  "invoice page is public and pending",
  (await json("GET", `/api/invoices/${invoice.id}/status`, undefined, { auth: false })).body.invoice.status === "pending",
);
await json("POST", "/api/mock/pay-invoice", { invoice_id: invoice.id });
const paid = await json("GET", `/api/invoices/${invoice.id}/status`, undefined, { auth: false });
check("invoice flips to paid after the client pays", paid.body.invoice.status === "paid");
receipts = (await json("GET", "/api/receipts")).body.receipts;
const invoiceReceipt = receipts.find((r) => r.invoice_number === "INV-0001");
check("the payment arrives classified", invoiceReceipt?.category === "service" && invoiceReceipt?.contact?.name === "Acme Labs");

// --- Reports ----------------------------------------------------------------
const month = acme.block_time_brt.slice(0, 7);
const report = await json("GET", `/api/reports?month=${month}`);
check("monthly report has totals", report.body.report?.totals.length > 0);

const csv = await call("GET", `/api/reports/csv?month=${month}`);
const csvText = await csv.text();
check("CSV export", csv.headers.get("content-type")?.includes("text/csv") && csvText.includes("date_brt,tx_signature"));

for (const [label, path] of [
  ["summary PDF", `/api/reports/pdf?month=${month}`],
  ["proof-of-origin PDF", `/api/reports/dossier?ids=${acme.id},${unsealed.id}`],
]) {
  const response = await call("GET", path);
  const bytes = Buffer.from(await response.arrayBuffer());
  check(label, response.status === 200 && bytes.subarray(0, 5).toString() === "%PDF-", `${response.status}, ${bytes.length} bytes`);
}

// --- Simulated cash-out -----------------------------------------------------
const quote = await json("POST", "/api/payouts/quote", { mint, amount: "1000" });
check("payout quote is flagged as simulated", quote.body.quote?.simulated === true, JSON.stringify(quote.body).slice(0, 160));
const payout = await json("POST", "/api/payouts", { mint, amount: "1000", pix_key: "ana@example.com" });
check("payout is recorded as simulated", payout.body.payout?.status === "simulated");

// --- Logout -----------------------------------------------------------------
await json("POST", "/api/auth/logout");
check("logout ends the session", (await json("GET", "/api/receipts")).status === 401);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
