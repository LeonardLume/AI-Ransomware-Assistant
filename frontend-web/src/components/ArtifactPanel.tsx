import {
  BookOpenCheck,
  ClipboardList,
  FileJson,
  FileText,
  ListChecks,
} from "lucide-react";
import type {
  ArtifactId,
  ChatResponse,
  ProviderStatusResponse,
  ReportResponse,
  ScoreResponse,
  SessionStateResponse,
  TechnicalFlowResponse,
} from "../types/api";
import ActionPlanView from "./ActionPlanView";
import EvidenceBinderView from "./EvidenceBinderView";
import RansomwarePlaybookView from "./RansomwarePlaybookView";
import ReportView from "./ReportView";
import TechnicalJsonView from "./TechnicalJsonView";
import { ArtifactCard, Tabs } from "./ui";

const tabItems: Array<{ id: ArtifactId; label: string; icon: JSX.Element }> = [
  { id: "readiness-report", label: "Valmisoleku raport", icon: <FileText className="h-4 w-4" /> },
  { id: "action-plan", label: "Tegevusplaan", icon: <ClipboardList className="h-4 w-4" /> },
  { id: "evidence-binder", label: "Tõendite kaust", icon: <ListChecks className="h-4 w-4" /> },
  {
    id: "ransomware-playbook",
    label: "Lunavara juhend",
    icon: <BookOpenCheck className="h-4 w-4" />,
  },
  { id: "technical-json", label: "Tehniline JSON", icon: <FileJson className="h-4 w-4" /> },
];

export default function ArtifactPanel({
  activeArtifact,
  report,
  session,
  score,
  lastResponse,
  flow,
  providerStatus,
  canGenerateReport,
  loading,
  onGenerateReport,
  onSelectArtifact,
}: {
  activeArtifact: ArtifactId;
  report?: ReportResponse | null;
  session?: SessionStateResponse | null;
  score?: ScoreResponse | null;
  lastResponse?: ChatResponse | null;
  flow?: TechnicalFlowResponse | null;
  providerStatus?: ProviderStatusResponse | null;
  canGenerateReport: boolean;
  loading?: boolean;
  onGenerateReport: () => void;
  onSelectArtifact: (artifact: ArtifactId) => void;
}) {
  const hasReport = Boolean(report);
  const hasActionPlan = Boolean(report?.action_plan?.length);
  const hasEvidence = Boolean(report?.evidence_checklist?.length);
  const hasPlaybook = hasReport;
  const hasTrace = Boolean(session || score || report || lastResponse || flow || providerStatus);

  const cards: Array<{
    id: ArtifactId;
    title: string;
    description: string;
    available: boolean;
    icon: JSX.Element;
  }> = [
    {
      id: "readiness-report",
      title: "Valmisoleku raport",
      description: hasReport ? "Tulemus, riskitase, domeenid, riskid ja järgmised sammud." : "Koosta pärast seda, kui sessioonis on vastuseid.",
      available: hasReport,
      icon: <FileText className="h-5 w-5" />,
    },
    {
      id: "action-plan",
      title: "Tegevusplaan",
      description: hasActionPlan ? "Prioriseeritud tegevused koos omanike ja tõenditega." : "Ootab tegevusplaani andmeid.",
      available: hasActionPlan,
      icon: <ClipboardList className="h-5 w-5" />,
    },
    {
      id: "evidence-binder",
      title: "Tõendite kaust",
      description: hasEvidence ? "Domeenide järgi grupeeritud tõendite kontrollnimekiri." : "Taustsüsteemi kontrollnimekiri pole veel saadaval.",
      available: hasEvidence,
      icon: <ListChecks className="h-5 w-5" />,
    },
    {
      id: "ransomware-playbook",
      title: "Lunavara juhend",
      description: hasPlaybook ? "Raporti andmetest koostatud kaitsev töövaade." : "Koosta esmalt raport.",
      available: hasPlaybook,
      icon: <BookOpenCheck className="h-5 w-5" />,
    },
    {
      id: "technical-json",
      title: "Tehniline jälg",
      description: hasTrace ? "Silumisandmed, teenusepakkuja olek ja töövoo jälg." : "Jälge pole veel kogutud.",
      available: hasTrace,
      icon: <FileJson className="h-5 w-5" />,
    },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/95 shadow-soft">
      <div className="border-b border-slate-200/80 bg-slate-50/90 px-4 py-3">
        <div className="text-xs font-semibold uppercase text-slate-500">Vaated</div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {cards.map((card) => (
            <ArtifactCard
              key={card.id}
              title={card.title}
              description={card.description}
              active={activeArtifact === card.id}
              available={card.available}
              icon={card.icon}
              onOpen={() => onSelectArtifact(card.id)}
            />
          ))}
        </div>
        <div className="mt-3">
          <Tabs
            tabs={tabItems}
            active={activeArtifact}
            onChange={(id) => onSelectArtifact(id as ArtifactId)}
          />
        </div>
      </div>

      <div className="p-4">
        {activeArtifact === "readiness-report" ? (
          <ReportView
            report={report}
            canGenerate={canGenerateReport}
            loading={loading}
            onGenerate={onGenerateReport}
          />
        ) : null}
        {activeArtifact === "action-plan" ? <ActionPlanView report={report} /> : null}
        {activeArtifact === "evidence-binder" ? <EvidenceBinderView report={report} /> : null}
        {activeArtifact === "ransomware-playbook" ? (
          <RansomwarePlaybookView report={report} />
        ) : null}
        {activeArtifact === "technical-json" ? (
          <TechnicalJsonView
            session={session}
            score={score}
            report={report}
            lastResponse={lastResponse}
            providerStatus={providerStatus}
            flow={flow}
          />
        ) : null}
      </div>
    </section>
  );
}
