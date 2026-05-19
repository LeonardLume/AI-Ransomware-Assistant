import {
  ArrowRight,
  ChevronDown,
  FileText,
  Radar,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import type { DomainScore, ReportResponse, RiskLevel } from "../types/api";
import {
  isEarlyPreview,
  riskToneForCompletion,
  scoreConfidenceLabel,
} from "../utils/assessmentUi";
import {
  domainLabel,
  localizedDomainRisk,
  localizedExposureQuestion,
  localizedFinding,
  localizedSummary,
  localizeKnownText,
  riskLabel,
  t,
  valueLabel,
  type UiLanguage,
} from "../utils/i18n";
import { EmptyState } from "./ui";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Separator } from "./ui/separator";
import { Skeleton } from "./ui/skeleton";
import { cn, riskTone, type Tone } from "./ui-helpers";
import ReportCockpitHero from "./report/ReportCockpitHero";
import type { MetricStripItem } from "./report/MetricStrip";

type FindingLike = {
  id: string;
  title: string;
  severity?: RiskLevel;
  domain?: string;
  summary?: string;
  action?: string;
};

type BadgeVariant = ComponentProps<typeof Badge>["variant"];
type ReportSource = {
  name: string;
  url?: string;
  usedFor?: string;
};

const severityRank: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const simulatorBump = 24;

