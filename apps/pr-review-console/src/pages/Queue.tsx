import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { ReviewCase, ReviewStage, RiskLevel } from "../api/types";
import { useActor } from "../context/ActorContext";
import {
  CONTENT_TYPE_LABELS,
  PLATFORM_LABELS,
  STAGE_LABELS,
  formatTime,
} from "../utils/labels";
import {
  EmptyState,
  ErrorState,
  Loading,
  StageBadge,
} from "../components/Common";

const STAGE_FILTERS: (ReviewStage | "")[] = [
  "",
  "REVIEW_REQUIRED",
  "OPERATOR_REVIEW",
  "VISUAL_REVIEW",
  "COMPLIANCE_REVIEW",
  "MEDIA_MANAGER_APPROVAL",
  "SCHEDULING",
  "COMPLETED",
  "REJECTED",
  "ESCALATED",
];

export function Queue() {
  const { actor } = useActor();
  const navigate = useNavigate();
  const [stage, setStage] = useState<ReviewStage | "">("");
  const [riskLevel, setRiskLevel] = useState<RiskLevel | "">("");
  const [keyword, setKeyword] = useState("");
  const [cases, setCases] = useState<ReviewCase[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = (cursor: string | null = null) => {
    setLoading(true);
    setError(null);
    api
      .listReviews(actor, {
        stage: stage || undefined,
        riskLevel: riskLevel || undefined,
        limit: 20,
        cursor,
      })
      .then((res) => {
        setCases(res.data);
        setNextCursor(res.page.nextCursor);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setCursorStack([null]);
    load(null);
  }, [actor, stage, riskLevel]);

  const filtered = useMemo(() => {
    if (!cases) return [];
    const kw = keyword.trim().toLowerCase();
    if (!kw) return cases;
    return cases.filter(
      (item) =>
        item.currentContent.toLowerCase().includes(kw) ||
        item.id.toLowerCase().includes(kw) ||
        item.submitter.displayName.toLowerCase().includes(kw),
    );
  }, [cases, keyword]);

  const goNext = () => {
    if (!nextCursor) return;
    setCursorStack((prev) => [...prev, nextCursor]);
    load(nextCursor);
  };

  const goPrev = () => {
    setCursorStack((prev) => {
      const next = prev.slice(0, -1);
      load(next[next.length - 1] ?? null);
      return next.length === 0 ? [null] : next;
    });
  };

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 16 }}>
        <div>
          <h2>审核队列</h2>
          <div className="subtitle">按阶段、风险与关键字筛选 Case</div>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as ReviewStage | "")}
          >
            {STAGE_FILTERS.map((item) => (
              <option key={item || "all"} value={item}>
                {item ? STAGE_LABELS[item] : "全部阶段"}
              </option>
            ))}
          </select>
          <select
            value={riskLevel}
            onChange={(e) => setRiskLevel(e.target.value as RiskLevel | "")}
          >
            <option value="">全部风险</option>
            <option value="LOW">低风险</option>
            <option value="MEDIUM">中风险</option>
            <option value="HIGH">高风险</option>
          </select>
          <input
            type="text"
            placeholder="搜索内容 / Case ID / 提交人"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ minWidth: 220 }}
          />
          <div className="spacer" />
          <button
            className="btn sm"
            onClick={() => load(cursorStack[cursorStack.length - 1] ?? null)}
          >
            刷新
          </button>
        </div>

        {error && <ErrorState message={error} onRetry={() => load(null)} />}
        {!error && loading && <Loading />}
        {!error && !loading && filtered.length === 0 && (
          <EmptyState
            text="没有符合条件的 Case"
            hint="调整筛选条件，或前往「提交审核」创建新 Case"
          />
        )}
        {!error && !loading && filtered.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>内容摘要</th>
                  <th>类型</th>
                  <th>平台</th>
                  <th>阶段</th>
                  <th>版本</th>
                  <th>提交人</th>
                  <th>更新时间</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="clickable"
                    onClick={() => navigate(`/reviews/${item.id}`)}
                  >
                    <td className="mono">{item.id}</td>
                    <td>
                      <span className="snippet">{item.currentContent}</span>
                      {item.imageUrls.length > 0 && (
                        <span title="含图片素材" style={{ marginLeft: 6 }}>
                          🖼️
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="badge neutral">
                        {CONTENT_TYPE_LABELS[item.contentType]}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                      {item.targetPlatform
                        .map((p) => PLATFORM_LABELS[p] ?? p)
                        .join(" / ")}
                    </td>
                    <td>
                      <StageBadge stage={item.currentStage} />
                    </td>
                    <td className="mono">v{item.version}</td>
                    <td style={{ fontSize: 12.5 }}>
                      {item.submitter.displayName}
                    </td>
                    <td
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatTime(item.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination">
          <button
            className="btn sm"
            disabled={cursorStack.length <= 1}
            onClick={goPrev}
          >
            ← 上一页
          </button>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            第 {cursorStack.length} 页
          </span>
          <button className="btn sm" disabled={!nextCursor} onClick={goNext}>
            下一页 →
          </button>
        </div>
      </div>
    </div>
  );
}
