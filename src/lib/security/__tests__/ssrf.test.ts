import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isPrivateOrBlockedIp } from "../../link-analysis/engine";

describe("security helpers", () => {
  it("blocks metadata IP", () => {
    assert.equal(isPrivateOrBlockedIp("169.254.169.254"), true);
  });
});