const reportCopy = {
  et: {
    introLabel: "Valmisoleku raport",
    title: "Your Raport",
    subtitle: "Backendi hinnatud raport prioriseeritud tegevuste ja t\u00f5enditega.",
    score: "Skoor",
    risk: "Risk",
    completion: "T\u00e4idetud",
    confidence: "Usaldus",
    backendOwned: "Backendi arvutus",
    backendRisk: "Backendi riskitase",
    answered: "Vastatud",
    separateSignal: "Eraldi signaal",
    officialScore: "Ametlik skoor",
    topRisk: "Peamine risk",
    priorityAction: "Prioriteetne tegevus",
    criticalFindings: "Kriitilised leiud",
    criticalFindingsDescription: "L\u00fchike \u00fclevaade backendi leidudest ja peamistest riskidest.",
    prioritySteps: "Prioriteetsed sammud",
    priorityStepsDescription: "Backendi soovitatud j\u00e4rgmised tegevused.",
    items: "kirjet",
    noFindings: "Kompaktseid leide pole veel. V\u00e4rskenda backendi raportit.",
    noSteps: "Prioriseeritud samme pole veel.",
    domainRiskMap: "Domeenide riskikaart",
    domainRiskDescription: "Ridadel on ainult backendi domeeniskoorid.",
    domains: "domeeni",
    noRiskLabel: "Riskim\u00e4rgis puudub",
    coverage: "Kaetus",
    criticalNegatives: "kriitilist negatiivset",
    whatIf: "Mis-kui simulaator",
    whatIfDescription: "Kohalik stsenaariumit\u00f6\u00f6riist. Ametlik skoor j\u00e4\u00e4b backendile.",
    unofficialPreview: "Mitteametlik eelvaade",
    reset: "L\u00e4htesta",
    base: "Algne",
    simulated: "Simuleeritud",
    simulatorUnavailable: "Simulaator ilmub siis, kui backendi raportis on domeeniskoorid.",
    advisoryPreview: "N\u00f5uandev eelvaade",
    simulatedScore: "simuleeritud skoor",
    vsOfficial: "vs ametlik",
    simulationNote: "Simulation only - official score remains backend-owned.",
    detailedNarrative: "Detailne narratiiv",
    expanded: "Avatud",
    collapsed: "Vaikimisi suletud",
    sourcesUsed: "Kasutatud allikad",
    reference: "Viide",
    openSource: "Ava allikas",
    immediatePriority: "Kohe prioriteet",
    queuedAction: "J\u00e4rjekorras tegevus",
  },
  en: {
    introLabel: "Readiness report",
    title: "Your Raport",
    subtitle: "Backend-scored assessment with prioritized actions and evidence.",
    score: "Score",
    risk: "Risk",
    completion: "Completion",
    confidence: "Confidence",
    backendOwned: "Backend-owned",
    backendRisk: "Backend risk",
    answered: "Answered",
    separateSignal: "Separate signal",
    officialScore: "Official score",
    topRisk: "Top risk",
    priorityAction: "Priority action",
    criticalFindings: "Critical findings",
    criticalFindingsDescription: "Short briefing from backend findings and top risks.",
    prioritySteps: "Priority next steps",
    priorityStepsDescription: "Backend-recommended next actions.",
    items: "items",
    noFindings: "No compact findings available yet. Refresh the backend report.",
    noSteps: "No prioritized next steps available yet.",
    domainRiskMap: "Domain risk map",
    domainRiskDescription: "Rows show backend domain scores only.",
    domains: "domains",
    noRiskLabel: "No risk label",
    coverage: "Coverage",
    criticalNegatives: "critical negatives",
    whatIf: "What-if simulator",
    whatIfDescription: "Local scenario tool. The official score remains backend-owned.",
    unofficialPreview: "Unofficial preview",
    reset: "Reset",
    base: "Base",
    simulated: "Simulated",
    simulatorUnavailable: "Simulator becomes available once domain scores exist in the backend report.",
    advisoryPreview: "Advisory preview",
    simulatedScore: "simulated score",
    vsOfficial: "vs official",
    simulationNote: "Simulation only - official score remains backend-owned.",
    detailedNarrative: "Detailed narrative",
    expanded: "Expanded",
    collapsed: "Collapsed by default",
    sourcesUsed: "Sources used",
    reference: "Reference",
    openSource: "Open source",
    immediatePriority: "Immediate priority",
    queuedAction: "Queued action",
  },
  ru: {
    introLabel: "\u041e\u0442\u0447\u0451\u0442 \u0433\u043e\u0442\u043e\u0432\u043d\u043e\u0441\u0442\u0438",
    title: "Your Raport",
    subtitle: "\u041e\u0446\u0435\u043d\u0451\u043d\u043d\u044b\u0439 backend \u043e\u0442\u0447\u0451\u0442 \u0441 \u043f\u0440\u0438\u043e\u0440\u0438\u0442\u0435\u0442\u043d\u044b\u043c\u0438 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f\u043c\u0438 \u0438 \u0434\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u044c\u0441\u0442\u0432\u0430\u043c\u0438.",
    score: "Score",
    risk: "\u0420\u0438\u0441\u043a",
    completion: "\u0413\u043e\u0442\u043e\u0432\u043e",
    confidence: "\u0414\u043e\u0432\u0435\u0440\u0438\u0435",
    backendOwned: "\u0420\u0430\u0441\u0447\u0451\u0442 backend",
    backendRisk: "\u0420\u0438\u0441\u043a backend",
    answered: "\u041e\u0442\u0432\u0435\u0447\u0435\u043d\u043e",
    separateSignal: "\u041e\u0442\u0434\u0435\u043b\u044c\u043d\u044b\u0439 \u0441\u0438\u0433\u043d\u0430\u043b",
    officialScore: "\u041e\u0444\u0438\u0446\u0438\u0430\u043b\u044c\u043d\u044b\u0439 score",
    topRisk: "\u0413\u043b\u0430\u0432\u043d\u044b\u0439 \u0440\u0438\u0441\u043a",
    priorityAction: "\u041f\u0440\u0438\u043e\u0440\u0438\u0442\u0435\u0442\u043d\u043e\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435",
    criticalFindings: "\u041a\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u043d\u0430\u0445\u043e\u0434\u043a\u0438",
    criticalFindingsDescription: "\u041a\u0440\u0430\u0442\u043a\u0438\u0439 \u0431\u0440\u0438\u0444 \u0438\u0437 backend findings \u0438 \u0433\u043b\u0430\u0432\u043d\u044b\u0445 \u0440\u0438\u0441\u043a\u043e\u0432.",
    prioritySteps: "\u041f\u0440\u0438\u043e\u0440\u0438\u0442\u0435\u0442\u043d\u044b\u0435 \u0448\u0430\u0433\u0438",
    priorityStepsDescription: "\u0421\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f, \u0432\u0435\u0440\u043d\u0443\u0442\u044b\u0435 backend.",
    items: "\u0448\u0442.",
    noFindings: "\u041a\u043e\u043c\u043f\u0430\u043a\u0442\u043d\u044b\u0445 findings \u043f\u043e\u043a\u0430 \u043d\u0435\u0442. \u041e\u0431\u043d\u043e\u0432\u0438 backend \u043e\u0442\u0447\u0451\u0442.",
    noSteps: "\u041f\u0440\u0438\u043e\u0440\u0438\u0442\u0435\u0442\u043d\u044b\u0445 \u0448\u0430\u0433\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.",
    domainRiskMap: "\u041a\u0430\u0440\u0442\u0430 \u0440\u0438\u0441\u043a\u0430 \u043f\u043e \u0434\u043e\u043c\u0435\u043d\u0430\u043c",
    domainRiskDescription: "\u0421\u0442\u0440\u043e\u043a\u0438 \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u044e\u0442 \u0442\u043e\u043b\u044c\u043a\u043e backend score \u0434\u043e\u043c\u0435\u043d\u043e\u0432.",
    domains: "\u0434\u043e\u043c\u0435\u043d\u043e\u0432",
    noRiskLabel: "\u041d\u0435\u0442 \u043c\u0435\u0442\u043a\u0438 \u0440\u0438\u0441\u043a\u0430",
    coverage: "\u041f\u043e\u043a\u0440\u044b\u0442\u0438\u0435",
    criticalNegatives: "\u043a\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0445 negative",
    whatIf: "\u0421\u0438\u043c\u0443\u043b\u044f\u0442\u043e\u0440 what-if",
    whatIfDescription: "\u041b\u043e\u043a\u0430\u043b\u044c\u043d\u044b\u0439 \u0441\u0446\u0435\u043d\u0430\u0440\u0438\u0439. \u041e\u0444\u0438\u0446\u0438\u0430\u043b\u044c\u043d\u044b\u0439 score \u043e\u0441\u0442\u0430\u0451\u0442\u0441\u044f \u0432 backend.",
    unofficialPreview: "\u041d\u0435\u043e\u0444\u0438\u0446\u0438\u0430\u043b\u044c\u043d\u044b\u0439 preview",
    reset: "\u0421\u0431\u0440\u043e\u0441",
    base: "\u0411\u0430\u0437\u0430",
    simulated: "\u0421\u0438\u043c\u0443\u043b\u044f\u0446\u0438\u044f",
    simulatorUnavailable: "\u0421\u0438\u043c\u0443\u043b\u044f\u0442\u043e\u0440 \u043f\u043e\u044f\u0432\u0438\u0442\u0441\u044f, \u043a\u043e\u0433\u0434\u0430 \u0432 backend \u043e\u0442\u0447\u0451\u0442\u0435 \u0435\u0441\u0442\u044c \u0434\u043e\u043c\u0435\u043d\u043d\u044b\u0435 score.",
    advisoryPreview: "\u0421\u0446\u0435\u043d\u0430\u0440\u043d\u044b\u0439 preview",
    simulatedScore: "\u0441\u0438\u043c\u0443\u043b\u0438\u0440\u0443\u0435\u043c\u044b\u0439 score",
    vsOfficial: "\u043a \u043e\u0444\u0438\u0446.",
    simulationNote: "Simulation only - official score remains backend-owned.",
    detailedNarrative: "\u0414\u0435\u0442\u0430\u043b\u044c\u043d\u044b\u0439 \u043d\u0430\u0440\u0440\u0430\u0442\u0438\u0432",
    expanded: "\u041e\u0442\u043a\u0440\u044b\u0442\u043e",
    collapsed: "\u0421\u043a\u0440\u044b\u0442\u043e \u043f\u043e \u0443\u043c\u043e\u043b\u0447\u0430\u043d\u0438\u044e",
    sourcesUsed: "\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u043d\u044b\u0435 \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0438",
    reference: "\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a",
    openSource: "\u041e\u0442\u043a\u0440\u044b\u0442\u044c",
    immediatePriority: "\u0421\u0440\u043e\u0447\u043d\u044b\u0439 \u043f\u0440\u0438\u043e\u0440\u0438\u0442\u0435\u0442",
    queuedAction: "\u0412 \u043e\u0447\u0435\u0440\u0435\u0434\u0438",
  },
} as const;

