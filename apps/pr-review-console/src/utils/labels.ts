import type {
  ContentType,
  DimensionVerdict,
  FinalDecision,
  ReviewDimension,
  ReviewStage,
  RiskLevel,
  Severity,
} from "../api/types";

export const STAGE_LABELS: Record<ReviewStage, string> = {
  REQUESTER_SELF_CHECK: "需求方自检",
  OPERATOR_REVIEW: "运营审核",
  VISUAL_REVIEW: "视觉审核",
  COMPLIANCE_REVIEW: "合规审核",
  RISK_ROUTING: "风险路由",
  MEDIA_MANAGER_APPROVAL: "负责人审批",
  SCHEDULING: "待排期",
  COMPLETED: "已完成",
  REJECTED: "已拒绝",
  ESCALATED: "已升级",
  REVIEW_REQUIRED: "待人工审核",
};

export const STAGE_TONES: Record<
  ReviewStage,
  "neutral" | "info" | "warning" | "danger" | "success"
> = {
  REQUESTER_SELF_CHECK: "neutral",
  OPERATOR_REVIEW: "info",
  VISUAL_REVIEW: "info",
  COMPLIANCE_REVIEW: "info",
  RISK_ROUTING: "info",
  MEDIA_MANAGER_APPROVAL: "warning",
  SCHEDULING: "warning",
  COMPLETED: "success",
  REJECTED: "danger",
  ESCALATED: "danger",
  REVIEW_REQUIRED: "warning",
};

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  SOCIAL_POST: "社交媒体帖文",
  PRESS_RELEASE: "新闻稿",
  PRODUCT_LAUNCH: "产品发布",
  BRAND_CAMPAIGN: "品牌活动",
  EXTERNAL_RESPONSE: "对外回应",
  MULTIMODAL_POST: "图文内容",
};

export const PLATFORM_LABELS: Record<string, string> = {
  WEIBO: "微博",
  XIAOHONGSHU: "小红书",
  DOUYIN: "抖音",
  BILIBILI: "哔哩哔哩",
  COOLAPK: "酷安",
};

export const PLATFORMS = Object.keys(PLATFORM_LABELS);

export const DIMENSION_LABELS: Record<ReviewDimension, string> = {
  PUBLIC_RELATIONS: "公关与舆情",
  OPERATIONS: "运营与渠道",
  PRODUCT: "产品与事实",
  CUSTOMER: "客户与用户",
  COMPLIANCE_SAFETY: "合规与安全",
};

export const VERDICT_LABELS: Record<DimensionVerdict, string> = {
  PASS: "通过",
  WARN: "警示",
  BLOCK: "阻断",
  REVIEW_REQUIRED: "需人工",
};

export const DECISION_LABELS: Record<FinalDecision, string> = {
  PASS: "通过",
  REVISE: "建议修订",
  HUMAN_REVIEW: "人工审核",
  BLOCK: "阻断",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: "低风险",
  MEDIUM: "中风险",
  HIGH: "高风险",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
  CRITICAL: "严重",
};

export const ACTION_LABELS: Record<string, string> = {
  APPROVE: "通过",
  REVISE: "要求修订",
  REJECT: "拒绝",
  ESCALATE: "升级",
  SUBMIT: "提交",
  AUTO_ROUTE: "自动路由",
  SCHEDULE: "排期",
};

export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function riskTone(
  score: number,
): "success" | "warning" | "danger" | "neutral" {
  if (score >= 70) return "danger";
  if (score >= 40) return "warning";
  if (score >= 0) return "success";
  return "neutral";
}
