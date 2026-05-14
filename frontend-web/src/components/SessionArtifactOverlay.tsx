import { X } from "lucide-react";
import type {
  ArtifactId,
  ChatResponse,
  ProviderStatusResponse,
  Question,
  ReportResponse,
  ScoreResponse,
  SessionStateResponse,
  TechnicalFlowResponse,
} from "../types/api";
import { t, type UiLanguage } from "../utils/i18n";
import ActionPlanView from "./ActionPlanView";
import EvidenceBinderView from "./EvidenceBinderView";
import ReportView from "./ReportView";
import SkillsView from "./SkillsView";
import TechnicalTransparencyView from "./TechnicalTransparencyView";
import TechnicalView from "./TechnicalView";
import { Button } from "./ui";

function normalizeArtifact(artifact: ArtifactId): ArtifactId {
  return artifact === "ransomware-playbook" ? "skills" : artifact;
}

function artifactTitle(artifact: ArtifactId, language: UiLanguage): string {
  const normalized = normalizeArtifact(artifact);
  if (normalized === "readiness-report") return t(language, "report");
  if (normalized === "action-plan") return t(language, "actionPlan");
  if (normalized === "evidence-binder") return t(language, "evidenceBinder");
  if (normalized === "skills") return t(language, "skills");
  return "Technical";
}

export default function SessionArtifactOverlay({
  open,
  activeArtifact,
  activeSessionId,
  report,
  session,
  score,
  lastResponse,
  flow,
  providerStatus,
  backendOnline,
  questions,
  canGenerateReport,
  loading,
  language = "et",
  onGenerateReport,
  onClose,
}: {
  open: boolean;
  activeArtifact: ArtifactId;
  activeSessionId?: string | null;
  report?: ReportResponse | null;
  session?: SessionStateResponse | null;
  score?: ScoreResponse | null;
  lastResponse?: ChatResponse | null;
  flow?: TechnicalFlowResponse | null;
  providerStatus?: ProviderStatusResponse | null;
  backendOnline: boolean;
  questions: Question[];
  canGenerateReport: boolean;
  loading?: boolean;
  language?: UiLanguage;
  onGenerateReport: () => void;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  const selectedArtifact = normalizeArtifact(activeArtifact);

  return (
    <div className="artifact-overlay-enter absolute inset-0 z-30 overflow-hidden rounded-xl border border-white/10 bg-[#07090d]/95 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/25 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-white">
            {artifactTitle(selectedArtifact, language)}
          </h2>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {activeSessionId ? `Session ${activeSessionId.slice(0, 8)}` : "No active session"}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          className="h-9 w-9 px-0 transition-all duration-300 ease-out hover:scale-105"
          aria-label="Close artifact"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="scrollbar-slim h-[calc(100%-64px)] overflow-y-auto p-4 sm:p-5">
        <div key={selectedArtifact} className="artifact-content-enter">
          {!activeSessionId ? (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
              Start or load an assessment to see session artifacts.
            </div>
          ) : null}
          {activeSessionId && selectedArtifact === "readiness-report" ? (
            <ReportView
              report={report}
              canGenerate={canGenerateReport}
              loading={loading}
              onGenerate={onGenerateReport}
              language={language}
            />
          ) : null}
          {activeSessionId && selectedArtifact === "action-plan" ? (
            <ActionPlanView report={report} language={language} />
          ) : null}
          {activeSessionId && selectedArtifact === "evidence-binder" ? (
            <EvidenceBinderView report={report} language={language} />
          ) : null}
          {activeSessionId && selectedArtifact === "skills" ? (
            <SkillsView report={report} language={language} />
          ) : null}
          {activeSessionId && selectedArtifact === "technical-json" ? (
            <div className="space-y-5">
              <TechnicalTransparencyView
                flow={flow}
                providerStatus={providerStatus}
                language={language}
              />
              <TechnicalView
                backendOnline={backendOnline}
                providerStatus={providerStatus}
                lastResponse={lastResponse}
                session={session}
                score={score}
                report={report}
                questions={questions}
                flow={flow}
                language={language}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
