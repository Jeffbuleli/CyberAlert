import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGeoapifyProvider } from "../location/providers/geoapify";
import { getLocationProvider } from "../location/provider";
import { normalizeManualLocation, geoMatchSignal } from "../location/normalize";
import { preferredZoneCodeForDocument } from "../logistics";
import { computeMatchScore } from "../matching";

describe("location provider", () => {
  it("defaults to none without GEOAPIFY_API_KEY", () => {
    const prev = process.env.GEOAPIFY_API_KEY;
    delete process.env.GEOAPIFY_API_KEY;
    const p = getLocationProvider();
    assert.equal(p.configured, false);
    assert.equal(p.id, "none");
    if (prev != null) process.env.GEOAPIFY_API_KEY = prev;
  });

  it("geoapify provider reports configured when key set", () => {
    const prev = process.env.GEOAPIFY_API_KEY;
    process.env.GEOAPIFY_API_KEY = "test-key";
    const p = createGeoapifyProvider();
    assert.equal(p.id, "geoapify");
    assert.equal(p.configured, true);
    if (prev != null) process.env.GEOAPIFY_API_KEY = prev;
    else delete process.env.GEOAPIFY_API_KEY;
  });
});

describe("location normalize", () => {
  it("uses commune centroid when no coords", () => {
    const loc = normalizeManualLocation({
      commune: "Ngaliema",
      landmark: "Marche XYZ",
    });
    assert.equal(loc.city, "Kinshasa");
    assert.equal(loc.precision, "LANDMARK");
    assert.ok(loc.latitude != null);
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
    assert.equal(preferredZoneCodeForDocument("passeport"), "C");
  });
});
