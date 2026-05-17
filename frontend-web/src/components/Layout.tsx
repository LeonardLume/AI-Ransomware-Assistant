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
import { cn } from "./ui-helpers";

export type AppView = "home" | "interview";

export default function Layout({
  backendOnline,
  providerStatus,
  lastResponse,
  sidebarOpen,
  sidebarCollapsed,
  sessions,
  activeSessionId,
  activeView,
  language,
  pages,
  onViewChange,
  onToggleSidebar,
  onToggleSidebarCollapsed,
  onCloseSidebar,
  onLoadDemo,
  onSelectSession,
  onDeleteSession,
}: {
  backendOnline: boolean;
  providerStatus?: ProviderStatusResponse | null;
  lastResponse?: ChatResponse | null;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  sessions: SessionSummary[];
  activeSessionId?: string | null;
  activeView: AppView;
  language: UiLanguage;
  pages: Record<AppView, ReactNode>;
  onViewChange: (view: AppView) => void;
  onToggleSidebar: () => void;
  onToggleSidebarCollapsed: () => void;
  onCloseSidebar: () => void;
  onLoadDemo: (profileId: "weak_sme" | "better_sme") => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}) {
  return (
    <div className="min-h-screen bg-[#08090c] text-slate-100">
      <div
        className={cn(
          "grid min-h-screen transition-[grid-template-columns] duration-300",
          sidebarCollapsed
            ? "lg:grid-cols-[72px_minmax(0,1fr)]"
            : "lg:grid-cols-[280px_minmax(0,1fr)]",
        )}
      >
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          activeView={activeView}
          collapsed={sidebarCollapsed}
          language={language}
          backendOnline={backendOnline}
          providerStatus={providerStatus}
          lastResponse={lastResponse}
          open={sidebarOpen}
          onClose={onCloseSidebar}
          onToggleCollapsed={onToggleSidebarCollapsed}
          onViewChange={onViewChange}
          onLoadDemo={onLoadDemo}
          onSelectSession={onSelectSession}
          onDeleteSession={onDeleteSession}
        />

        <main className="relative min-w-0 p-2 transition-all duration-300 ease-out sm:p-3 lg:p-4">
          <section
            data-view={activeView}
            className="main-workspace relative isolate flex min-h-[calc(100vh-1rem)] flex-col overflow-hidden rounded-[30px] border border-white/10 bg-transparent shadow-[0_30px_90px_rgba(0,0,0,0.42)] transition-all duration-300 ease-out sm:min-h-[calc(100vh-1.5rem)] lg:min-h-[calc(100vh-2rem)]"
          >
            <Button
              type="button"
              variant="secondary"
              onClick={onToggleSidebar}
              className="absolute left-4 top-4 z-40 h-10 w-10 px-0 transition-all duration-300 ease-out lg:hidden"
              aria-label="Open sessions"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div key={activeView} className="view-transition relative z-10 min-h-0 flex-1 p-4 sm:p-5 lg:p-6">
              {pages[activeView]}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
