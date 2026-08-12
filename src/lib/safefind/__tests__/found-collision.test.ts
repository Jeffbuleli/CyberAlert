import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyFoundDeclarationCollision } from "../found-collision";

describe("SafeFind found declaration collision", () => {
  it("same finder + editable status resumes dossier", () => {
    assert.equal(
      classifyFoundDeclarationCollision({
        declarantUserId: "user-a",
        existing: {
          initialFinderUserId: "user-a",
          status: "HELD_BY_FINDER",
          currentPartnerId: null,
        },
      }),
      "same_finder_resume",
    );
  });

  it("same finder + deposited status is read-only", () => {
    assert.equal(
      classifyFoundDeclarationCollision({
        declarantUserId: "user-a",
        existing: {
          initialFinderUserId: "user-a",
          status: "DEPOSITED_AT_PARTNER",
          currentPartnerId: "partner-1",
        },
      }),
      "same_finder_readonly",
    );
  });

  it("different finder + early status is concurrent collusion", () => {
    assert.equal(
      classifyFoundDeclarationCollision({
        declarantUserId: "user-b",
        existing: {
          initialFinderUserId: "user-a",
          status: "HELD_BY_FINDER",
          currentPartnerId: null,
        },
      }),
      "cross_finder_concurrent",
    );
  });

  it("different finder + partner custody is refound", () => {
    assert.equal(
      classifyFoundDeclarationCollision({
        declarantUserId: "user-b",
        existing: {
          initialFinderUserId: "user-a",
          status: "DEPOSITED_AT_PARTNER",
          currentPartnerId: "partner-1",
        },
      }),
      "cross_finder_refound",
    );
  });
});
