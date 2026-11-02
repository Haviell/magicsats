// Contracts the UI depends on. Providers (CoinGecko, BTCPay, etc.) live behind these.
// All money amounts are integer satoshis; BRL/USD values are display-only.

export type FiatCurrency = "BRL" | "USD";

export interface BitcoinPrice {
  currency: FiatCurrency;
  price: number; // fiat per 1 BTC
  updatedAt: string; // ISO
  stale: boolean;
  source: string;
}

export interface MarketPriceService {
  getBitcoinPrice(currency: FiatCurrency): Promise<BitcoinPrice>;
}

export type InvoiceStatus = "new" | "processing" | "settled" | "expired" | "invalid";

export interface CreateInvoiceInput {
  userId: string;
  amountSats: number;
  purpose: "deposit" | "ticket_purchase";
  metadata?: Record<string, string>;
}

export interface Invoice {
  id: string;
  amountSats: number;
  status: InvoiceStatus;
  checkoutUrl: string | null;
  bitcoinAddress: string | null;
  expiresAt: string;
  createdAt: string;
}

export type PayoutStatus = "pending" | "approved" | "in_progress" | "completed" | "cancelled" | "failed";

export interface CreatePayoutInput {
  userId: string;
  amountSats: number;
  destination: string; // BTC address or lightning invoice
}

export interface Payout {
  id: string;
  amountSats: number;
  destination: string;
  status: PayoutStatus;
  createdAt: string;
}

export interface BtcpayService {
  createInvoice(input: CreateInvoiceInput): Promise<Invoice>;
  getInvoice(invoiceId: string): Promise<Invoice>;
  createPayout(input: CreatePayoutInput): Promise<Payout>;
}

export interface DepositService {
  requestDeposit(userId: string, amountSats: number): Promise<Invoice>;
  getDeposit(invoiceId: string): Promise<Invoice>;
}

export interface WithdrawalService {
  requestWithdrawal(input: CreatePayoutInput): Promise<Payout>;
  listWithdrawals(userId: string): Promise<Payout[]>;
}

export interface WalletBalance {
  availableSats: number;
  inGameSats: number;
  pendingSats: number;
}

export interface WalletService {
  getBalance(userId: string): Promise<WalletBalance>;
}

export type LedgerEntryType =
  | "deposit"
  | "withdrawal"
  | "ticket_purchase"
  | "prize"
  | "transfer_in"
  | "transfer_out"
  | "adjustment";

export interface LedgerEntry {
  id: string;
  userId: string;
  type: LedgerEntryType;
  amountSats: number; // positive = credit, negative = debit
  reference: string | null; // invoice/payout/raffle id; unique per type for idempotency
  createdAt: string;
}

export interface LedgerService {
  record(entry: Omit<LedgerEntry, "id" | "createdAt">): Promise<LedgerEntry>;
  list(userId: string): Promise<LedgerEntry[]>;
  balanceOf(userId: string): Promise<number>;
}

export interface WebhookEvent {
  id: string; // provider delivery id, used for idempotency
  type: "InvoiceSettled" | "InvoiceExpired" | "InvoiceInvalid" | "PayoutCompleted" | "PayoutFailed";
  invoiceId?: string;
  payoutId?: string;
  raw: unknown;
}

export interface WebhookService {
  /** Must verify the HMAC signature over the raw body before trusting anything. */
  verify(rawBody: string, signatureHeader: string | null): Promise<boolean>;
  parse(rawBody: string): WebhookEvent;
  handle(event: WebhookEvent): Promise<void>;
}
