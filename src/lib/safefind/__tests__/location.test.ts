import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeManualLocation, geoMatchSignal } from "../location/normalize";
import { preferredZoneCodeForDocument } from "../logistics";
import { computeMatchScore } from "../matching";

describe("location normalize", () => {
  it("uses commune centroid when no coords", () => {
    const loc = normalizeManualLocation({
      commune: "Ngaliema",
      landmark: "Marche XYZ",
    });
    assert.equal(loc.city, "Kinshasa");
    assert.equal(loc.precision, "LANDMARK");
    assert.ok(loc.latitude != null);
    assert.ok(loc.longitude != null);
  });

  it("marks GPS as EXACT when lat provided", () => {
    const loc = normalizeManualLocation({
      latitude: -4.3,
      longitude: 15.3,
      precision: "EXACT",
      source: "gps",
    });
    assert.equal(loc.precision, "EXACT");
    assert.equal(loc.source, "gps");
  });
});

describe("geo match signal", () => {
  it("scores same commune + close distance as high", () => {
    const s = geoMatchSignal({
      lostLat: -4.32,
      lostLng: 15.26,
      foundLat: -4.33,
      foundLng: 15.27,
      lostCommune: "Ngaliema",
      foundCommune: "Ngaliema",
      distanceKm: 1.2,
    });
    assert.equal(s.label, "high");
    assert.ok(s.score >= 70);
  });

  it("never treats distance alone as proof in matching", () => {
    const { score, signals } = computeMatchScore(
      {
        documentType: "passeport",
        holderFirstName: "A",
        holderLastName: "B",
        foundCommune: "Gombe",
        geoDistanceKm: 0.5,
      },
      {
        documentType: "passeport",
        firstName: "X",
        lastName: "Y",
        lostCommune: "Limete",
        geoDistanceKm: 0.5,
      },
    );
    assert.ok(score < 85);
    assert.equal(signals.geoCoherence, "high");
  });
});

describe("storage zone preference", () => {
  it("maps document types to zones", () => {
    assert.equal(preferredZoneCodeForDocument("carte_electeur"), "A");
    assert.equal(preferredZoneCodeForDocument("permis_conduire"), "B");
    assert.equal(preferredZoneCodeForDocument("passeport"), "C");
  });
});
