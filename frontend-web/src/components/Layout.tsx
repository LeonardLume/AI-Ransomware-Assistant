import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import type {
  ChatResponse,
  ProviderStatusResponse,
  SessionSummary,
} from "../types/api";
import type { UiLanguage } from "../utils/i18n";
import Sidebar from "./Sidebar";
import { Button } from "./ui";

export type AppView =
  | "home"
  | "interview"
  | "report"
  | "action-plan"
  | "evidence"
  | "skills"
  | "technical";

export default function Layout({
  backendOnline,
  providerStatus,
  lastResponse,
  sidebarOpen,
  sessions,
  activeSessionId,
  activeView,
  language,
  pages,
  onViewChange,
  onLanguageChange,
  onToggleSidebar,
  onCloseSidebar,
  onNewSession,
  onLoadDemo,
  onSelectSession,
  onDeleteSession,
}: {
  backendOnline: boolean;
  providerStatus?: ProviderStatusResponse | null;
  lastResponse?: ChatResponse | null;
  sidebarOpen: boolean;
  sessions: SessionSummary[];
  activeSessionId?: string | null;
  activeView: AppView;
  language: UiLanguage;
  pages: Record<AppView, ReactNode>;
  onViewChange: (view: AppView) => void;
  onLanguageChange: (language: UiLanguage) => void;
  onToggleSidebar: () => void;
  onCloseSidebar: () => void;
  onNewSession: () => void;
  onLoadDemo: (profileId: "weak_sme" | "better_sme") => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}) {
  return (
    <div className="min-h-screen bg-[#08090c] text-slate-100">
      <div className="grid min-h-screen lg:grid-cols-[320px_minmax(0,1fr)]">
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          activeView={activeView}
          language={language}
          backendOnline={backendOnline}
          providerStatus={providerStatus}
          lastResponse={lastResponse}
          open={sidebarOpen}
          onClose={onCloseSidebar}
          onViewChange={onViewChange}
          onLanguageChange={onLanguageChange}
          onNewSession={onNewSession}
          onLoadDemo={onLoadDemo}
          onSelectSession={onSelectSession}
          onDeleteSession={onDeleteSession}
        />

        <main className="relative min-w-0 p-2 sm:p-3 lg:p-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onToggleSidebar}
            className="fixed left-4 top-4 z-40 h-10 w-10 rounded-xl px-0 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <section className="main-workspace relative min-h-[calc(100vh-1rem)] overflow-hidden rounded-[30px] border border-white/10 bg-slate-950 shadow-[0_30px_90px_rgba(0,0,0,0.42)] sm:min-h-[calc(100vh-1.5rem)] lg:min-h-[calc(100vh-2rem)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.10),transparent_34%)]" />
            <div key={activeView} className="view-transition relative z-10 h-full p-4 sm:p-6 lg:p-8">
              {pages[activeView]}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
