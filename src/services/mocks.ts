// Mock implementations: no real money moves. Safe to use while integrations are off.
import type {
  BtcpayService, DepositService, Invoice, LedgerEntry, LedgerService, MarketPriceService,
  Payout, WalletService, WithdrawalService, WebhookService,
} from "./types";

const now = () => new Date().toISOString();
const id = (p: string) => `${p}_mock_${Math.random().toString(36).slice(2, 10)}`;

/** Uses the site's own cached quote endpoint (display-only). */
export class MockMarketPriceService implements MarketPriceService {
  async getBitcoinPrice(currency: "BRL" | "USD") {
    const res = await fetch("/api/market/bitcoin");
    if (!res.ok) throw new Error("Cotação temporariamente indisponível");
    const d = await res.json();
    const price = Number(currency === "BRL" ? d.btc_brl : d.btc_usd);
    if (!(price > 0)) throw new Error("Cotação inválida");
    return { currency, price, updatedAt: d.updated_at ?? now(), stale: !!d.stale, source: d.source ?? "coingecko" };
  }
}

export class MockBtcpayService implements BtcpayService {
  private invoices = new Map<string, Invoice>();
  async createInvoice(input: { amountSats: number }) {
    const inv: Invoice = {
      id: id("inv"), amountSats: input.amountSats, status: "new", checkoutUrl: null,
      bitcoinAddress: null, createdAt: now(), expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
    this.invoices.set(inv.id, inv);
    return inv;
  }
  async getInvoice(invoiceId: string) {
    const inv = this.invoices.get(invoiceId);
    if (!inv) throw new Error("Fatura não encontrada");
    return inv;
  }
  async createPayout(input: { amountSats: number; destination: string }): Promise<Payout> {
    return { id: id("pay"), amountSats: input.amountSats, destination: input.destination, status: "pending", createdAt: now() };
  }
}

export class MockDepositService implements DepositService {
  constructor(private btcpay: BtcpayService) {}
  requestDeposit(userId: string, amountSats: number) {
    return this.btcpay.createInvoice({ userId, amountSats, purpose: "deposit" });
  }
  getDeposit(invoiceId: string) { return this.btcpay.getInvoice(invoiceId); }
}

export class MockWithdrawalService implements WithdrawalService {
  private list: Payout[] = [];
  constructor(private btcpay: BtcpayService) {}
  async requestWithdrawal(input: { userId: string; amountSats: number; destination: string }) {
    if (!Number.isInteger(input.amountSats) || input.amountSats <= 0) throw new Error("Valor inválido");
    const p = await this.btcpay.createPayout(input);
    this.list.push(p);
    return p;
  }
  async listWithdrawals() { return [...this.list]; }
}

export class MockLedgerService implements LedgerService {
  private entries: LedgerEntry[] = [];
  async record(e: Omit<LedgerEntry, "id" | "createdAt">) {
    if (!Number.isInteger(e.amountSats)) throw new Error("Satoshis devem ser inteiros");
    const dup = e.reference && this.entries.find((x) => x.type === e.type && x.reference === e.reference);
    if (dup) return dup; // idempotent
    const entry = { ...e, id: id("led"), createdAt: now() };
    this.entries.push(entry);
    return entry;
  }
  async list(userId: string) { return this.entries.filter((e) => e.userId === userId); }
  async balanceOf(userId: string) {
    return (await this.list(userId)).reduce((s, e) => s + e.amountSats, 0);
  }
}

export class MockWalletService implements WalletService {
  constructor(private ledger: LedgerService) {}
  async getBalance(userId: string) {
    return { availableSats: await this.ledger.balanceOf(userId), inGameSats: 0, pendingSats: 0 };
  }
}

/** Mock never accepts webhooks: real one must verify BTCPay HMAC (BTCPay-Sig). */
export class MockWebhookService implements WebhookService {
  async verify() { return false; }
  parse(raw: string) { const r = JSON.parse(raw); return { id: String(r.deliveryId ?? ""), type: r.type, invoiceId: r.invoiceId, raw: r }; }
  async handle() { /* no-op while integrations are disabled */ }
}
