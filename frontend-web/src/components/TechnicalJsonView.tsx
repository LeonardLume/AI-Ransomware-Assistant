import { FileJson } from "lucide-react";
import type {
  ChatResponse,
  ProviderStatusResponse,
  ReportResponse,
  ScoreResponse,
  SessionStateResponse,
  TechnicalFlowResponse,
} from "../types/api";
import { Accordion, Card, EmptyState } from "./ui";

export default function TechnicalJsonView({
  session,
  score,
  report,
  lastResponse,
  providerStatus,
  flow,
}: {
  session?: SessionStateResponse | null;
  score?: ScoreResponse | null;
  report?: ReportResponse | null;
  lastResponse?: ChatResponse | null;
  providerStatus?: ProviderStatusResponse | null;
  flow?: TechnicalFlowResponse | null;
}) {
  const payload = { session, score, report, lastResponse, providerStatus, flow };
  const hasPayload = Object.values(payload).some(Boolean);

  if (!hasPayload) {
    return (
      <EmptyState
        title="No technical trace yet"
        description="Debug payloads appear here after the UI talks to the backend. Raw JSON stays out of the main chat and opens only inside the debug accordion."
        icon={<FileJson className="h-5 w-5" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-slate-950">Technical Trace</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Raw technical payloads are kept out of the normal chat thread. Open the debug accordion
          only when you need integration details.
        </p>
      </Card>
      <Accordion title="Debug JSON">
        <pre className="scrollbar-slim max-h-[620px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </Accordion>
    </div>
  );
}
