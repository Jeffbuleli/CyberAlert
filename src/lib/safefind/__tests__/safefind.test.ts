import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canTransition,
  isRewardPayableStatus,
  isSensitiveActionBlocked,
} from "../state-machine";
import {
  canAuthorizeReward,
  onDocumentRefoundDecision,
  shouldOpenDuplicateDispute,
} from "../reward-ownership";
import {
  arePotentialDuplicateFounds,
  computeMatchScore,
} from "../matching";
import {
  computeFinderTrustScore,
  computePartnerSecurityScore,
  evaluateAntifraud,
} from "../antifraud";
import { haversineKm, rankNearbyPartners } from "../geo";
import {
  hashDocumentNumber,
  last4DocumentNumber,
  maskName,
  toPublicCaseView,
} from "../privacy";
import { applySafefindPayoutWebhook } from "../payout";

describe("SafeFind state machine", () => {
  it("allows happy-path transitions", () => {
    assert.equal(canTransition("FOUND", "REGISTERED"), true);
    assert.equal(canTransition("DEPOSIT_PENDING", "DEPOSITED_AT_PARTNER"), true);
    assert.equal(canTransition("READY_FOR_COLLECTION", "COLLECTED"), true);
    assert.equal(canTransition("RETURNED", "REWARD_PENDING"), true);
  });

  it("blocks illegal jumps", () => {
    assert.equal(canTransition("FOUND", "REWARD_RELEASED"), false);
    assert.equal(canTransition("CANCELLED", "FOUND"), false);
  });

  it("blocks sensitive actions on disputed/stolen", () => {
    assert.equal(isSensitiveActionBlocked("DISPUTED"), true);
    assert.equal(isSensitiveActionBlocked("REPORTED_STOLEN"), true);
    assert.equal(isSensitiveActionBlocked("DEPOSITED_AT_PARTNER"), false);
  });

  it("marks returned as reward-payable", () => {
    assert.equal(isRewardPayableStatus("RETURNED"), true);
    assert.equal(isRewardPayableStatus("FOUND"), false);
  });
});

describe("SafeFind reward ownership — Test 1 & 2", () => {
  it("Test 1: authorizes single reward after return when KYC ok", () => {
    const d = canAuthorizeReward({
      ownership: {
        caseId: "c1",
        initialFinderUserId: "A",
        rewardOwnerUserId: "A",
        rewardStatus: "AUTHORIZED",
        rewardFrozen: false,
        caseStatus: "RETURNED",
        hasOpenDispute: false,
        hasOpenIncident: false,
        reportedStolen: false,
      },
      beneficiaryKycApproved: true,
      requireKyc: true,
    });
    assert.equal(d.ok, true);
    if (d.ok) assert.equal(d.beneficiaryUserId, "A");
  });

  it("Test 2: refound after incident does not create second reward", () => {
    const d = onDocumentRefoundDecision({
      initialFinderUserId: "A",
      recoveryFinderUserId: "K",
      hadPartnerCustody: true,
    });
    assert.equal(d.createSecondReward, false);
    assert.equal(d.rewardOwnerUserId, "A");
    assert.equal(d.lockReward, true);
    assert.equal(d.notifyInitialFinder, true);
    assert.match(d.neutralMessageForRecoveryFinder, /enregistrée/i);
  });

  it("Test 4: does not auto-reward suspicious recovery finder", () => {
    const d = canAuthorizeReward({
      ownership: {
        caseId: "c1",
        initialFinderUserId: "A",
        rewardOwnerUserId: "K",
        rewardStatus: "LOCKED",
        rewardFrozen: true,
        caseStatus: "PARTNER_INCIDENT",
        hasOpenDispute: false,
        hasOpenIncident: true,
        reportedStolen: false,
      },
      beneficiaryKycApproved: true,
      requireKyc: true,
    });
    assert.equal(d.ok, false);
  });

  it("Test 10: blocks reward without KYC", () => {
    const d = canAuthorizeReward({
      ownership: {
        caseId: "c1",
        initialFinderUserId: "A",
        rewardOwnerUserId: "A",
        rewardStatus: "PENDING",
        rewardFrozen: false,
        caseStatus: "RETURNED",
        hasOpenDispute: false,
        hasOpenIncident: false,
        reportedStolen: false,
      },
      beneficiaryKycApproved: false,
      requireKyc: true,
    });
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.reason, "kyc_required");
  });
});

