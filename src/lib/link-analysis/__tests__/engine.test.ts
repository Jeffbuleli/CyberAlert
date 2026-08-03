import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isPrivateOrBlockedIp,
  isBlockedHostname,
  normalizeUrlInput,
  analyzeLink,
} from "../engine";

describe("SSRF guards", () => {
  it("blocks private IPv4", () => {
    assert.equal(isPrivateOrBlockedIp("127.0.0.1"), true);
    assert.equal(isPrivateOrBlockedIp("10.0.0.5"), true);
    assert.equal(isPrivateOrBlockedIp("192.168.1.1"), true);
    assert.equal(isPrivateOrBlockedIp("169.254.169.254"), true);
    assert.equal(isPrivateOrBlockedIp("8.8.8.8"), false);
  });

  it("blocks localhost hostnames", () => {
    assert.equal(isBlockedHostname("localhost"), true);
    assert.equal(isBlockedHostname("foo.local"), true);
    assert.equal(isBlockedHostname("example.com"), false);
  });

  it("normalizes bare domains to https", () => {
    const u = normalizeUrlInput("example.com/path");
    assert.equal(u.protocol, "https:");
    assert.equal(u.hostname, "example.com");
  });
});

describe("analyzeLink", () => {
  it("blocks localhost without fetching", async () => {
    const r = await analyzeLink("http://127.0.0.1/", { fetchRemote: false });
    assert.equal(r.blocked, true);
    assert.equal(r.riskLevel, "high");
  });

  it("flags http as caution-capable signal", async () => {
    const r = await analyzeLink("http://example.com", { fetchRemote: false });
    assert.ok(r.signals.some((s) => s.code === "no_https"));
  });
});
