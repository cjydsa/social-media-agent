import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useActor } from "../context/ActorContext";
import { EmptyState, ErrorState, Loading } from "../components/Common";

const METRIC_DEFS = [
  { name: "Macro-F1", desc: "对 LOW/MEDIUM/HIGH 分别计算 F1 后算术平均" },
  { name: "High-risk Recall", desc: "正确预测 HIGH / 实际 HIGH" },
  {
    name: "High-risk False Pass Rate",
    desc: "实际 HIGH 且系统给出可自动通过 / 实际 HIGH",
  },
  {
    name: "Manual Review Rate",
    desc: "进入任一人工审核的 Case / 已完成路由 Case",
  },
  {
    name: "Auto Approval Rate",
    desc: "无人工动作且按策略自动批准的 Case / 已完成路由 Case",
  },
  {
    name: "Revision Rate",
    desc: "发生至少一次 revise 的 Case / 进入审核的 Case",
  },
  {
    name: "Schema Parse Success Rate",
    desc: "首次模型输出通过 schema validation 的调用 / 总调用",
  },
  {
    name: "P50 / P95 Latency",
    desc: "Case 或 reviewer latency 分布的第 50/95 百分位",
  },
  {
    name: "平均 Token 使用量",
    desc: "所有模型 input+output tokens / 已评估 Case",
  },
  { name: "每 Case 推理成本", desc: "模型调用折算成本总和 / 已评估 Case" },
  {
    name: "Human Override Rate",
    desc: "人工最终决定与自动建议不同的 Case / 有自动建议且经人工决定的 Case",
  },
];

export function Evaluation() {
  const { actor } = useActor();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; latestRun: unknown | null }
  >({ kind: "loading" });

  const load = () => {
    setState({ kind: "loading" });
    api
      .getLatestEvaluation(actor)
      .then((res) => setState({ kind: "ready", latestRun: res.latestRun }))
      .catch((err: Error) => setState({ kind: "error", message: err.message }));
  };

  useEffect(load, [actor]);

  return (
    <div style={{ maxWidth: 960 }}>
      <div className="topbar" style={{ marginBottom: 16 }}>
        <div>
          <h2>评估看板</h2>
          <div className="subtitle">
            仅展示真实已完成的 benchmark
            运行结果；无运行时显式标记「未计算」，不展示预置指标
          </div>
        </div>
      </div>

      <div className="card">
        <h3>最新评估运行</h3>
        {state.kind === "loading" && <Loading />}
        {state.kind === "error" && (
          <ErrorState message={state.message} onRetry={load} />
        )}
        {state.kind === "ready" && state.latestRun === null && (
          <EmptyState
            icon="🧪"
            text="未计算：当前没有已完成的 benchmark 运行"
            hint="Benchmark v1（81 条 synthetic 样本）已就绪；运行评测后此处将展示数据集版本、样本数与真实指标"
          />
        )}
        {state.kind === "ready" && state.latestRun !== null && (
          <pre className="content-view" style={{ fontSize: 12 }}>
            {JSON.stringify(state.latestRun, null, 2)}
          </pre>
        )}
      </div>

      <div className="card">
        <h3>指标口径（PRD 第 9 节）</h3>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>指标</th>
                <th>计算方式</th>
              </tr>
            </thead>
            <tbody>
              {METRIC_DEFS.map((metric) => (
                <tr key={metric.name}>
                  <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                    {metric.name}
                  </td>
                  <td style={{ color: "var(--text-secondary)" }}>
                    {metric.desc}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
