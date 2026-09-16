import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Actor } from "../api/client";

export const ROLE_OPTIONS = [
  { value: "REQUESTER", label: "需求方", desc: "提交与查看本人 Case" },
  { value: "ACCOUNT_OPERATOR", label: "官方账号运营", desc: "运营阶段审核" },
  { value: "VISUAL_REVIEWER", label: "视觉审核", desc: "图片与素材审核" },
  {
    value: "COMPLIANCE_REVIEWER",
    label: "安全与合规审核",
    desc: "合规阶段审核",
  },
  { value: "MEDIA_MANAGER", label: "新媒体负责人", desc: "最终审批与排期" },
  { value: "SYSTEM_ADMINISTRATOR", label: "系统管理员", desc: "只读观察" },
] as const;

const STORAGE_KEY = "pr-review-actor";

const DEFAULT_ACTOR: Actor = {
  id: "usr_demo_requester",
  displayName: "演示用户",
  role: "REQUESTER",
};

function loadActor(): Actor {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Actor;
      if (parsed.id && parsed.displayName && parsed.role) return parsed;
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_ACTOR;
}

interface ActorContextValue {
  actor: Actor;
  setActor: (actor: Actor) => void;
}

const ActorContext = createContext<ActorContextValue>({
  actor: DEFAULT_ACTOR,
  setActor: () => undefined,
});

export function ActorProvider({ children }: { children: ReactNode }) {
  const [actor, setActorState] = useState<Actor>(loadActor);

  const setActor = useCallback((next: Actor) => {
    setActorState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // localStorage unavailable; keep in-memory only
    }
  }, []);

  const value = useMemo(() => ({ actor, setActor }), [actor, setActor]);
  return (
    <ActorContext.Provider value={value}>{children}</ActorContext.Provider>
  );
}

export function useActor(): ActorContextValue {
  return useContext(ActorContext);
}
