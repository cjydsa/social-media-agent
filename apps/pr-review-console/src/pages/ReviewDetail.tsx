import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type {
  ContentVersionRecord,
  PublishReceipt,
  ReviewDetailResponse,
  ReviewHistoryResponse,
  ReviewIssue,
  ReviewStage,
} from "../api/types";
import { useActor } from "../context/ActorContext";
import { diffText } from "../utils/diff";
import {
  ACTION_LABELS,
  CONTENT_TYPE_LABELS,
  DIMENSION_LABELS,
  PLATFORM_LABELS,
  STAGE_LABELS,
  formatTime,
  riskTone,
} from "../utils/labels";
import {
  Badge,
  DecisionBadge,
  EmptyState,
  ErrorState,
  Loading,
  SeverityBadge,
  StageBadge,
  VerdictBadge,
  useToast,
} from "../components/Common";

const RISK_COLORS = {
  success: "#12805c",
  warning: "#b45309",
  danger: "#b91c1c",
  neutral: "#8a97ab",
};

type ActionKind = "APPROVE" | "REVISE" | "REJECT" | "ESCALATE" | "SCHEDULE";

const PIPELINE: ReviewStage[] = [
  "OPERATOR_REVIEW",
  "VISUAL_REVIEW",
  "COMPLIANCE_REVIEW",
  "MEDIA_MANAGER_APPROVAL",
  "SCHEDULING",
  "COMPLETED",
];

function collectIssues(detail: ReviewDetailResponse | null): ReviewIssue[] {
  const final = detail?.latestResult?.finalDecision;
  if (!final) return [];
  const map = new Map<string, ReviewIssue>();
  for (const dim of final.dimensionResults) {
    for (const issue of dim.issues) map.set(issue.id, issue);
  }
  for (const issue of final.blockingIssues) map.set(issue.id, issue);
  return [...map.values()];
}

