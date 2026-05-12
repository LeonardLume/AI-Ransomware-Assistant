import { Menu } from "lucide-react";
import type { ChatResponse, ProviderStatusResponse } from "../types/api";
import ProviderStatus from "./ProviderStatus";
import { Button } from "./ui";

export default function Header({
  backendOnline,
  providerStatus,
  lastResponse,
  onToggleSidebar,
}: {
  backendOnline: boolean;
  providerStatus?: ProviderStatusResponse | null;
  lastResponse?: ChatResponse | null;
  onToggleSidebar: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 shadow-[0_14px_38px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
      <div className="h-0.5 bg-gradient-to-r from-slate-900 via-sky-500 to-emerald-500" />
      <div className="mx-auto flex min-h-[72px] max-w-[1600px] items-center justify-between gap-4 px-4 py-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onToggleSidebar}
            className="h-10 w-10 px-0 lg:hidden"
            aria-label="Toggle sessions"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-slate-950">
              Ransomware Readiness AI
            </h1>
            <p className="mt-1 truncate text-sm text-slate-600">
              Controlled AI interview - Defensive-only - Rule-based scoring
            </p>
          </div>
        </div>
        <div className="hidden shrink-0 md:block">
          <ProviderStatus
            backendOnline={backendOnline}
            providerStatus={providerStatus}
            lastResponse={lastResponse}
          />
        </div>
      </div>
      <div className="border-t border-slate-100 px-4 py-2 md:hidden">
        <ProviderStatus
          backendOnline={backendOnline}
          providerStatus={providerStatus}
          lastResponse={lastResponse}
        />
      </div>
    </header>
  );
}
