import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { ReviewCase, ReviewStage } from "../api/types";
import { useActor } from "../context/ActorContext";
import { CONTENT_TYPE_LABELS, STAGE_LABELS, formatTime } from "../utils/labels";
import {
  EmptyState,
  ErrorState,
  Loading,
  StageBadge,
} from "../components/Common";

const STAGE_ORDER: ReviewStage[] = [
  "REQUESTER_SELF_CHECK",
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

const HUMAN_STAGES: ReviewStage[] = [
  "REVIEW_REQUIRED",
  "OPERATOR_REVIEW",
  "VISUAL_REVIEW",
  "COMPLIANCE_REVIEW",
  "MEDIA_MANAGER_APPROVAL",
];

export function Dashboard() {
  const { actor } = useActor();
  const navigate = useNavigate();
  const [cases, setCases] = useState<ReviewCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api
      .listReviews(actor, { limit: 100 })
      .then((res) => setCases(res.data))
      .catch((err: Error) => setError(err.message));
  };

  useEffect(load, [actor]);

  const stats = useMemo(() => {
    if (!cases) return null;
    const byStage = new Map<ReviewStage, number>();
    for (const item of cases) {
      byStage.set(item.currentStage, (byStage.get(item.currentStage) ?? 0) + 1);
    }
    const pendingHuman = HUMAN_STAGES.reduce(
      (sum, stage) => sum + (byStage.get(stage) ?? 0),
      0,
    );
    return {
      total: cases.length,
      pendingHuman,
      scheduling: byStage.get("SCHEDULING") ?? 0,
      completed: byStage.get("COMPLETED") ?? 0,
      rejected: byStage.get("REJECTED") ?? 0,
      byStage,
    };
  }, [cases]);

  const recent = useMemo(
    () =>
      cases
        ? [...cases]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, 8)
        : [],
    [cases],
  );

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!cases || !stats) return <Loading />;

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 16 }}>
        <div>
          <h2>工作台</h2>
          <div className="subtitle">
            公关内容审核总览（数据来自 Backend API 实时统计）
          </div>
        </div>
        <Link to="/submit" className="btn primary">
          ✏️ 提交新审核
        </Link>
      </div>

      <div className="grid cols-4">
        <div
          className="stat-card"
          style={{ ["--accent" as string]: "#3457d5" }}
        >
          <div className="num">{stats.total}</div>
          <div className="label">全部 Case</div>
        </div>
        <div
          className="stat-card"
          style={{ ["--accent" as string]: "#b45309" }}
        >
          <div className="num">{stats.pendingHuman}</div>
          <div className="label">待人工处理</div>
        </div>
        <div
          className="stat-card"
          style={{ ["--accent" as string]: "#0369a1" }}
        >
          <div className="num">{stats.scheduling}</div>
          <div className="label">待排期</div>
        </div>
        <div
          className="stat-card"
          style={{ ["--accent" as string]: "#12805c" }}
        >
          <div className="num">{stats.completed}</div>
          <div className="label">已完成</div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>阶段分布</h3>
          {stats.total === 0 ? (
            <div className="empty-hint">暂无数据</div>
          ) : (
            STAGE_ORDER.map((stage) => {
              const count = stats.byStage.get(stage) ?? 0;
              if (count === 0) return null;
              const pct = Math.round((count / stats.total) * 100);
              return (
                <div className="dim-row" key={stage}>
                  <span className="name" style={{ width: 96 }}>
                    {STAGE_LABELS[stage]}
                  </span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${pct}%`,
                        background:
                          stage === "COMPLETED"
                            ? "#12805c"
                            : stage === "REJECTED" || stage === "ESCALATED"
                              ? "#b91c1c"
                              : stage === "SCHEDULING"
                                ? "#b45309"
                                : "#3457d5",
                      }}
                    />
                  </div>
                  <span className="score">{count}</span>
                </div>
              );
            })
          )}
        </div>

        <div className="card">
          <h3>
            最近更新
            <Link to="/queue" className="hint" style={{ marginLeft: "auto" }}>
              查看全部 →
            </Link>
          </h3>
          {recent.length === 0 ? (
            <EmptyState
              text="还没有审核 Case"
              hint="点击右上角「提交新审核」创建第一个"
            />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <tbody>
                  {recent.map((item) => (
                    <tr
                      key={item.id}
                      className="clickable"
                      onClick={() => navigate(`/reviews/${item.id}`)}
                    >
                      <td>
                        <span className="snippet">
                          {item.currentContent.slice(0, 60)}
                        </span>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span className="badge neutral">
                          {CONTENT_TYPE_LABELS[item.contentType]}
                        </span>
                      </td>
                      <td>
                        <StageBadge stage={item.currentStage} />
                      </td>
                      <td
                        style={{
                          color: "var(--text-muted)",
                          fontSize: 12,
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
        </div>
      </div>
    </div>
  );
}
