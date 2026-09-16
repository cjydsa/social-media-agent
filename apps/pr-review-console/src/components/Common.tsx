import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import {
  DECISION_LABELS,
  RISK_LABELS,
  SEVERITY_LABELS,
  STAGE_LABELS,
  STAGE_TONES,
  VERDICT_LABELS,
} from "../utils/labels";
import type {
  DimensionVerdict,
  FinalDecision,
  ReviewStage,
  RiskLevel,
  Severity,
} from "../api/types";

type Tone = "neutral" | "info" | "warning" | "danger" | "success" | "primary";

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function StageBadge({ stage }: { stage: ReviewStage }) {
  return <Badge tone={STAGE_TONES[stage]}>{STAGE_LABELS[stage]}</Badge>;
}

export function RiskBadge({ level }: { level: RiskLevel | null | undefined }) {
  if (!level) return <Badge tone="neutral">未知</Badge>;
  const tone =
    level === "HIGH" ? "danger" : level === "MEDIUM" ? "warning" : "success";
  return <Badge tone={tone}>{RISK_LABELS[level]}</Badge>;
}

export function DecisionBadge({
  decision,
}: {
  decision: FinalDecision | null | undefined;
}) {
  if (!decision) return <Badge tone="neutral">无结论</Badge>;
  const tone: Tone =
    decision === "PASS"
      ? "success"
      : decision === "REVISE"
        ? "warning"
        : decision === "BLOCK"
          ? "danger"
          : "info";
  return <Badge tone={tone}>{DECISION_LABELS[decision]}</Badge>;
}

export function VerdictBadge({ verdict }: { verdict: DimensionVerdict }) {
  const tone: Tone =
    verdict === "PASS"
      ? "success"
      : verdict === "WARN"
        ? "warning"
        : verdict === "BLOCK"
          ? "danger"
          : "info";
  return <Badge tone={tone}>{VERDICT_LABELS[verdict]}</Badge>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const tone: Tone =
    severity === "CRITICAL" || severity === "HIGH"
      ? "danger"
      : severity === "MEDIUM"
        ? "warning"
        : "neutral";
  return <Badge tone={tone}>{SEVERITY_LABELS[severity]}</Badge>;
}

export function Loading({ text = "加载中…" }: { text?: string }) {
  return (
    <div className="state-box">
      <div className="spinner" />
      {text}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state-box error">
      <div className="icon">⚠️</div>
      <div>{message}</div>
      {onRetry && (
        <button className="btn sm" style={{ marginTop: 12 }} onClick={onRetry}>
          重试
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon = "🗂️",
  text,
  hint,
}: {
  icon?: string;
  text: string;
  hint?: string;
}) {
  return (
    <div className="state-box">
      <div className="icon">{icon}</div>
      <div>{text}</div>
      {hint && <div style={{ fontSize: 12, marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

/* ---------- Toast ---------- */
interface ToastItem {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}

const ToastContext = createContext<
  (kind: ToastItem["kind"], text: string) => void
>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

let toastSeq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((kind: ToastItem["kind"], text: string) => {
    toastSeq += 1;
    const id = toastSeq;
    setItems((prev) => [...prev, { id, kind, text }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 3600);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {items.map((item) => (
          <div
            key={item.id}
            className={`toast ${item.kind === "error" ? "error" : item.kind === "success" ? "success" : ""}`}
          >
            {item.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
