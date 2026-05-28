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
import ReportRequiredState from "./ReportRequiredState";
import ReportView from "./ReportView";
import SkillsView from "./SkillsView";
import TechnicalTransparencyView from "./TechnicalTransparencyView";
import TechnicalView from "./TechnicalView";

function normalizeArtifact(artifact: ArtifactId): ArtifactId {
  return artifact === "ransomware-playbook" ? "skills" : artifact;
}

function artifactTitle(artifact: ArtifactId, language: UiLanguage): string {
  const normalized = normalizeArtifact(artifact);
  if (normalized === "readiness-report") return t(language, "report");
  if (normalized === "action-plan") return t(language, "actionPlan");
  if (normalized === "evidence-binder") return t(language, "evidenceBinder");
  if (normalized === "skills") return t(language, "skills");
  return t(language, "technical");
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
  onOpenReport,
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
  onOpenReport: () => void;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  const selectedArtifact = normalizeArtifact(activeArtifact);
  const reportRequired =
    activeSessionId &&
    !report &&
    (selectedArtifact === "action-plan" ||
      selectedArtifact === "evidence-binder" ||
      selectedArtifact === "skills");

  return (
    <div className="h-full min-h-full overflow-y-auto rounded-[26px] bg-transparent">
      <div className="min-h-full bg-transparent p-3 sm:p-4">
        <div key={selectedArtifact} className="artifact-tab-transition">
          {!activeSessionId ? (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
              {t(language, "startOrLoadAssessment")}
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
          {reportRequired ? (
            <ReportRequiredState
              title={artifactTitle(selectedArtifact, language)}
              description={t(language, "noReportDescription")}
              language={language}
              loading={loading}
              onGenerate={onGenerateReport}
              onOpenReport={onOpenReport}
            />
          ) : null}
          {activeSessionId && !reportRequired && selectedArtifact === "action-plan" ? (
            <ActionPlanView report={report} language={language} />
          ) : null}
          {activeSessionId && !reportRequired && selectedArtifact === "evidence-binder" ? (
            <EvidenceBinderView report={report} language={language} />
          ) : null}
          {activeSessionId && !reportRequired && selectedArtifact === "skills" ? (
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
        <div className="mt-8 h-px rounded-full bg-white/10" aria-hidden="true" />
      </div>
    </div>
  );
}