function HighlightedContent({
  content,
  issues,
}: {
  content: string;
  issues: ReviewIssue[];
}) {
  const spans = useMemo(() => {
    const valid = issues
      .filter(
        (issue) =>
          issue.textSpan &&
          issue.textSpan.start >= 0 &&
          issue.textSpan.end > issue.textSpan.start &&
          issue.textSpan.end <= content.length,
      )
      .map((issue) => ({ ...issue.textSpan!, reason: issue.reason }))
      .sort((a, b) => a.start - b.start);
    // Drop overlaps: keep the first span in document order.
    const picked: typeof valid = [];
    let cursor = 0;
    for (const span of valid) {
      if (span.start >= cursor) {
        picked.push(span);
        cursor = span.end;
      }
    }
    return picked;
  }, [content, issues]);

  if (spans.length === 0) return <div className="content-view">{content}</div>;

  const parts: { text: string; mark?: string }[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start > cursor)
      parts.push({ text: content.slice(cursor, span.start) });
    parts.push({
      text: content.slice(span.start, span.end),
      mark: span.reason,
    });
    cursor = span.end;
  }
  if (cursor < content.length) parts.push({ text: content.slice(cursor) });

  return (
    <div className="content-view">
      {parts.map((part, index) =>
        part.mark ? (
          <mark key={index} title={part.mark}>
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </div>
  );
}

function RiskGauge({ score }: { score: number }) {
  const tone = riskTone(score);
  const color = RISK_COLORS[tone];
  const deg = Math.round((score / 100) * 360);
  return (
    <div
      className="gauge-ring"
      style={{
        background: `conic-gradient(${color} ${deg}deg, var(--neutral-soft) ${deg}deg)`,
      }}
    >
      <span className="value" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

function StageFlow({ stage }: { stage: ReviewStage }) {
  const currentIndex = PIPELINE.indexOf(stage);
  return (
    <div className="stage-flow">
      {PIPELINE.map((item, index) => (
        <span
          key={item}
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          <span
            className={`stage-node ${
              stage === "COMPLETED" || index < currentIndex
                ? "done"
                : index === currentIndex
                  ? "current"
                  : ""
            }`}
          >
            {STAGE_LABELS[item]}
          </span>
          {index < PIPELINE.length - 1 && (
            <span className="stage-arrow">→</span>
          )}
        </span>
      ))}
    </div>
  );
}

function ActionModal({
  kind,
  caseId,
  version,
  suggested,
  onClose,
  onDone,
}: {
  kind: ActionKind;
  caseId: string;
  version: number;
  suggested: string | null;
  onClose: () => void;
  onDone: (receipt: PublishReceipt | null) => void;
}) {
  const { actor } = useActor();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [revisedContent, setRevisedContent] = useState(suggested ?? "");
  const [target, setTarget] = useState("COMPLIANCE_REVIEWER");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titles: Record<ActionKind, string> = {
    APPROVE: "通过当前阶段",
    REVISE: "要求修订",
    REJECT: "拒绝 Case",
    ESCALATE: "升级处理",
    SCHEDULE: "模拟排期",
  };
  const descs: Record<ActionKind, string> = {
    APPROVE: "确认当前版本在本审核节点可继续流转。",
    REVISE: "创建不可变的新版本，AI 将自动重新审核。",
    REJECT: "终止当前 Case，不进入发布流程。",
    ESCALATE: "转交更高权限/专家角色处理。",
    SCHEDULE: "调用 MockPublisher 模拟排期（不会发生真实发布）。",
  };

  const valid =
    reason.trim().length > 0 &&
    (kind !== "REVISE" || revisedContent.trim().length > 0);

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (kind === "APPROVE")
        await api.act(actor, caseId, "approve", {
          expectedVersion: version,
          reason,
        });
      if (kind === "REJECT")
        await api.act(actor, caseId, "reject", {
          expectedVersion: version,
          reason,
        });
      if (kind === "REVISE")
        await api.revise(actor, caseId, {
          expectedVersion: version,
          reason,
          revisedContent: revisedContent.trim(),
        });
      if (kind === "ESCALATE")
        await api.escalate(actor, caseId, {
          expectedVersion: version,
          reason,
          escalationTarget: target,
        });
      if (kind === "SCHEDULE") {
        const res = await api.schedule(actor, caseId, {
          expectedVersion: version,
          reason,
        });
        toast("success", `已模拟排期：${res.receipt.receiptId}`);
        onDone(res.receipt);
        return;
      }
      toast("success", `${titles[kind]}成功`);
      onDone(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("版本已被他人变更，请关闭后刷新页面重试（不会静默覆盖）。");
      } else {
        setError(err instanceof Error ? err.message : "操作失败");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h3>{titles[kind]}</h3>
        <div className="desc">
          {descs[kind]}（版本 v{version}）
        </div>

        {kind === "REVISE" && (
          <div className="field">
            <label>
              修订后内容 <span className="required">*</span>
            </label>
            <textarea
              value={revisedContent}
              onChange={(event) => setRevisedContent(event.target.value)}
            />
          </div>
        )}

        {kind === "ESCALATE" && (
          <div className="field">
            <label>升级目标角色</label>
            <select
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            >
              <option value="COMPLIANCE_REVIEWER">安全与合规审核</option>
              <option value="MEDIA_MANAGER">新媒体负责人</option>
              <option value="LEGAL">法务专家</option>
            </select>
          </div>
        )}

        <div className="field">
          <label>
            原因说明 <span className="required">*</span>
          </label>
          <textarea
            style={{ minHeight: 90 }}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="必填：该动作将连同原因写入不可变审计日志"
          />
        </div>

        {error && (
          <div className="issue-item sev-HIGH">
            <div className="reason">{error}</div>
          </div>
        )}

        <div className="footer">
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button
            className={`btn ${kind === "REJECT" ? "danger" : kind === "APPROVE" || kind === "SCHEDULE" ? "success" : "primary"}`}
            disabled={!valid || submitting}
            onClick={submit}
          >
            {submitting ? "提交中…" : `确认${titles[kind]}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReviewDetail() {
  const { id = "" } = useParams();
  const { actor } = useActor();
  const navigate = useNavigate();
  const toast = useToast();

  const [detail, setDetail] = useState<ReviewDetailResponse | null>(null);
  const [history, setHistory] = useState<ReviewHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"review" | "versions" | "timeline">("review");
  const [modal, setModal] = useState<ActionKind | null>(null);
  const [receipt, setReceipt] = useState<PublishReceipt | null>(null);
  const [diffPair, setDiffPair] = useState<[number, number] | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([api.getReview(actor, id), api.getHistory(actor, id)])
      .then(([detailRes, historyRes]) => {
        setDetail(detailRes);
        setHistory(historyRes);
      })
      .catch((err: Error) => setError(err.message));
  }, [actor, id]);

  useEffect(load, [load]);

  const issues = useMemo(() => collectIssues(detail), [detail]);
  const final = detail?.latestResult?.finalDecision ?? null;
  const revisionSuggestion =
    final && final.revisionDirection.length > 0
      ? final.revisionDirection
      : null;

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!detail) return <Loading text="加载审核详情…" />;

  const { case: reviewCase, allowedActions } = detail;
  const decisionTone = final ? riskTone(final.overallRiskScore) : "neutral";

  const onActionDone = (newReceipt: PublishReceipt | null) => {
    setModal(null);
    if (newReceipt) setReceipt(newReceipt);
    load();
  };

  const selectedDiff = useMemo(() => {
    if (!history || !diffPair) return null;
    const [from, to] = diffPair;
    const vFrom = history.versions.find((v) => v.version === from);
    const vTo = history.versions.find((v) => v.version === to);
    if (!vFrom || !vTo) return null;
    return {
      from: vFrom,
      to: vTo,
      segments: diffText(vFrom.content, vTo.content),
    };
  }, [history, diffPair]);

  return (
    <div>
      <div className="detail-header">
        <div>
          <div className="title-group">
            <h2 className="mono">{reviewCase.id}</h2>
            <StageBadge stage={reviewCase.currentStage} />
            <Badge tone="neutral">
              {CONTENT_TYPE_LABELS[reviewCase.contentType]}
            </Badge>
            <Badge tone="neutral">v{reviewCase.version}</Badge>
          </div>
          <div className="meta-row">
            <span>提交人：{reviewCase.submitter.displayName}</span>
            <span>
              平台：
              {reviewCase.targetPlatform
                .map((p) => PLATFORM_LABELS[p] ?? p)
                .join(" / ")}
            </span>
            <span>创建：{formatTime(reviewCase.createdAt)}</span>
            <span>更新：{formatTime(reviewCase.updatedAt)}</span>
          </div>
        </div>
        <div className="action-bar">
          {allowedActions.includes("APPROVE") && (
            <button className="btn success" onClick={() => setModal("APPROVE")}>
              ✓ 通过
            </button>
          )}
          {allowedActions.includes("REVISE") && (
            <button className="btn primary" onClick={() => setModal("REVISE")}>
              ✎ 修订
            </button>
          )}
          {allowedActions.includes("ESCALATE") && (
            <button
              className="btn warning"
              onClick={() => setModal("ESCALATE")}
            >
              ⇧ 升级
            </button>
          )}
          {allowedActions.includes("REJECT") && (
            <button className="btn danger" onClick={() => setModal("REJECT")}>
              ✕ 拒绝
            </button>
          )}
          {allowedActions.includes("SCHEDULE") && (
            <button
              className="btn success"
              onClick={() => setModal("SCHEDULE")}
            >
              🗓 模拟排期
            </button>
          )}
          {allowedActions.length === 0 && (
            <Badge tone="neutral">当前身份在此阶段无可执行动作</Badge>
          )}
        </div>
      </div>

      <StageFlow stage={reviewCase.currentStage} />

      {receipt && (
        <div className="receipt-box" style={{ marginBottom: 16 }}>
          ✓ 已模拟排期 — 回执 <span className="mono">{receipt.receiptId}</span>
          ，时间 {formatTime(receipt.scheduledAt)}（{receipt.note}）
        </div>
      )}

      <div className="tabs">
        <button
          className={`tab ${tab === "review" ? "active" : ""}`}
          onClick={() => setTab("review")}
        >
          审核结论
        </button>
        <button
          className={`tab ${tab === "versions" ? "active" : ""}`}
          onClick={() => setTab("versions")}
        >
          版本历史（{history?.versions.length ?? "…"}）
        </button>
        <button
          className={`tab ${tab === "timeline" ? "active" : ""}`}
          onClick={() => setTab("timeline")}
        >
          审计时间线（{history?.actions.length ?? "…"}）
        </button>
      </div>

      {tab === "review" && (
        <div className="detail-grid">
          <div>
            <div className="card">
              <h3>
                当前内容（v{reviewCase.version}）
                {issues.some((i) => i.textSpan) && (
                  <span className="hint">黄色高亮为风险片段</span>
                )}
              </h3>
              <HighlightedContent
                content={reviewCase.currentContent}
                issues={issues}
              />
              {reviewCase.imageUrls.length > 0 && (
                <div className="image-gallery">
                  {reviewCase.imageUrls.map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt="素材"
                      onClick={() => window.open(url, "_blank")}
                    />
                  ))}
                </div>
              )}
              {reviewCase.originalContent !== reviewCase.currentContent && (
                <>
                  <div className="section-title">原始内容（v1）</div>
                  <div className="content-view" style={{ opacity: 0.75 }}>
                    {reviewCase.originalContent}
                  </div>
                </>
              )}
            </div>

            <div className="card">
              <h3>风险问题（{issues.length}）</h3>
              {issues.length === 0 && (
                <div className="empty-hint">未发现实质风险问题</div>
              )}
              {issues.map((issue) => (
                <div
                  className={`issue-item sev-${issue.severity}`}
                  key={issue.id}
                >
                  <div className="head">
                    <SeverityBadge severity={issue.severity} />
                    <Badge tone="primary">{issue.category}</Badge>
                  </div>
                  <div className="reason">{issue.reason}</div>
                  {issue.textSpan && (
                    <div className="quote">“{issue.textSpan.quote}”</div>
                  )}
                  {issue.suggestion && (
                    <div className="suggestion">
                      💡 建议：{issue.suggestion}
                    </div>
                  )}
                </div>
              ))}

              {revisionSuggestion && (
                <>
                  <div className="section-title">修订方向</div>
                  {revisionSuggestion.map((item, index) => (
                    <div className="evidence-item" key={index}>
                      {item}
                    </div>
                  ))}
                </>
              )}
            </div>

            {history && history.evidenceSnapshots.length > 0 && (
              <div className="card">
                <h3>证据快照</h3>
                {history.evidenceSnapshots
                  .flatMap((snapshot) => snapshot.evidenceItems)
                  .slice(0, 12)
                  .map((item) => (
                    <div className="evidence-item" key={item.id}>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <Badge tone="neutral">{item.sourceType}</Badge>
                        <strong>{item.title}</strong>
                        {item.score !== null && (
                          <span
                            style={{ fontSize: 11, color: "var(--text-muted)" }}
                          >
                            相关度 {(item.score * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      <div
                        style={{ marginTop: 4, color: "var(--text-secondary)" }}
                      >
                        {item.content}
                      </div>
                      <div className="src">{item.source}</div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div>
            <div className="card">
              <h3>AI 最终结论</h3>
              {!final && (
                <div className="empty-hint">
                  {detail.latestResult?.failures?.length
                    ? `审核执行失败（${detail.latestResult.failures[0].code}），已按安全策略进入人工。`
                    : "暂无审核结果"}
                </div>
              )}
              {final && (
                <>
                  <div className="risk-gauge">
                    <RiskGauge score={final.overallRiskScore} />
                    <div>
                      <DecisionBadge decision={final.decision} />
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          marginTop: 6,
                        }}
                      >
                        置信度 {(final.confidence * 100).toFixed(0)}%
                      </div>
                      <div
                        style={{ fontSize: 12, color: "var(--text-secondary)" }}
                      >
                        可发布：{final.publishable ? "是" : "否"}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, marginTop: 12, lineHeight: 1.7 }}>
                    {final.summary}
                  </div>
                  {final.judgeReason && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        marginTop: 8,
                      }}
                    >
                      判定依据：{final.judgeReason}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      marginTop: 8,
                    }}
                  >
                    证据覆盖率{" "}
                    {(final.evidenceCoverage.coverageScore * 100).toFixed(0)}%
                    {final.evidenceCoverage.missingSources.length > 0 &&
                      `（缺失：${final.evidenceCoverage.missingSources.join("、")}）`}
                  </div>
                </>
              )}
            </div>

            <div className="card">
              <h3>五维风险评分</h3>
              {!final && <div className="empty-hint">暂无维度结果</div>}
              {final?.dimensionResults.map((dim) => {
                const tone = riskTone(dim.riskScore);
                return (
                  <div className="dim-row" key={dim.dimension}>
                    <span className="name">
                      {DIMENSION_LABELS[dim.dimension]}
                    </span>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${dim.riskScore}%`,
                          background: RISK_COLORS[tone],
                        }}
                      />
                    </div>
                    <span
                      className="score"
                      style={{ color: RISK_COLORS[tone] }}
                    >
                      {dim.riskScore}
                    </span>
                    <VerdictBadge verdict={dim.verdict} />
                  </div>
                );
              })}
              {final && (
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-muted)",
                    marginTop: 10,
                  }}
                >
                  评分为 0–100 风险分，越高风险越大；各维度结论由独立 Specialist
                  Agent 输出。
                </div>
              )}
            </div>

            {detail.latestResult?.judgeRecommendation && (
              <div className="card">
                <h3>Judge 建议</h3>
                <div style={{ fontSize: 12.5, lineHeight: 1.8 }}>
                  {detail.latestResult.judgeRecommendation.topRisks.map(
                    (risk, i) => (
                      <div key={i}>• {risk}</div>
                    ),
                  )}
                  {detail.latestResult.judgeRecommendation.topRisks.length ===
                    0 && <div className="empty-hint">无突出风险</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "versions" && history && (
        <div className="detail-grid">
          <div className="card">
            <h3>不可变版本（修改只增不改）</h3>
            <div className="version-list">
              {history.versions.map((version) => (
                <div
                  key={version.versionId}
                  className={`version-item ${diffPair?.includes(version.version) ? "selected" : ""}`}
                  onClick={() => {
                    if (!diffPair) {
                      setDiffPair([version.version, version.version]);
                      return;
                    }
                    const [a] = diffPair;
                    setDiffPair(
                      a === version.version
                        ? [version.version, version.version]
                        : [
                            Math.min(a, version.version),
                            Math.max(a, version.version),
                          ],
                    );
                  }}
                >
                  <div
                    style={{ display: "flex", gap: 10, alignItems: "center" }}
                  >
                    <Badge
                      tone={
                        version.version === reviewCase.version
                          ? "primary"
                          : "neutral"
                      }
                    >
                      v{version.version}
                    </Badge>
                    <span
                      style={{ fontSize: 12, color: "var(--text-secondary)" }}
                    >
                      {version.createdBy.displayName} ·{" "}
                      {formatTime(version.createdAt)}
                    </span>
                  </div>
                  <div
                    className="snippet"
                    style={{ marginTop: 6, fontSize: 12.5 }}
                  >
                    {version.content}
                  </div>
                </div>
              ))}
            </div>
            <div className="empty-hint">点击两个版本进行对比</div>
          </div>

          <div className="card">
            <h3>版本对比</h3>
            {!selectedDiff && <EmptyState text="选择两个版本查看差异" />}
            {selectedDiff && (
              <>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginBottom: 10,
                  }}
                >
                  v{selectedDiff.from.version} → v{selectedDiff.to.version}（
                  <span style={{ color: "var(--danger-strong)" }}>删除</span> /{" "}
                  <span style={{ color: "var(--success)" }}>新增</span>）
                </div>
                <div className="diff-view">
                  {selectedDiff.segments.map((segment, index) => (
                    <div key={index} className={`diff-line ${segment.kind}`}>
                      {segment.text}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "timeline" && history && (
        <div className="card">
          <h3>审计时间线（append-only）</h3>
          {history.actions.length === 0 && <EmptyState text="暂无审计记录" />}
          <div className="timeline">
            {[...history.actions].reverse().map((record) => (
              <div className="timeline-item" key={record.actionId}>
                <div className="head">
                  <Badge tone="primary">
                    {ACTION_LABELS[record.action.action] ??
                      record.action.action}
                  </Badge>
                  <span style={{ fontSize: 13 }}>
                    {record.action.actor.displayName}
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                      （{record.action.actor.role}）
                    </span>
                  </span>
                  {record.action.fromVersion !== null && (
                    <span
                      className="mono"
                      style={{ fontSize: 11, color: "var(--text-muted)" }}
                    >
                      v{record.action.fromVersion} → v{record.action.toVersion}
                    </span>
                  )}
                </div>
                <div className="reason">{record.action.reason}</div>
                <div className="time">
                  {formatTime(record.action.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <button className="btn ghost" onClick={() => navigate("/queue")}>
          ← 返回队列
        </button>
      </div>

      {modal && (
        <ActionModal
          kind={modal}
          caseId={reviewCase.id}
          version={reviewCase.version}
          suggested={null}
          onClose={() => setModal(null)}
          onDone={onActionDone}
        />
      )}
    </div>
  );
}