function r(language: UiLanguage, key: keyof typeof reportCopy.en): string {
  return reportCopy[language]?.[key] || reportCopy.en[key];
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function roundNumber(value: number) {
  return Math.round(Number.isFinite(value) ? value : 0);
}

function advisoryRiskLevel(score: number): RiskLevel {
  if (score >= 85) return "Low";
  if (score >= 65) return "Medium";
  if (score >= 40) return "High";
  return "Critical";
}

function toneAccent(tone: Tone): string {
  if (tone === "success") return "from-emerald-400 via-emerald-300 to-lime-200";
  if (tone === "warning") return "from-amber-300 via-amber-200 to-yellow-100";
  if (tone === "orange") return "from-orange-400 via-amber-300 to-yellow-100";
  if (tone === "danger") return "from-red-400 via-orange-300 to-amber-100";
  if (tone === "info") return "from-sky-400 via-cyan-300 to-blue-100";
  return "from-slate-300 via-slate-200 to-slate-100";
}

function toneTrack(tone: Tone): string {
  if (tone === "success") return "bg-emerald-400";
  if (tone === "warning") return "bg-amber-300";
  if (tone === "orange") return "bg-orange-400";
  if (tone === "danger") return "bg-red-400";
  if (tone === "info") return "bg-sky-400";
  return "bg-slate-300";
}

function badgeVariantForTone(tone: Tone): BadgeVariant {
  if (tone === "success") return "success";
  if (tone === "warning") return "warning";
  if (tone === "orange") return "orange";
  if (tone === "danger") return "danger";
  if (tone === "info") return "info";
  return "neutral";
}

function normalizeReportSources(report?: ReportResponse | null): ReportSource[] {
  if (!Array.isArray(report?.sources)) {
    return [];
  }

  return report.sources
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      name: String(item.name || "").trim(),
      url: typeof item.url === "string" ? item.url : undefined,
      usedFor: typeof item.used_for === "string" ? item.used_for : undefined,
    }))
    .filter((item) => item.name);
}

