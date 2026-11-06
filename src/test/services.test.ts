import { describe, it, expect } from "vitest";
import { MockLedgerService, MockWithdrawalService, MockCoinbaseProvider, MockWebhookService } from "@/services/mocks";
import { PAYMENTS_ENABLED } from "@/services";

describe("service layer", () => {
  it("payments stay disabled", () => expect(PAYMENTS_ENABLED).toBe(false));
  it("ledger is idempotent per reference", async () => {
    const l = new MockLedgerService();
    await l.record({ userId: "u", type: "deposit", amountSats: 1000, reference: "inv1" });
    await l.record({ userId: "u", type: "deposit", amountSats: 1000, reference: "inv1" });
    expect(await l.balanceOf("u")).toBe(1000);
  });
  it("rejects fractional satoshis", async () => {
    await expect(new MockLedgerService().record({ userId: "u", type: "prize", amountSats: 1.5, reference: null })).rejects.toThrow();
  });
  it("rejects non-positive withdrawals", async () => {
    await expect(new MockWithdrawalService(new MockCoinbaseProvider()).requestWithdrawal({ userId: "u", amountSats: 0, destination: "x" })).rejects.toThrow();
  });
  it("mock webhook never verifies", async () => expect(await new MockWebhookService().verify()).toBe(false));
});
