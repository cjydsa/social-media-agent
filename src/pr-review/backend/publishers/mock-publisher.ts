import { PublishReceiptSchema, type PublishReceipt } from "../dto/schemas.js";
import type { PublishRequest, Publisher } from "./index.js";

export interface MockPublisherOptions {
  now?: () => string;
  idFactory?: () => string;
}

/**
 * Development publisher. It never talks to any real social account;
 * it only records scheduling intent and returns an auditable receipt.
 */
export class MockPublisher implements Publisher {
  readonly mode = "mock" as const;

  readonly #receipts = new Map<string, PublishReceipt>();
  readonly #options: Required<MockPublisherOptions>;
  #sequence = 0;

  constructor(options: MockPublisherOptions = {}) {
    this.#options = {
      now: options.now ?? (() => new Date().toISOString()),
      idFactory:
        options.idFactory ??
        (() => {
          this.#sequence += 1;
          return `receipt_${String(this.#sequence).padStart(6, "0")}`;
        }),
    };
  }

  async schedule(request: PublishRequest): Promise<PublishReceipt> {
    const existing = this.#receipts.get(request.idempotencyKey);
    if (existing) return existing;

    const receipt = PublishReceiptSchema.parse({
      receiptId: this.#options.idFactory(),
      caseId: request.caseId,
      version: request.version,
      scheduledAt: this.#options.now(),
      mode: "mock",
      note: "MockPublisher recorded scheduling intent only; no real publish occurred.",
    });
    this.#receipts.set(request.idempotencyKey, receipt);
    return receipt;
  }
}
