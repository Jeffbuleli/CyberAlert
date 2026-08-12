import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeRestitutionFees, ownerPaymentBreakdown } from "../fees";

describe("SafeFind restitution fees", () => {
  it("passport: 30000 base + 5% tx, 10% partner, 10% treasury", () => {
    const f = computeRestitutionFees("passeport");
    assert.equal(f.baseReward, "30000");
    assert.equal(f.transactionFee, "1500");
    assert.equal(f.ownerTotal, "31500");
    assert.equal(f.partnerCommission, "3000");
    assert.equal(f.treasury, "3000");
    assert.equal(f.finderGross, "24000");
    assert.equal(f.finderNetworkFee, "150");
    assert.equal(f.finderNetPayout, "23850");
  });

  it("permis: 20000 base", () => {
    const f = computeRestitutionFees("permis_conduire");
    assert.equal(f.baseReward, "20000");
    assert.equal(f.ownerTotal, "21000");
    assert.equal(f.partnerCommission, "2000");
    assert.equal(f.finderNetPayout, "15900");
  });

  it("carte electeur: 10000 base", () => {
    const f = computeRestitutionFees("carte_electeur");
    assert.equal(f.baseReward, "10000");
    assert.equal(f.ownerTotal, "10500");
    assert.equal(f.finderNetPayout, "7950");
  });

  it("owner payment includes delivery fee", () => {
    const b = ownerPaymentBreakdown({
      documentType: "passeport",
      deliveryFee: "8000",
    });
    assert.equal(b.totalDue, "39500");
  });
});
