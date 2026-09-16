import type { PublishReceipt } from "../dto/schemas.js";

export interface PublishRequest {
  caseId: string;
  version: number;
  idempotencyKey: string;
  requestedBy: { id: string; displayName: string; role: string };
  scheduledAt: string;
}

export interface Publisher {
  readonly mode: "mock";
  schedule(request: PublishRequest): Promise<PublishReceipt>;
}

export * from "./mock-publisher.js";
