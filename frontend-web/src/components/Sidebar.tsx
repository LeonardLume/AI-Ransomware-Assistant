import {
  Activity,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  RadioTower,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { ChatResponse, ProviderStatusResponse, SessionSummary } from "../types/api";
import { t, type UiLanguage } from "../utils/i18n";
import type { AppView } from "./Layout";
import { Badge, Button } from "./ui";
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
  onLoadDemo,
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
  onLoadDemo: (profileId: "weak_sme" | "better_sme") => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}) {
  const provider = providerStatus?.provider || lastResponse?.provider || "unknown";
  const fallbackUsed = providerStatus
    ? providerStatus.provider === "fallback"
    : (lastResponse?.used_fallback ?? provider === "fallback");

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
          <div className="scrollbar-slim min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {sessions.length ? (
              sessions.map((session) => {
                const active = session.id === activeSessionId;
                return (
                  <div
                    key={session.id}
                    className={cn(
                      "group rounded-xl border px-2.5 py-2.5 transition-all duration-200 ease-out",
                      active
                        ? "border-sky-400/30 bg-sky-500/15"
                        : "border-transparent bg-transparent hover:bg-white/[0.07]",
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
                        <span className="mt-1 block text-[11px] text-slate-500">
                          {new Date(session.updatedAt).toLocaleDateString()}
                          {session.completionRate !== undefined
                            ? ` - ${session.completionRate}%`
                            : ""}
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
                {language === "ru"
                  ? "Локальных сессий пока нет."
                  : language === "en"
                    ? "No local sessions yet."
                    : "Kohalikke sessioone veel ei ole."}
              </div>
            )}
          </div>
        </section>

        <div className={cn("mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-2", collapsed && "lg:mt-auto lg:border-0 lg:bg-transparent lg:p-0")}>
          <div className={cn("mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500", collapsed && "lg:hidden")}>
            Demo profiles
          </div>
          <div className={cn("grid grid-cols-2 gap-2", collapsed && "lg:grid-cols-1")}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onLoadDemo("weak_sme")}
              className={cn("h-9 justify-center border-white/10 bg-white/[0.035] text-xs shadow-none hover:bg-white/[0.07]", collapsed && "lg:h-10 lg:w-10 lg:px-0")}
              title="Weak SME"
            >
              <ShieldAlert className="h-4 w-4" />
              <span className={cn(collapsed && "lg:hidden")}>Weak SME</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onLoadDemo("better_sme")}
              className={cn("h-9 justify-center border-white/10 bg-white/[0.035] text-xs shadow-none hover:bg-white/[0.07]", collapsed && "lg:h-10 lg:w-10 lg:px-0")}
              title="Better SME"
            >
              <ShieldCheck className="h-4 w-4" />
              <span className={cn(collapsed && "lg:hidden")}>Better SME</span>
            </Button>
          </div>
        </div>

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
        <Badge tone={tone} className="px-2 py-0.5 text-[11px]">{value}</Badge>
      </div>
    </div>
  );
}
