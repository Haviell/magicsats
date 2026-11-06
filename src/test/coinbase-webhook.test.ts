import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHmac } from "node:crypto";
import { verifyCoinbaseSignature, statusFromEvent } from "@/lib/payments/coinbase.server";

const secret = "test_secret";
const sign = (body: string, t: number) => {
  const h = "content-type";
  const v1 = createHmac("sha256", secret).update(`${t}.${h}.application/json.${body}`).digest("hex");
  return `t=${t},h=${h},v1=${v1}`;
};
const headers = new Headers({ "content-type": "application/json" });

describe("coinbase webhook", () => {
  const now = 1_700_000_000_000, t = now / 1000, body = '{"id":"e1"}';
  it("accepts a valid signature", async () => expect(await verifyCoinbaseSignature(body, sign(body, t), secret, headers, now)).toBe(true));
  it("rejects a tampered body", async () => expect(await verifyCoinbaseSignature('{"id":"e2"}', sign(body, t), secret, headers, now)).toBe(false));
  it("rejects missing header", async () => expect(await verifyCoinbaseSignature(body, null, secret, headers, now)).toBe(false));
  it("rejects events older than 5 minutes", async () => expect(await verifyCoinbaseSignature(body, sign(body, t - 301), secret, headers, now)).toBe(false));
  it("only success events confirm", () => {
    expect(statusFromEvent("checkout.payment.success")).toBe("confirmed");
    expect(statusFromEvent("checkout.payment.expired")).toBe("expired");
    expect(statusFromEvent("checkout.created")).toBe(null);
  });
  it("browser code never references Coinbase secrets", () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => {
      const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p];
    });
    const files = walk("src/components").concat(walk("src/hooks"));
    for (const f of files) expect(readFileSync(f, "utf8")).not.toMatch(/COINBASE_(API|WEBHOOK|PROJECT)/);
  });
});
