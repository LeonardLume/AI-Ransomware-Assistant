import { FileJson } from "lucide-react";
import type {
  ChatResponse,
  ProviderStatusResponse,
  ReportResponse,
  ScoreResponse,
  SessionStateResponse,
  TechnicalFlowResponse,
} from "../types/api";
import { t, type UiLanguage } from "../utils/i18n";
import { Accordion, Card, EmptyState } from "./ui";

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
        icon={<FileJson className="h-5 w-5" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-slate-950">{t(language, "rawTraceTitle")}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          {t(language, "rawTraceText")}
        </p>
      </Card>
      <Accordion title={t(language, "debugJson")}>
        <pre className="scrollbar-slim max-h-[620px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </Accordion>
    </div>
  );
}
