// Single place to swap mocks for real providers later (e.g. BtcpayGreenfieldService).
import {
  MockBtcpayService, MockDepositService, MockLedgerService, MockMarketPriceService,
  MockWalletService, MockWebhookService, MockWithdrawalService,
} from "./mocks";

export * from "./types";

/** Real transactions stay off until this is deliberately flipped with real implementations. */
export const PAYMENTS_ENABLED = false;

const btcpay = new MockBtcpayService();
const ledger = new MockLedgerService();

export const services = {
  marketPrice: new MockMarketPriceService(),
  btcpay,
  deposits: new MockDepositService(btcpay),
  withdrawals: new MockWithdrawalService(btcpay),
  ledger,
  wallet: new MockWalletService(ledger),
  webhooks: new MockWebhookService(),
};
