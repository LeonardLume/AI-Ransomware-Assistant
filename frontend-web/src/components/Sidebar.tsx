import {
  Activity,
  BookOpenCheck,
  Bot,
  ClipboardList,
  Database,
  FileText,
  Home,
  Layers3,
  PanelLeftClose,
  Plus,
  RadioTower,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { ChatResponse, ProviderStatusResponse, SessionSummary } from "../types/api";
import { languageOptions, t, type TranslationKey, type UiLanguage } from "../utils/i18n";
import type { AppView } from "./Layout";
import { Badge, Button, cn } from "./ui";

const navItems: Array<{ id: AppView; label: TranslationKey; icon: typeof Home }> = [
  { id: "home", label: "home", icon: Home },
  { id: "interview", label: "interview", icon: Bot },
  { id: "report", label: "report", icon: FileText },
  { id: "action-plan", label: "actionPlan", icon: ClipboardList },
  { id: "evidence", label: "evidenceBinder", icon: Database },
  { id: "skills", label: "skills", icon: BookOpenCheck },
  { id: "technical", label: "technicalTransparency", icon: Layers3 },
];

export default function Sidebar({
  sessions,
  activeSessionId,
  activeView,
  language,
  backendOnline,
  providerStatus,
  lastResponse,
  open,
  onClose,
  onViewChange,
  onLanguageChange,
  onNewSession,
  onLoadDemo,
  onSelectSession,
  onDeleteSession,
}: {
  sessions: SessionSummary[];
  activeSessionId?: string | null;
  activeView: AppView;
  language: UiLanguage;
  backendOnline: boolean;
  providerStatus?: ProviderStatusResponse | null;
  lastResponse?: ChatResponse | null;
  open: boolean;
  onClose: () => void;
  onViewChange: (view: AppView) => void;
  onLanguageChange: (language: UiLanguage) => void;
  onNewSession: () => void;
  onLoadDemo: (profileId: "weak_sme" | "better_sme") => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}) {
  const provider = lastResponse?.provider || providerStatus?.provider || "unknown";
  const fallbackUsed =
    lastResponse?.used_fallback ??
    providerStatus?.used_fallback ??
    providerStatus?.fallback_used ??
    provider === "fallback";

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
          "scrollbar-slim fixed inset-y-0 left-0 z-50 flex w-[320px] flex-col overflow-y-auto border-r border-white/10 bg-[#0b0b0d] px-3 py-4 text-slate-100 shadow-[28px_0_80px_rgba(0,0,0,0.48)] transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-4 flex items-center justify-end px-1 lg:hidden">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-9 w-9 px-0 lg:hidden"
            aria-label="Close navigation"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeView;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onViewChange(item.id);
                  onClose();
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                  active
                    ? "bg-white/[0.18] text-white shadow-[0_10px_28px_rgba(0,0,0,0.18)]"
                    : "text-slate-300 hover:bg-white/[0.09] hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {t(language, item.label)}
              </button>
            );
          })}
        </nav>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.055] p-3">
          <div className="mb-2 text-xs font-semibold uppercase text-slate-500">
            {t(language, "language")}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {languageOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onLanguageChange(option.id)}
                className={cn(
                  "rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors",
                  option.id === language
                    ? "border-sky-400 bg-sky-500/20 text-white"
                    : "border-white/10 bg-black/20 text-slate-400 hover:text-white",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button type="button" variant="primary" onClick={onNewSession} className="col-span-2">
            <Plus className="h-4 w-4" />
            {t(language, "newAssessment")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onLoadDemo("weak_sme")}
            className="justify-center text-xs"
          >
            <ShieldAlert className="h-4 w-4" />
            Weak SME
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onLoadDemo("better_sme")}
            className="justify-center text-xs"
          >
            <ShieldCheck className="h-4 w-4" />
            Better SME
          </Button>
        </div>

        <div className="mt-5 shrink-0">
          <div className="mb-2 px-1 text-xs font-semibold uppercase text-slate-500">
            {t(language, "recentSessions")}
          </div>
          <div className="scrollbar-slim min-h-[112px] max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {sessions.length ? (
              sessions.slice(0, 5).map((session) => {
                const active = session.id === activeSessionId;
                return (
                  <div
                    key={session.id}
                    className={cn(
                      "group rounded-xl border px-2.5 py-2",
                      active
                        ? "border-white/10 bg-white/[0.14]"
                        : "border-transparent bg-transparent hover:bg-white/[0.07]",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectSession(session.id);
                          onViewChange("interview");
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate text-xs font-medium text-slate-100">
                          {session.title}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">
                          {new Date(session.updatedAt).toLocaleDateString()}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSession(session.id)}
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 opacity-0 hover:bg-white/10 hover:text-slate-200 group-hover:opacity-100"
                        aria-label="Delete local session"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 p-3 text-xs text-slate-500">
                {language === "ru"
                  ? "Локальных сессий пока нет."
                  : language === "en"
                    ? "No local sessions yet."
                    : "Kohalikke sessioone veel ei ole."}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <StatusCard
            icon={Activity}
            label={t(language, "backendStatus")}
            value={backendOnline ? t(language, "online") : t(language, "offline")}
            tone={backendOnline ? "success" : "danger"}
          />
          <StatusCard icon={RadioTower} label={t(language, "providerStatus")} value={provider} tone="info" />
          <StatusCard
            icon={Sparkles}
            label={t(language, "fallbackMode")}
            value={String(Boolean(fallbackUsed))}
            tone={fallbackUsed ? "warning" : "success"}
          />
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-fuchsia-500 text-xs font-bold">
            AI
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">Local MVP</div>
            <div className="truncate text-xs text-slate-500">No frontend API keys</div>
          </div>
        </div>
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-3 shadow-[0_12px_34px_rgba(0,0,0,0.18)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="truncate text-xs text-slate-400">{label}</span>
        </div>
        <Badge tone={tone}>{value}</Badge>
      </div>
    </div>
  );
}
