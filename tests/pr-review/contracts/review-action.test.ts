import { describe, expect, it } from "@jest/globals";
import { ReviewActionSchema } from "../../../src/pr-review/algorithm/index.js";
import { contractTimestamp } from "./fixtures.js";

function createActionFixture() {
  return {
    actor: {
      id: "actor_contract_01",
      displayName: "Contract Actor",
      role: "ACCOUNT_OPERATOR",
    },
    action: "REVISE" as const,
    reason: "Contract revision",
    fromVersion: 1,
    toVersion: 2,
    timestamp: contractTimestamp,
  };
}

describe("ReviewAction contract", () => {
  it("accepts a valid REVISE action", () => {
    expect(ReviewActionSchema.parse(createActionFixture()).toVersion).toBe(2);
  });

  it.each([
    { fromVersion: null, toVersion: null },
    { fromVersion: 1, toVersion: 3 },
  ])("rejects invalid REVISE version invariant %#", (versions) => {
    expect(
      ReviewActionSchema.safeParse({
        ...createActionFixture(),
        ...versions,
      }).success,
    ).toBe(false);
  });

  it("rejects invalid timestamp and nested actor unknown field", () => {
    expect(
      ReviewActionSchema.safeParse({
        ...createActionFixture(),
        timestamp: "2026-08-31T08:00:00",
      }).success,
    ).toBe(false);
    expect(
      ReviewActionSchema.safeParse({
        ...createActionFixture(),
        actor: { ...createActionFixture().actor, unknownField: true },
      }).success,
    ).toBe(false);
  });
});
