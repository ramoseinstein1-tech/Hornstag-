import { describe, expect, it } from "vitest";
import { creditBalance, type CreditBatch } from "./billing";

function batch(partial: Partial<CreditBatch> & Pick<CreditBatch, "scope" | "quantityRemaining">): CreditBatch {
  return {
    id: Math.random().toString(36),
    annotationKind: "traditional",
    quantityTotal: partial.quantityRemaining,
    source: "per_game",
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe("creditBalance", () => {
  it("sums remaining quantity per scope", () => {
    const batches = [
      batch({ scope: "Single Team", quantityRemaining: 3 }),
      batch({ scope: "Single Team", quantityRemaining: 2 }),
      batch({ scope: "Both Teams", quantityRemaining: 1 }),
    ];
    expect(creditBalance(batches)).toEqual({ "Single Team": 5, "Both Teams": 1 });
  });

  it("excludes expired batches", () => {
    const batches = [
      batch({ scope: "Single Team", quantityRemaining: 5, expiresAt: new Date(Date.now() - 1000).toISOString() }),
      batch({ scope: "Single Team", quantityRemaining: 2, expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString() }),
    ];
    expect(creditBalance(batches)["Single Team"]).toBe(2);
  });

  it("treats a null expiry as never-expiring", () => {
    const batches = [batch({ scope: "Both Teams", quantityRemaining: 4, expiresAt: undefined })];
    expect(creditBalance(batches)["Both Teams"]).toBe(4);
  });

  it("returns zero for a scope with no batches", () => {
    expect(creditBalance([])).toEqual({ "Single Team": 0, "Both Teams": 0 });
  });
});