function ReportDisclosure({
  title,
  description,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <section className="report-panel rounded-[34px] px-6 py-6 sm:px-8">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div>
              <h4 className="text-[13px] font-semibold text-zinc-200">
                {title}
              </h4>
              <p className="mt-2 text-[15px] text-zinc-500">
                {description}
              </p>
            </div>
            <span
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-300 transition-transform duration-300",
                open && "rotate-180",
              )}
            >
              <ChevronDown className="h-4 w-4" />
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-4">{children}</div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

function ReportLoadingSkeleton() {
  return (
    <div className="report-scene space-y-6">
      <section className="report-panel rounded-[38px] px-7 py-8">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-32 rounded-full" />
          </div>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-24 w-full rounded-[28px]" />
        </div>
      </section>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-56 rounded-[30px]" />
        <Skeleton className="h-56 rounded-[30px]" />
      </div>
      <Skeleton className="h-72 rounded-[30px]" />
    </div>
  );
}

export default function ReportView({
  report,
  canGenerate,
  loading,
  onGenerate,
  language = "et",
}: {
  report?: ReportResponse | null;
  canGenerate: boolean;
  loading?: boolean;
  onGenerate: () => void;
  language?: UiLanguage;
}) {
  if (loading && !report) {
    return <ReportLoadingSkeleton />;
  }

  if (!report) {
    return (
      <EmptyState
        title={t(language, "noReportLoaded")}
        description={t(language, "noReportDescription")}
        icon={<FileText className="h-5 w-5" />}
        action={
          <Button
            type="button"
            variant="primary"
            disabled={!canGenerate || loading}
            onClick={onGenerate}
          >
            <RefreshCw className="h-4 w-4" />
            {t(language, "generateReport")}
          </Button>
        }
      />
    );
  }

  return (
    <ReportCockpit
      report={report}
      canGenerate={canGenerate}
      loading={loading}
      onGenerate={onGenerate}
      language={language}
    />
  );
}

