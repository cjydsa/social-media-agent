import { z } from "zod";

export const NonBlankStringSchema = z.string().trim().min(1);
export const NonBlankIdSchema = NonBlankStringSchema;
export const IsoTimestampSchema = z.iso.datetime({ offset: true });
export const PositiveVersionSchema = z.number().int().min(1);
export const NonNegativeIntegerSchema = z.number().int().min(0);
export const UnitIntervalSchema = z.number().min(0).max(1);
export const JsonValueSchema = z.json();

export type JsonValue = z.infer<typeof JsonValueSchema>;

export const ContentTypeSchema = z.enum([
  "SOCIAL_POST",
  "PRESS_RELEASE",
  "PRODUCT_LAUNCH",
  "BRAND_CAMPAIGN",
  "EXTERNAL_RESPONSE",
  "MULTIMODAL_POST",
]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

export const ReviewDecisionSchema = z.enum([
  "APPROVE",
  "REVISE",
  "REJECT",
  "ESCALATE",
  "REVIEW_REQUIRED",
]);
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

export const RiskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const IssueCategorySchema = z.enum([
  "FACT",
  "BRAND",
  "COMPLIANCE",
  "REPUTATION",
  "VISUAL",
  "BRAND_VOICE",
  "PUBLIC_SENTIMENT",
  "CRISIS_RESPONSE",
  "RESPONSIBILITY_ATTRIBUTION",
  "COMPETITOR_ATTACK",
  "CONTEXTUAL_MISINTERPRETATION",
  "PLATFORM_SUITABILITY",
  "ACCOUNT_POSITIONING",
  "CAMPAIGN_CONSISTENCY",
  "PLATFORM_RULE",
  "CTA_URL_HASHTAG",
  "ASSET_COMPLETENESS",
  "CROSS_PLATFORM_ADAPTATION",
  "PUBLISHING_CONTEXT",
  "PRODUCT_NAME",
  "PRODUCT_SPECIFICATION",
  "PRODUCT_CAPABILITY",
  "PRODUCT_PRICE",
  "PRODUCT_AVAILABILITY",
  "PRODUCT_VERSION",
  "PERFORMANCE_CLAIM",
  "DATA_CLAIM",
  "COMPARATIVE_CLAIM",
  "THIRD_PARTY_CITATION",
  "UNSUPPORTED_PRODUCT_CLAIM",
  "CUSTOMER_EXPECTATION",
  "SERVICE_COMMITMENT",
  "AFTER_SALES_COMMITMENT",
  "COMPENSATION_IMPLICATION",
  "CUSTOMER_COMPLAINT_SENSITIVITY",
  "KNOWN_PRODUCT_ISSUE",
  "AUDIENCE_OFFENSE",
  "EXPERIENCE_GAP",
  "COMPLAINT_ESCALATION",
  "ADVERTISING_COMPLIANCE",
  "ABSOLUTE_MARKETING_CLAIM",
  "MISLEADING_CLAIM",
  "PRIVACY",
  "CONFIDENTIAL_INFORMATION",
  "PERSONAL_INFORMATION",
  "INTELLECTUAL_PROPERTY",
  "SENSITIVE_CONTENT",
  "ILLEGAL_HARMFUL_CONTENT",
  "PLATFORM_CONTENT_SAFETY",
  "ADVERTISEMENT_IDENTIFICATION",
]);
export type IssueCategory = z.infer<typeof IssueCategorySchema>;

export const SeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const ReviewerTypeSchema = z.enum([
  "RULE",
  "LLM",
  "VISUAL",
  "HUMAN",
  "AGGREGATOR",
]);
export type ReviewerType = z.infer<typeof ReviewerTypeSchema>;

export const ReviewActionTypeSchema = z.enum([
  "APPROVE",
  "REVISE",
  "REJECT",
  "ESCALATE",
  "SUBMIT",
  "AUTO_ROUTE",
  "SCHEDULE",
]);
export type ReviewActionType = z.infer<typeof ReviewActionTypeSchema>;

export const ReviewStageSchema = z.enum([
  "REQUESTER_SELF_CHECK",
  "OPERATOR_REVIEW",
  "VISUAL_REVIEW",
  "COMPLIANCE_REVIEW",
  "RISK_ROUTING",
  "MEDIA_MANAGER_APPROVAL",
  "SCHEDULING",
  "COMPLETED",
  "REJECTED",
  "ESCALATED",
  "REVIEW_REQUIRED",
]);
export type ReviewStage = z.infer<typeof ReviewStageSchema>;
