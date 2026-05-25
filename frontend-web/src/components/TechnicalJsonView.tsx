import type {
  ChatResponse,
  ProviderStatusResponse,
  ReportResponse,
  ScoreResponse,
  SessionStateResponse,
  TechnicalFlowResponse,
} from "../types/api";
import { t, type UiLanguage } from "../utils/i18n";
import { EmptyState } from "./ui";

export default function TechnicalJsonView({
  session,
  score,
  report,
  lastResponse,
  providerStatus,
  flow,
  language = "et",
}: {
  session?: SessionStateResponse | null;
  score?: ScoreResponse | null;
  report?: ReportResponse | null;
  lastResponse?: ChatResponse | null;
  providerStatus?: ProviderStatusResponse | null;
  flow?: TechnicalFlowResponse | null;
  language?: UiLanguage;
}) {
  const payload = { session, score, report, lastResponse, providerStatus, flow };
  const hasPayload = Object.values(payload).some(Boolean);

  if (!hasPayload) {
    return (
      <EmptyState
        title={t(language, "noTechnicalTrace")}
        description={t(language, "noTechnicalTraceDescription")}
      />
    );
  }

  return (
    <section className="report-panel rounded-[30px] px-5 py-5 sm:px-6">
      <h3 className="text-lg font-semibold tracking-[-0.03em] text-white">
        {t(language, "rawTraceTitle")}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        {t(language, "rawTraceText")}
      </p>
      <details className="mt-4 rounded-[22px] border border-white/[0.07] bg-white/[0.025] px-4 py-3">
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-200">
          {t(language, "debugJson")}
        </summary>
        <pre className="scrollbar-slim mt-3 max-h-[620px] overflow-auto rounded-[18px] bg-black/50 p-4 text-xs leading-5 text-slate-100">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </details>
    </section>
  );
}