function ReportCockpit({
  report,
  canGenerate,
  loading,
  onGenerate,
  language,
}: {
  report: ReportResponse;
  canGenerate: boolean;
  loading?: boolean;
  onGenerate: () => void;
  language: UiLanguage;
}) {
  const [narrativeOpen, setNarrativeOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [simulatorAdjustments, setSimulatorAdjustments] = useState<Record<string, number>>({});

  const domainEntries: Array<[string, DomainScore]> = useMemo(() => {
    const details = Object.entries(report.domain_details || {});
    if (details.length) {
      return details;
    }
    return Object.entries(report.domain_scores || {}).map(([domain, domainScore]) => [
      domain,
      { title: domain, score: domainScore },
    ]);
  }, [report.domain_details, report.domain_scores]);
  const completionRate = report.completion_rate ?? 0;
  const earlyPreview = isEarlyPreview(completionRate);
  const riskToneValue = riskToneForCompletion(report.risk_level, completionRate);
  const fallbackConfidence = scoreConfidenceLabel(completionRate).replace("Confidence ", "");
  const confidenceValue = report.overall_confidence || fallbackConfidence;
  const sources = normalizeReportSources(report);
  const summaryText =
    language === "et" && report.summary
      ? report.summary
      : localizedSummary(language, report.overall_score, report.risk_level, completionRate);
  const narrativeText =
    language === "et" && report.llm_report_text ? report.llm_report_text : report.llm_report_text || null;

  const sortedDomains = useMemo(
    () => [...domainEntries].sort((a, b) => Number(a[1]?.score ?? 0) - Number(b[1]?.score ?? 0)),
    [domainEntries],
  );
  const simulatorDomains = useMemo(
    () => sortedDomains.slice(0, Math.min(4, sortedDomains.length)),
    [sortedDomains],
  );

  useEffect(() => {
    const nextAdjustments: Record<string, number> = {};
    simulatorDomains.forEach(([domain]) => {
      nextAdjustments[domain] = 0;
    });
    setSimulatorAdjustments(nextAdjustments);
    setNarrativeOpen(false);
    setSourcesOpen(false);
  }, [report, simulatorDomains]);

  const criticalFindings: FindingLike[] = report.findings?.length
    ? [...report.findings]
        .map((rawFinding) => {
          const finding = localizedFinding(language, rawFinding);
          return {
            id: finding.id || finding.title || `${finding.domain || "finding"}-${finding.severity || "unknown"}`,
            title: finding.title || domainLabel(language, finding.domain),
            severity: finding.severity,
            domain: finding.domain,
            summary: finding.business_impact || finding.verification || finding.evidence,
            action: finding.recommended_fix,
          };
        })
        .sort(
          (a, b) =>
            (severityRank[String(b.severity || "").toLowerCase()] || 0) -
            (severityRank[String(a.severity || "").toLowerCase()] || 0),
        )
        .slice(0, 4)
    : (report.top_risks || []).slice(0, 4).map((risk, index) => ({
        id: `${risk.domain || risk.title || "risk"}-${index}`,
        title: domainLabel(language, risk.domain || risk.title),
        severity: risk.risk_level,
        domain: risk.domain,
        summary: localizedDomainRisk(language, risk.domain, risk.risk),
        action: risk.recommended_actions?.[0]
          ? localizeKnownText(language, risk.recommended_actions[0])
          : undefined,
      }));

  const prioritySteps =
    report.action_plan?.length
      ? report.action_plan.slice(0, 4).map((item, index) => ({
          id: `${item.title || "action"}-${index}`,
          title: item.title || localizeKnownText(language, report.next_steps?.[index] || "Next step"),
          meta: [item.domain ? domainLabel(language, item.domain) : null, item.owner ? `${t(language, "owner")}: ${valueLabel(language, item.owner)}` : null]
            .filter(Boolean)
            .join(" - "),
          tone: riskTone(item.priority),
        }))
      : (report.next_steps || []).slice(0, 4).map((step, index) => ({
          id: `${step}-${index}`,
          title: localizeKnownText(language, step),
          meta: index === 0 ? r(language, "immediatePriority") : r(language, "queuedAction"),
          tone: index === 0 ? riskTone(report.risk_level) : "neutral",
        }));

  const officialScore = roundNumber(report.overall_score ?? 0);
  const officialRisk = earlyPreview
    ? `${valueLabel(language, "preliminary")} (${riskLabel(language, report.risk_level)})`
    : riskLabel(language, report.risk_level);

  const simulatedDomainScores = domainEntries.map(([domain, detail]) => {
    const baseScore = roundNumber(Number(detail?.score ?? 0));
    return {
      domain,
      score: clamp(baseScore + (simulatorAdjustments[domain] || 0)),
    };
  });
  const simulatedScore = simulatedDomainScores.length
    ? roundNumber(
        simulatedDomainScores.reduce((total, item) => total + item.score, 0) /
          simulatedDomainScores.length,
      )
    : officialScore;
  const simulatedRisk = advisoryRiskLevel(simulatedScore);
  const simulatorDelta = simulatedScore - officialScore;
  const topFinding = criticalFindings[0];
  const topPriorityStep = prioritySteps[0];
  const metricItems: MetricStripItem[] = [
    {
      label: r(language, "score"),
      value: `${officialScore}/100`,
      detail: r(language, "backendOwned"),
    },
    {
      label: r(language, "risk"),
      value: officialRisk,
      detail: r(language, "backendRisk"),
    },
    {
      label: r(language, "completion"),
      value: `${completionRate}%`,
      detail: `${r(language, "answered")} ${report.answered_questions ?? 0}/${report.total_questions ?? 0}`,
    },
    {
      label: r(language, "confidence"),
      value: valueLabel(language, confidenceValue),
      detail: r(language, "separateSignal"),
    },
  ];

  return (
    <div className="report-scene space-y-5 text-zinc-100">
      <div className="flex justify-end">
        <Button
          type="button"
          disabled={!canGenerate || loading}
          onClick={onGenerate}
          className="rounded-full border-white/10 bg-white/[0.08] px-5 text-zinc-100 shadow-none hover:bg-white/[0.14]"
        >
          <RefreshCw className="h-4 w-4" />
          {t(language, "refreshReport")}
        </Button>
      </div>

      <ReportCockpitHero
        summary={summaryText}
        topFinding={
          topFinding
            ? {
                title: topFinding.title,
                meta: topFinding.domain ? domainLabel(language, topFinding.domain) : undefined,
              }
            : undefined
        }
        topAction={
          topPriorityStep
            ? {
                title: topPriorityStep.title,
                meta: topPriorityStep.meta,
              }
            : undefined
        }
        topFindingLabel={r(language, "topRisk")}
        topActionLabel={r(language, "priorityAction")}
        metrics={metricItems}
        score={officialScore}
        scoreTone={riskToneValue}
        scoreLabel={r(language, "officialScore")}
      />

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="report-panel rounded-[30px] px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-slate-200">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <div>
              <h4 className="text-[13px] font-semibold text-slate-200">
                {r(language, "criticalFindings")}
              </h4>
              <p className="mt-1 text-[14px] text-slate-500">
                {r(language, "criticalFindingsDescription")}
              </p>
              </div>
            </div>
            <Badge variant={criticalFindings.length ? badgeVariantForTone(riskToneValue) : "neutral"}>
              {criticalFindings.length || 0} {r(language, "items")}
            </Badge>
          </div>

          <div className="mt-4 grid gap-4">
            {criticalFindings.length ? (
              criticalFindings.map((finding) => (
                <article
                  key={finding.id}
                  className="report-row rounded-2xl px-4 py-3.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={badgeVariantForTone(riskTone(finding.severity))}>
                      {riskLabel(language, finding.severity || "High")}
                    </Badge>
                    {finding.domain ? (
                      <Badge variant="neutral" className="border-white/8 bg-white/[0.04] text-slate-200">
                        {domainLabel(language, finding.domain)}
                      </Badge>
                    ) : null}
                  </div>
                  <h5 className="mt-3 text-lg font-semibold tracking-normal text-white">{finding.title}</h5>
                  {finding.summary ? (
                    <p className="mt-2 text-[15px] leading-7 text-zinc-400">{finding.summary}</p>
                  ) : null}
                  {finding.action ? (
                    <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-slate-300">
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                      <span>{finding.action}</span>
                    </p>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/8 bg-white/[0.02] p-4 text-sm leading-6 text-slate-500">
                {r(language, "noFindings")}
              </div>
            )}
          </div>
        </section>

        <section className="report-panel rounded-[30px] px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-slate-200">
              <Target className="h-5 w-5" />
            </span>
            <div>
              <h4 className="text-[13px] font-semibold text-slate-200">
                {r(language, "prioritySteps")}
              </h4>
              <p className="mt-1 text-[14px] text-slate-500">
                {r(language, "priorityStepsDescription")}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {prioritySteps.length ? (
              prioritySteps.map((step, index) => (
                <article
                  key={step.id}
                  className="flex gap-3 pt-1"
                >
                  <div className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold text-slate-950 shadow-[0_10px_20px_rgba(255,255,255,0.08)]",
                    `bg-gradient-to-br ${toneAccent(step.tone)}`,
                  )}>
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="text-lg font-semibold tracking-normal text-white">{step.title}</h5>
                    <p className="mt-1 text-[15px] leading-6 text-zinc-500">{step.meta}</p>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/8 bg-white/[0.02] p-4 text-sm leading-6 text-slate-500">
                {r(language, "noSteps")}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="report-panel rounded-[30px] px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-slate-200">
              <Radar className="h-5 w-5" />
            </span>
            <div>
              <h4 className="text-[13px] font-semibold text-slate-200">
                {r(language, "domainRiskMap")}
              </h4>
              <p className="mt-1 text-[14px] text-slate-500">
                {r(language, "domainRiskDescription")}
              </p>
            </div>
          </div>
          <Badge variant="neutral" className="border-white/8 bg-white/[0.04] text-slate-200">
            {domainEntries.length} {r(language, "domains")}
          </Badge>
        </div>

        <div className="mt-5 grid gap-2.5 lg:grid-cols-2">
          {sortedDomains.map(([domain, detail], index) => {
            const score = clamp(roundNumber(Number(detail?.score ?? 0)));
            const domainTone = riskToneForCompletion(detail?.risk_level, completionRate);
            return (
              <article
                key={domain}
                className="report-row rounded-2xl px-4 py-3"
                style={{ animationDelay: `${120 + index * 60}ms` }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h5 className="text-[15px] font-semibold tracking-normal text-white">{domainLabel(language, domain)}</h5>
                    <p className="mt-0.5 text-[13px] text-slate-500">
                      {detail?.risk_level ? riskLabel(language, detail.risk_level) : r(language, "noRiskLabel")}
                      {report.domain_confidence?.[domain]
                        ? ` - ${valueLabel(language, report.domain_confidence[domain])} ${t(language, "confidence").toLowerCase()}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-semibold tracking-normal text-white">{score}</div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">/100</div>
                  </div>
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/8">
                  <div
                    className={cn("report-bar-fill h-full rounded-full", toneTrack(domainTone))}
                    style={{ width: `${score}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  {detail?.answered_questions !== undefined && detail?.total_questions !== undefined ? (
                    <span>
                      {r(language, "coverage")} {detail.answered_questions}/{detail.total_questions}
                    </span>
                  ) : null}
                  {detail?.critical_negative_answers?.length ? (
                    <span>{detail.critical_negative_answers.length} {r(language, "criticalNegatives")}</span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="report-panel rounded-[30px] px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-slate-200">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h4 className="text-[13px] font-semibold text-slate-200">
                {r(language, "whatIf")}
              </h4>
              <p className="mt-1 max-w-2xl text-[14px] leading-6 text-slate-500">
                {r(language, "whatIfDescription")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="warning">{r(language, "unofficialPreview")}</Badge>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setSimulatorAdjustments((current) =>
                  Object.fromEntries(Object.keys(current).map((domain) => [domain, 0])),
                )
              }
              className="border border-white/8 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
            >
              <RotateCcw className="h-4 w-4" />
              {r(language, "reset")}
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_280px]">
          <div className="space-y-2.5">
            {simulatorDomains.length ? (
              simulatorDomains.map(([domain, detail]) => {
                const baseScore = clamp(roundNumber(Number(detail?.score ?? 0)));
                const simulatedValue = clamp(baseScore + (simulatorAdjustments[domain] || 0));
                return (
                  <div key={domain} className="report-row rounded-2xl px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[15px] font-semibold tracking-normal text-white">
                          {domainLabel(language, domain)}
                        </div>
                        <div className="mt-1 text-[13px] text-slate-500">
                          {r(language, "base")} {baseScore} {"->"} {r(language, "simulated")} {simulatedValue}
                        </div>
                      </div>
                      <Badge variant={badgeVariantForTone(riskTone(advisoryRiskLevel(simulatedValue)))}>
                        +{simulatorAdjustments[domain] || 0}
                      </Badge>
                    </div>
                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="report-bar-fill h-full rounded-full bg-gradient-to-r from-amber-300 via-sky-300 to-emerald-300"
                        style={{ width: `${simulatedValue}%` }}
                      />
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={simulatorBump}
                      step={2}
                      value={simulatorAdjustments[domain] || 0}
                      onChange={(event) =>
                        setSimulatorAdjustments((current) => ({
                          ...current,
                          [domain]: Number(event.target.value),
                        }))
                      }
                      className="mt-3 w-full accent-amber-300"
                    />
                  </div>
                );
              })
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/8 bg-white/[0.02] p-4 text-sm leading-6 text-slate-500">
                {r(language, "simulatorUnavailable")}
              </div>
            )}
          </div>

          <div className="report-panel-soft rounded-[26px] px-5 py-5">
            <div className="text-[13px] font-semibold text-slate-500">
              {r(language, "advisoryPreview")}
            </div>
            <div className="mt-4 flex items-end gap-3">
              <div className="text-5xl font-semibold tracking-normal text-white">{simulatedScore}</div>
              <div className="pb-1 text-sm text-slate-500">{r(language, "simulatedScore")}</div>
            </div>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/8">
              <div
                className={cn(
                  "report-bar-fill h-full rounded-full bg-gradient-to-r",
                  toneAccent(riskTone(simulatedRisk)),
                )}
                style={{ width: `${simulatedScore}%` }}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant={badgeVariantForTone(riskTone(simulatedRisk))}>
                {riskLabel(language, simulatedRisk)}
              </Badge>
              <Badge variant={simulatorDelta > 0 ? "success" : "neutral"}>
                {simulatorDelta >= 0 ? "+" : ""}
                {simulatorDelta} {r(language, "vsOfficial")}
              </Badge>
            </div>
            <p className="mt-4 text-[14px] leading-6 text-slate-500">
              {r(language, "simulationNote")} {officialScore}/100.
            </p>
          </div>
        </div>
      </section>

      {narrativeText || report.external_exposure_self_check?.items?.length ? (
        <ReportDisclosure
          title={r(language, "detailedNarrative")}
          description={narrativeOpen ? r(language, "expanded") : r(language, "collapsed")}
          open={narrativeOpen}
          onOpenChange={setNarrativeOpen}
        >
          <div className="space-y-5 text-sm leading-7 text-slate-400">
            <p className="max-w-3xl">{summaryText}</p>
            {narrativeText ? (
              <div className="report-panel-soft rounded-[24px] px-5 py-4 text-slate-300">
                {narrativeText}
              </div>
            ) : null}
            {report.external_exposure_self_check?.items?.length ? (
              <div className="report-panel-soft rounded-[24px] px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h5 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
                    {t(language, "externalExposure")}
                  </h5>
                  <Badge variant="neutral">{t(language, "advisoryOnly")}</Badge>
                  <Badge variant="success">{t(language, "noScanning")}</Badge>
                </div>
                <ul className="mt-4 space-y-2">
                  {report.external_exposure_self_check.items.slice(0, 6).map((item) => (
                    <li
                      key={item.id}
                      className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-slate-400"
                    >
                      {localizedExposureQuestion(language, item)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </ReportDisclosure>
      ) : null}

      {sources.length ? (
        <ReportDisclosure
          title={r(language, "sourcesUsed")}
          description={sourcesOpen ? r(language, "expanded") : r(language, "collapsed")}
          open={sourcesOpen}
          onOpenChange={setSourcesOpen}
        >
          <Separator className="mb-4 bg-white/6" />
          <div className="space-y-3">
            {sources.map((source) => (
              <article
                key={`${source.name}-${source.url || ""}`}
                className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-3.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">{r(language, "reference")}</Badge>
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-cyan-300 transition-colors hover:text-cyan-200"
                    >
                      {r(language, "openSource")}
                    </a>
                  ) : null}
                </div>
                <h5 className="mt-3 text-[15px] font-semibold text-white">{source.name}</h5>
                {source.usedFor ? (
                  <p className="mt-2 text-sm leading-6 text-slate-400">{source.usedFor}</p>
                ) : null}
              </article>
            ))}
          </div>
        </ReportDisclosure>
      ) : null}
    </div>
  );
}
