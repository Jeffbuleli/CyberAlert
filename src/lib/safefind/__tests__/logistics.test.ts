import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canTransition,
  isAtPartner,
  isInDelivery,
  isRewardPayableStatus,
} from "../state-machine";
import {
  capacityStatusFromPct,
  SAFEFIND_DEFAULT_CONFIG,
} from "../types";
import {
  computePartnerSelectionScore,
  rankNearbyPartners,
} from "../geo";
import {
  feeBreakdown,
  ownerFacingCustodySummary,
} from "../logistics";
import { onDocumentRefoundDecision } from "../reward-ownership";
import { InternalDeliveryProvider } from "../delivery-provider";

describe("SafeFind logistics state machine", () => {
  it("Test A path: partner deposit to pickup reserved", () => {
    assert.equal(canTransition("DEPOSITED_AT_PARTNER", "PICKUP_RESERVED"), true);
    assert.equal(canTransition("PICKUP_RESERVED", "READY_FOR_PICKUP"), true);
    assert.equal(canTransition("READY_FOR_PICKUP", "COLLECTED"), true);
  });

  it("Test B path: delivery requested to delivered", () => {
    assert.equal(canTransition("READY_FOR_COLLECTION", "DELIVERY_REQUESTED"), true);
    assert.equal(canTransition("DELIVERY_REQUESTED", "DELIVERY_AUTHORIZED"), true);
    assert.equal(canTransition("IN_TRANSIT", "ARRIVED"), true);
    assert.equal(canTransition("ARRIVED", "DELIVERED"), true);
    assert.equal(isRewardPayableStatus("DELIVERED"), true);
  });

  it("Test C: delivery failed returns to partner", () => {
    assert.equal(canTransition("DELIVERY_FAILED", "RETURN_TO_PARTNER"), true);
    assert.equal(canTransition("RETURN_TO_PARTNER", "READY_FOR_PICKUP"), true);
  });

  it("Test D/E: held by finder flows", () => {
    assert.equal(canTransition("FOUND", "HELD_BY_FINDER"), true);
    assert.equal(canTransition("HELD_BY_FINDER", "DEPOSIT_PENDING"), true);
    assert.equal(canTransition("HELD_BY_FINDER", "OWNER_VERIFICATION"), true);
  });

  it("Test K: chain break status", () => {
    assert.equal(canTransition("DEPOSITED_AT_PARTNER", "POTENTIAL_CHAIN_BREAK"), true);
    assert.equal(canTransition("HELD_BY_FINDER", "POTENTIAL_CHAIN_BREAK"), true);
  });

  it("helpers at partner / in delivery", () => {
    assert.equal(isAtPartner("STORED_AT_LOCATION"), true);
    assert.equal(isInDelivery("IN_TRANSIT"), true);
  });
});

describe("capacity and routing - Test I", () => {
  it("capacity bands configurable", () => {
    assert.equal(capacityStatusFromPct(50), "AVAILABLE");
    assert.equal(capacityStatusFromPct(75), "NEAR_CAPACITY");
    assert.equal(capacityStatusFromPct(95), "FULL");
  });

  it("prefers roomy partner over nearer full-ish one", () => {
    const nearFull = computePartnerSelectionScore({
      distanceKm: 0.8,
      securityScore: 95,
      capacityPct: 98,
      capacityStatus: "FULL",
      openNow: true,
    });
    const fartherRoomy = computePartnerSelectionScore({
      distanceKm: 1.5,
      securityScore: 97,
      capacityPct: 40,
      capacityStatus: "AVAILABLE",
      openNow: true,
    });
    assert.ok(nearFull < fartherRoomy);

    const ranked = rankNearbyPartners({
      origin: { lat: -4.32, lng: 15.27 },
      maxKm: 20,
      partners: [
        {
          id: "a",
          name: "A",
          commune: "Ngaliema",
          latitude: -4.321,
          longitude: 15.271,
          securityScore: 95,
          status: "active",
          storageCapacity: 100,
          currentStorageCount: 98,
          capacityStatus: "FULL",
        },
        {
          id: "b",
          name: "B",
          commune: "Gombe",
          latitude: -4.305,
          longitude: 15.313,
          securityScore: 97,
          status: "active",
          storageCapacity: 100,
          currentStorageCount: 40,
          capacityStatus: "AVAILABLE",
        },
      ],
    });
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].id, "b");
  });
});

describe("privacy and fees - Test G N O", () => {
  it("fee breakdown is explicit", () => {
    const b = feeBreakdown({
      rewardAmount: "5000",
      deliveryFee: "8000",
      currency: "CDF",
    });
    assert.equal(b.finderReward, "5000");
    assert.equal(b.deliveryFee, "8000");
    assert.equal(b.total, "13000");
  });

  it("owner facing summary never includes finder identity", () => {
    const s = ownerFacingCustodySummary("HELD_BY_FINDER", true);
    assert.equal(s.situation, "held_by_finder");
    assert.ok(!JSON.stringify(s).toLowerCase().includes("phone"));
    assert.ok(!JSON.stringify(s).toLowerCase().includes("name"));
  });

  it("Test J: refound still one reward", () => {
    const d = onDocumentRefoundDecision({
      initialFinderUserId: "A",
      recoveryFinderUserId: "K",
      hadPartnerCustody: true,
    });
    assert.equal(d.createSecondReward, false);
  });
});

describe("delivery provider - Test M shape", () => {
  it("internal provider accepts assign", async () => {
    const p = new InternalDeliveryProvider();
    const r = await p.assign({
      deliveryId: "d1",
      pickupPartnerId: "p1",
      destinationCommune: "Lingwala",
      destinationQuartier: null,
    });
    assert.equal(r.accepted, true);
  });

  it("config enforces only verified owner default", () => {
    assert.equal(SAFEFIND_DEFAULT_CONFIG.DELIVERY_ONLY_VERIFIED_OWNER, true);
  });
});
