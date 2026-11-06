// Single place to swap mocks for real providers later (e.g. BtcpayGreenfieldService).
import {
  MockCoinbaseProvider, MockDepositService, MockLedgerService, MockMarketPriceService,
  MockWalletService, MockWebhookService, MockWithdrawalService,
} from "./mocks";

export * from "./types";

/** Real transactions stay off until this is deliberately flipped with real implementations. */
export const PAYMENTS_ENABLED = false;

const payments = new MockCoinbaseProvider();
const ledger = new MockLedgerService();

export const services = {
  marketPrice: new MockMarketPriceService(),
  payments,
  deposits: new MockDepositService(payments),
  withdrawals: new MockWithdrawalService(payments),
  ledger,
  wallet: new MockWalletService(ledger),
  webhooks: new MockWebhookService(),
};
