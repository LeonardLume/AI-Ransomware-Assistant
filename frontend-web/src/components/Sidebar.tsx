import {
  Activity,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  RadioTower,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ChatResponse, ProviderStatusResponse, SessionPath, SessionSummary } from "../types/api";
import { t, type UiLanguage } from "../utils/i18n";
import type { AppView } from "./Layout";
import { Button } from "./ui";
import { cn } from "./ui-helpers";

export default function Sidebar({
  sessions,
  activeSessionId,
  activeView,
  collapsed,
  language,
  backendOnline,
  providerStatus,
  lastResponse,
  open,
  onClose,
  onToggleCollapsed,
  onViewChange,
  onSelectSession,
  onDeleteSession,
}: {
  sessions: SessionSummary[];
  activeSessionId?: string | null;
  activeView: AppView;
  collapsed: boolean;
  language: UiLanguage;
  backendOnline: boolean;
  providerStatus?: ProviderStatusResponse | null;
  lastResponse?: ChatResponse | null;
  open: boolean;
  onClose: () => void;
  onToggleCollapsed: () => void;
  onViewChange: (view: AppView) => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}) {
  const provider = providerStatus?.provider || lastResponse?.provider || "unknown";
  const fallbackUsed = providerStatus
    ? providerStatus.provider === "fallback"
    : (lastResponse?.used_fallback ?? provider === "fallback");
  const [pathFilter, setPathFilter] = useState<"all" | SessionPath>("all");
  const visibleSessions = useMemo(
    () =>
      pathFilter === "all"
        ? sessions
        : sessions.filter((session) => session.path === pathFilter),
    [pathFilter, sessions],
  );
  const emptySessionsText = sessions.length
    ? "No sessions match this filter."
    : language === "ru"
      ? "No local sessions yet."
      : language === "en"
        ? "No local sessions yet."
        : "Kohalikke sessioone veel ei ole.";

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-white/10 bg-[#0b0b0d] px-3 py-4 text-slate-100 shadow-[28px_0_80px_rgba(0,0,0,0.48)] transition-[width,transform] lg:translate-x-0",
          collapsed && "lg:w-[72px] lg:px-2",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className={cn("mb-3 flex items-center justify-between gap-2 px-1", collapsed && "lg:justify-center lg:px-0")}>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-9 w-9 px-0 lg:hidden"
            aria-label="Close sessions"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onToggleCollapsed}
            className="hidden h-9 w-9 px-0 lg:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

        <button
          type="button"
          onClick={() => {
            onViewChange("home");
            onClose();
          }}
          className={cn(
            "mb-3 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
            collapsed && "lg:justify-center lg:px-0",
            activeView === "home"
              ? "bg-white/[0.16] text-white"
              : "text-slate-300 hover:bg-white/[0.08] hover:text-white",
          )}
          title={t(language, "home")}
        >
          <Home className="h-4 w-4" />
          <span className={cn(collapsed && "lg:hidden")}>{t(language, "home")}</span>
        </button>

        <section className={cn("mt-4 flex min-h-0 flex-1 flex-col", collapsed && "lg:hidden")}>
          <div className="mb-2 px-1 text-xs font-semibold uppercase text-slate-500">
            {t(language, "recentSessions")}
          </div>
          {sessions.length ? (
            <div className="mb-2 grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/[0.025] p-1">
              {[
                { id: "all", label: "All" },
                { id: "recovery-proof", label: "Proof" },
                { id: "questionnaire", label: "Questions" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPathFilter(item.id as "all" | SessionPath)}
                  className={cn(
                    "rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors",
                    pathFilter === item.id
                      ? "bg-white/[0.14] text-white"
                      : "text-slate-500 hover:bg-white/[0.07] hover:text-slate-200",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="scrollbar-slim min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {visibleSessions.length ? (
              visibleSessions.map((session) => {
                const active = session.id === activeSessionId;
                return (
                  <div
                    key={session.id}
                    className={cn(
                      "group rounded-xl border px-2.5 py-2.5 transition-all duration-200 ease-out",
                      active
                        ? "border-white/10 bg-white/[0.07] shadow-[0_10px_28px_rgba(0,0,0,0.18)]"
                        : "border-transparent bg-transparent hover:bg-white/[0.05]",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectSession(session.id);
                          onClose();
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate text-xs font-medium text-slate-100">
                          {session.title}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          <span>{new Date(session.updatedAt).toLocaleDateString()}</span>
                          {session.completionRate !== undefined ? (
                            <span>{session.completionRate}%</span>
                          ) : null}
                          <SessionPathBadge path={session.path} />
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSession(session.id)}
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 opacity-0 transition-all duration-200 hover:bg-white/10 hover:text-slate-200 group-hover:opacity-100"
                        aria-label="Delete local session"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 p-3 text-xs leading-5 text-slate-500">
                {emptySessionsText}
                <span className="hidden">
                {language === "ru"
                  ? "Локальных сессий пока нет."
                  : language === "en"
                    ? "No local sessions yet."
                    : "Kohalikke sessioone veel ei ole."}
                </span>
              </div>
            )}
          </div>
        </section>

        <div className={cn("mt-3 space-y-1", collapsed && "lg:hidden")}>
          <StatusCard
            icon={Activity}
            label={t(language, "backendStatus")}
            value={backendOnline ? t(language, "online") : t(language, "offline")}
            tone={backendOnline ? "success" : "danger"}
          />
          <StatusCard
            icon={RadioTower}
            label={t(language, "providerStatus")}
            value={provider}
            tone="info"
          />
          <StatusCard
            icon={Sparkles}
            label={t(language, "fallbackMode")}
            value={String(Boolean(fallbackUsed))}
            tone={fallbackUsed ? "warning" : "success"}
          />
        </div>
        <div className="mb-1 mt-5 h-px w-full rounded-full bg-white/[0.14]" aria-hidden="true" />
      </aside>
    </>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone: "success" | "danger" | "info" | "warning";
}) {
  return (
    <div className="rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:border-white/10 hover:bg-white/[0.035]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="truncate text-xs text-slate-500">{label}</span>
        </div>
        <span
          className={cn(
            "shrink-0 text-[11px] font-semibold",
            tone === "success" && "text-emerald-300",
            tone === "danger" && "text-red-300",
            tone === "info" && "text-sky-300",
            tone === "warning" && "text-amber-300",
          )}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

function SessionPathBadge({ path }: { path?: SessionPath }) {
  if (!path) {
    return null;
  }
  const proof = path === "recovery-proof";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none",
        proof
          ? "border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-100"
          : "border-violet-300/20 bg-violet-300/[0.08] text-violet-100",
      )}
    >
      {proof ? "Proof" : "Questions"}
    </span>
  );
}
