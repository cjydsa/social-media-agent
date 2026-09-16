import { describe, expect, it } from "@jest/globals";
import { MockPublisher } from "../../../src/pr-review/backend/publishers/mock-publisher.js";
import { PublishReceiptSchema } from "../../../src/pr-review/backend/dto/schemas.js";

describe("MockPublisher (BE-005)", () => {
  it("returns an auditable mock receipt without any real publish", async () => {
    const publisher = new MockPublisher({
      now: () => "2026-09-15T03:00:00.000Z",
    });
    const receipt = await publisher.schedule({
      caseId: "case_pub_001",
      version: 2,
      idempotencyKey: "pub-key-1",
      requestedBy: { id: "usr_mm", displayName: "MM", role: "MEDIA_MANAGER" },
      scheduledAt: "2026-09-15T03:00:00.000Z",
    });

    expect(() => PublishReceiptSchema.parse(receipt)).not.toThrow();
    expect(receipt.mode).toBe("mock");
    expect(receipt.caseId).toBe("case_pub_001");
    expect(receipt.version).toBe(2);
    expect(receipt.note).toContain("no real publish");
  });

  it("schedules only once per idempotency key", async () => {
    const publisher = new MockPublisher();
    const first = await publisher.schedule({
      caseId: "case_pub_002",
      version: 1,
      idempotencyKey: "pub-key-2",
      requestedBy: { id: "usr_mm", displayName: "MM", role: "MEDIA_MANAGER" },
      scheduledAt: new Date().toISOString(),
    });
    const second = await publisher.schedule({
      caseId: "case_pub_002",
      version: 1,
      idempotencyKey: "pub-key-2",
      requestedBy: { id: "usr_mm", displayName: "MM", role: "MEDIA_MANAGER" },
      scheduledAt: new Date().toISOString(),
    });
    expect(second.receiptId).toBe(first.receiptId);

    const third = await publisher.schedule({
      caseId: "case_pub_002",
      version: 1,
      idempotencyKey: "pub-key-3",
      requestedBy: { id: "usr_mm", displayName: "MM", role: "MEDIA_MANAGER" },
      scheduledAt: new Date().toISOString(),
    });
    expect(third.receiptId).not.toBe(first.receiptId);
  });
});
