import { NavLink, Outlet } from "react-router-dom";
import { ROLE_OPTIONS, useActor } from "../context/ActorContext";

const NAV = [
  { to: "/", label: "工作台", icon: "📊", end: true },
  { to: "/submit", label: "提交审核", icon: "✏️", end: false },
  { to: "/queue", label: "审核队列", icon: "📋", end: false },
  { to: "/evaluation", label: "评估看板", icon: "📈", end: false },
];

export function Layout() {
  const { actor, setActor } = useActor();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">🛡️</div>
          <h1>
            公关内容智能审核
            <small>PR Review Console</small>
          </h1>
        </div>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              isActive ? "nav-item active" : "nav-item"
            }
          >
            <span className="icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
        <div className="sidebar-footer">
          五维 AI 多智能体审核
          <br />
          公关舆情 · 运营渠道 · 产品事实
          <br />
          客户用户 · 合规安全
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <div />
          <div className="actor-switch">
            <label>当前身份</label>
            <select
              value={actor.role}
              onChange={(event) =>
                setActor({ ...actor, role: event.target.value })
              }
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <input
              value={actor.displayName}
              onChange={(event) =>
                setActor({
                  ...actor,
                  displayName: event.target.value || "演示用户",
                })
              }
              placeholder="显示名"
            />
            <span className="dev-badge">开发模式 dev-header</span>
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