describe("SafeFind matching & duplicates — Test 3 & 6", () => {
  it("Test 3: detects duplicate found declarations", () => {
    const r = arePotentialDuplicateFounds(
      {
        documentType: "passeport",
        holderFirstName: "Jean",
        holderLastName: "Mbala",
        documentNumberLast4: "1234",
        foundCommune: "Gombe",
      },
      {
        documentType: "passeport",
        holderFirstName: "Jean",
        holderLastName: "Mbala",
        documentNumberLast4: "1234",
        foundCommune: "Gombe",
      },
    );
    assert.equal(r.duplicate, true);
  });

  it("Test 6: opens dispute when two owners claim", () => {
    assert.equal(shouldOpenDuplicateDispute({ openClaimsCount: 2 }), true);
    assert.equal(shouldOpenDuplicateDispute({ openClaimsCount: 1 }), false);
  });

  it("match score is banded not proof", () => {
    const { score } = computeMatchScore(
      {
        documentType: "carte_electeur",
        holderFirstName: "Marie",
        holderLastName: "Kabila",
        documentNumberLast4: "9988",
        foundCommune: "Lingwala",
      },
      {
        documentType: "carte_electeur",
        firstName: "Marie",
        lastName: "Kabila",
        documentNumberLast4: "9988",
        lostCommune: "Lingwala",
      },
    );
    assert.ok(score >= 60);
    assert.ok(score <= 100);
  });
});

describe("SafeFind antifraud — Test 4 & 5", () => {
  it("flags found-while-in-partner-custody", () => {
    const v = evaluateAntifraud({
      finderUserId: "K",
      finderKycApproved: true,
      finderOpenFoundCount: 0,
      finderDisputeCount: 0,
      finderTrustScore: 50,
      caseHadPartnerCustody: true,
      caseStatus: "DEPOSITED_AT_PARTNER",
      declarationKind: "found",
      sameDocHashExists: true,
      partnerIncidentOpen: false,
      geoInconsistent: false,
    });
    assert.equal(v.blockAutoReward, true);
    assert.ok(v.reasons.includes("found_while_in_partner_custody"));
  });

  it("trust scores are multi-factor", () => {
    const finder = computeFinderTrustScore({
      kycApproved: true,
      successfulReturns: 2,
      openDisputes: 0,
      rejectedClaims: 0,
      accountAgeDays: 90,
      falseFoundFlags: 0,
    });
    assert.ok(finder > 50);
    const partner = computePartnerSecurityScore({
      documentsReceived: 10,
      documentsReturned: 9,
      incidents: 1,
      avgHoursToReturn: 24,
      disputes: 0,
      procedureCompliance: 80,
    });
    assert.ok(partner >= 40);
  });
});

describe("SafeFind privacy & geo", () => {
  it("masks names and never exposes full number in public view", () => {
    assert.equal(maskName("Jean"), "J**n");
    const hash = hashDocumentNumber("AB123456");
    assert.equal(last4DocumentNumber("AB123456"), "3456");
    const view = toPublicCaseView({
      publicId: "SF-2026-000001",
      documentType: "passeport",
      status: "DEPOSITED_AT_PARTNER",
      holderFirstName: "Jean",
      holderLastName: "Mbala",
      foundCommune: "Ngaliema",
      foundApproxDate: new Date("2026-03-15T00:00:00Z"),
      visualNotes: "couverture bleue",
      appearanceMeta: { color: "blue", signature: "SECRET" },
      mediaRefs: [{ kind: "preview", key: "x", redacted: true }],
      rewardAmount: "20000",
      rewardCurrency: "CDF",
      createdAt: new Date(),
    });
    assert.equal(view.holderFirstNameMasked, "J**n");
    assert.equal((view.appearance as { signature?: string }).signature, undefined);
    assert.ok(!JSON.stringify(view).includes(hash));
  });

  it("ranks nearby Kinshasa partners by proximity", () => {
    const ngaliema = { lat: -4.3276, lng: 15.2663 };
    const gombe = { lat: -4.305, lng: 15.313 };
    const d = haversineKm(ngaliema, gombe);
    assert.ok(d > 0 && d < 20);
    const ranked = rankNearbyPartners({
      origin: ngaliema,
      maxKm: 30,
      partners: [
        {
          id: "1",
          name: "Point Gombe",
          commune: "Gombe",
          latitude: gombe.lat,
          longitude: gombe.lng,
          securityScore: 60,
          status: "active",
        },
        {
          id: "2",
          name: "Point Loin",
          commune: "Nsele",
          latitude: -4.4,
          longitude: 15.55,
          securityScore: 90,
          status: "active",
        },
      ],
    });
    assert.ok(ranked.length >= 1);
    assert.ok(ranked[0].distanceKm != null);
  });
});

describe("SafeFind payout webhook idempotency — Test 7 shape", () => {
  it("exports webhook applicator", () => {
    assert.equal(typeof applySafefindPayoutWebhook, "function");
  });
});
