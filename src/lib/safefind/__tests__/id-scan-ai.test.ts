import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseIdScanPayload,
  parseMrzTd3,
  redactParsedForAi,
} from "../id-scan/parse";
import {
  applyAiMatchBandBoost,
  safefindParseDeclaration,
} from "../ai-assist";
import { canAuthorizeReward } from "../reward-ownership";

describe("SafeFind ID scan parse", () => {
  it("parses TD3 passport MRZ", () => {
    const l1 = "P<CODDOE<<JOHN<<<<<<<<<<<<<<<<<<<<<<<<<<<";
    const l2 = "AB12345674COD8001011M2501017<<<<<<<<<<<<<<04";
    // pad to 44
    const line1 = (l1 + "<".repeat(44)).slice(0, 44);
    const line2 = (l2 + "0".repeat(44)).slice(0, 44);
    const parsed = parseMrzTd3(`${line1}\n${line2}`);
    assert.ok(parsed);
    assert.equal(parsed!.documentType, "passeport");
    assert.ok(parsed!.documentNumber);
    assert.ok(!JSON.stringify(redactParsedForAi(parsed!)).includes(parsed!.documentNumber!));
  });

  it("parses JSON QR without leaking full number to AI redact", () => {
    const parsed = parseIdScanPayload(
      JSON.stringify({
        documentType: "permis_conduire",
        firstName: "Amina",
        lastName: "Mwamba",
        documentNumber: "CD-99887766",
      }),
    );
    assert.ok(parsed);
    assert.equal(parsed!.documentType, "permis_conduire");
    const redacted = redactParsedForAi(parsed!);
    assert.equal(redacted.documentNumberLast4, "7766");
    assert.ok(!JSON.stringify(redacted).includes("CD-99887766"));
  });

  it("recognizes sleeve token kind", () => {
    const parsed = parseIdScanPayload("SF-SLV-ABC12345");
    assert.ok(parsed);
    assert.equal(parsed!.rawKind, "sleeve");
  });

  it("parses DRC permis strip", () => {
    const parsed = parseIdScanPayload("D1COD012345678<850725<260929<6");
    assert.ok(parsed);
    assert.equal(parsed!.documentType, "permis_conduire");
    assert.equal(parsed!.documentNumber, "012345678");
    assert.equal(parsed!.birthDate, "1985-07-25");
  });
});

describe("SafeFind AI assist authority bounds", () => {
  it("boosts band only from medium to high", () => {
    const low = applyAiMatchBandBoost(40, {
      potentialMatch: true,
      confidence: 0.99,
      reasons: ["x"],
      riskFlags: [],
      recommendedAction: "verify",
      provider: "template",
    });
    assert.equal(low.scoreBand, "low");
    assert.equal(low.aiBoosted, false);

    const mid = applyAiMatchBandBoost(70, {
      potentialMatch: true,
      confidence: 0.9,
      reasons: ["x"],
      riskFlags: [],
      recommendedAction: "verify",
      provider: "template",
    });
    assert.equal(mid.scoreBand, "high");
    assert.equal(mid.aiBoosted, true);
  });

  it("template NL fills type and reformulates without emdash", async () => {
    const r = await safefindParseDeclaration(
      "J'ai perdu le permis au nom de Martin Specimen n° 0123456789 vers Gombe",
    );
    assert.equal(r.documentType, "permis_conduire");
    assert.ok(r.reformulatedSummary);
    assert.ok(!r.reformulatedSummary!.includes("\u2014"));
  });

  it("high AI confidence still cannot authorize reward alone", () => {
    const d = canAuthorizeReward({
      ownership: {
        caseId: "c1",
        initialFinderUserId: "A",
        rewardOwnerUserId: "A",
        rewardStatus: "PENDING",
        rewardFrozen: true,
        caseStatus: "FOUND",
        hasOpenDispute: false,
        hasOpenIncident: false,
        reportedStolen: false,
      },
      beneficiaryKycApproved: true,
      requireKyc: true,
    });
    assert.equal(d.ok, false);
  });
});
