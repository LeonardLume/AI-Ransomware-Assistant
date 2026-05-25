import { ClipboardList, FileText, ListChecks, PlaySquare } from "lucide-react";
import type { ArtifactId, ReportResponse } from "../types/api";
import ActionPlanView from "./ActionPlanView";
import EvidenceBinderView from "./EvidenceBinderView";
import RansomwarePlaybookView from "./RansomwarePlaybookView";
import ReportView from "./ReportView";
import { Button, EmptyState, Tabs } from "./ui";

const tabs: Array<{ id: ArtifactId; label: string; icon: JSX.Element }> = [
  { id: "readiness-report", label: "Raport", icon: <FileText className="h-4 w-4" /> },
  { id: "action-plan", label: "Tegevusplaan", icon: <ClipboardList className="h-4 w-4" /> },
  { id: "evidence-binder", label: "Tõendid", icon: <ListChecks className="h-4 w-4" /> },
  { id: "ransomware-playbook", label: "Juhend", icon: <PlaySquare className="h-4 w-4" /> },
];

export default function ResultsView({
  activeArtifact,
  report,
  canGenerateReport,
  loading,
  onGenerateReport,
  onSelectArtifact,
}: {
  activeArtifact: ArtifactId;
  report?: ReportResponse | null;
  canGenerateReport: boolean;
  loading?: boolean;
  onGenerateReport: () => void;
  onSelectArtifact: (artifact: ArtifactId) => void;
}) {
  if (!report) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          title="Raportit pole veel"
          description="Lõpeta intervjuu või laadi demoprofiil."
          icon={<FileText className="h-5 w-5" />}
          action={
            <Button
              type="button"
              variant="primary"
              disabled={!canGenerateReport || loading}
              onClick={onGenerateReport}
            >
              Koosta raport
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Tulemused</h2>
          <p className="mt-1 text-sm text-slate-500">
            Taustsüsteemi koostatud raportivaated.
          </p>
        </div>
        <Button type="button" disabled={!canGenerateReport || loading} onClick={onGenerateReport}>
          Värskenda raportit
        </Button>
      </div>
      <Tabs
        tabs={tabs}
        active={activeArtifact === "technical-json" ? "readiness-report" : activeArtifact}
        onChange={(id) => onSelectArtifact(id as ArtifactId)}
      />
      <div className="min-w-0">
        {activeArtifact === "readiness-report" || activeArtifact === "technical-json" ? (
          <ReportView
            report={report}
            canGenerate={canGenerateReport}
            loading={loading}
            onGenerate={onGenerateReport}
          />
        ) : null}
        {activeArtifact === "action-plan" ? <ActionPlanView report={report} /> : null}
        {activeArtifact === "evidence-binder" ? <EvidenceBinderView report={report} /> : null}
        {activeArtifact === "ransomware-playbook" ? <RansomwarePlaybookView report={report} /> : null}
      </div>
    </section>
  );
}
