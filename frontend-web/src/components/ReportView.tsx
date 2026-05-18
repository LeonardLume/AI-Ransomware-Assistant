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
import { useEffect, useId, useState, type ComponentProps, type ReactNode } from "react";
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
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { Skeleton } from "./ui/skeleton";
import { cn, riskTone, type Tone } from "./ui-helpers";

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

function toneColor(tone: Tone): string {
  if (tone === "success") return "#34d399";
  if (tone === "warning") return "#fbbf24";
  if (tone === "orange") return "#fb923c";
  if (tone === "danger") return "#f87171";
  if (tone === "info") return "#38bdf8";
  return "#cbd5e1";
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

function useCountUp(target: number, duration = 1000) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const safeTarget = roundNumber(target);
    let frame = 0;
    let startTime = 0;
    const startValue = value;

    const tick = (timestamp: number) => {
      if (!startTime) {
        startTime = timestamp;
      }
      const progress = clamp((timestamp - startTime) / duration, 0, 1);
      const eased = 1 - (1 - progress) * (1 - progress) * (1 - progress);
      const nextValue = Math.round(startValue + (safeTarget - startValue) * eased);
      setValue(nextValue);
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target]);

  return value;
}

function ScoreRing({
  value,
  tone,
  label,
  caption,
}: {
  value: number;
  tone: Tone;
  label: string;
  caption: string;
}) {
  const ringId = useId().replace(/:/g, "");
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const safeValue = clamp(value);
  const dashOffset = circumference - (safeValue / 100) * circumference;
  const animatedValue = useCountUp(safeValue, 1200);

  return (
    <div className="report-panel-soft report-hover-lift relative mx-auto flex w-full max-w-[248px] flex-col items-center rounded-[30px] px-7 py-7 text-center">
      <div className="text-[10px] uppercase tracking-[0.34em] text-slate-400">
        {label}
      </div>
      <div className="relative mt-4 h-40 w-40">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <defs>
            <linearGradient id={`ring-${ringId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={toneColor(tone)} />
              <stop offset="100%" stopColor="rgba(255,255,255,0.95)" />
            </linearGradient>
          </defs>
          <circle
            cx="80"
            cy="80"
            r={radius}
            className="fill-none stroke-white/10"
            strokeWidth="14"
          />
          <circle
            cx="80"
            cy="80"
            r={radius}
            className="report-ring-progress fill-none"
            stroke={`url(#ring-${ringId})`}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-5xl font-semibold leading-none text-white/95">
            {animatedValue}
          </div>
          <div className="mt-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">
            / 100
          </div>
        </div>
      </div>
      <p className="mt-5 max-w-[17rem] text-sm leading-6 text-slate-400">{caption}</p>
    </div>
  );
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
      <section className="report-panel rounded-[30px] px-6 py-5">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">
                {title}
              </h4>
              <p className="mt-2 text-sm text-slate-500">
                {description}
              </p>
            </div>
            <span
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-slate-300 transition-transform duration-300",
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
      <section className="report-panel rounded-[34px] px-7 py-7">
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

  const domainEntries: Array<[string, DomainScore]> = Object.entries(
    report.domain_details || {},
  ).length
    ? Object.entries(report.domain_details || {})
    : Object.entries(report.domain_scores || {}).map(([domain, domainScore]) => [
        domain,
        { title: domain, score: domainScore },
      ]);
  const completionRate = report.completion_rate ?? 0;
  const earlyPreview = isEarlyPreview(completionRate);
  const riskToneValue = riskToneForCompletion(report.risk_level, completionRate);
  const fallbackConfidence = scoreConfidenceLabel(completionRate).replace("Confidence ", "");
  const confidenceValue = report.overall_confidence || fallbackConfidence;
  const confidenceText = earlyPreview
    ? `${valueLabel(language, "Low")} ${t(language, "confidence").toLowerCase()}: ${
        report.answered_questions ?? 0
      } / ${report.total_questions ?? 0}.`
    : `${t(language, "confidence")}: ${valueLabel(language, confidenceValue)}`;
  const sources = normalizeReportSources(report);
  const summaryText =
    language === "et" && report.summary
      ? report.summary
      : localizedSummary(language, report.overall_score, report.risk_level, completionRate);
  const narrativeText =
    language === "et" && report.llm_report_text ? report.llm_report_text : report.llm_report_text || null;

  const sortedDomains = [...domainEntries].sort(
    (a, b) => Number(a[1]?.score ?? 0) - Number(b[1]?.score ?? 0),
  );
  const simulatorDomains = sortedDomains.slice(0, Math.min(4, sortedDomains.length));

  useEffect(() => {
    const nextAdjustments: Record<string, number> = {};
    simulatorDomains.forEach(([domain]) => {
      nextAdjustments[domain] = 0;
    });
    setSimulatorAdjustments(nextAdjustments);
    setNarrativeOpen(false);
    setSourcesOpen(false);
  }, [report]);

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
          meta: index === 0 ? "Immediate priority" : "Queued action",
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
  const simulatedCount = useCountUp(simulatedScore, 900);

  return (
    <div className="report-scene space-y-6 text-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.34em] text-slate-400">
            Official backend report
          </p>
          <h3 className="mt-3 text-[2rem] font-semibold tracking-[-0.03em] text-white">
            Readiness Cockpit
          </h3>
        </div>
        <Button
          type="button"
          disabled={!canGenerate || loading}
          onClick={onGenerate}
          className="border-white/10 bg-white/[0.06] text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.16)] hover:bg-white/[0.09]"
        >
          <RefreshCw className="h-4 w-4" />
          {t(language, "refreshReport")}
        </Button>
      </div>

      <section className="report-fade-up report-fade-up-delay-1 report-panel report-hero relative overflow-hidden rounded-[34px] px-7 py-7">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_0%,rgba(255,255,255,0.09),transparent_22%),radial-gradient(circle_at_84%_12%,rgba(255,255,255,0.06),transparent_18%)] opacity-90" />
        <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_272px] xl:items-center">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral" className="border-white/8 bg-white/[0.045] text-slate-200">
                {t(language, "officialScoreBackend")}
              </Badge>
              <Badge variant={report.score_status === "final" ? "success" : "warning"}>
                {earlyPreview
                  ? valueLabel(language, "preliminary")
                  : valueLabel(language, report.score_status || "preliminary")}
              </Badge>
              <Badge variant={badgeVariantForTone(riskToneValue)}>{officialRisk}</Badge>
              <Badge variant={report.is_complete ? "success" : "warning"}>
                {completionRate}% {t(language, "completion").toLowerCase()}
              </Badge>
              <Badge variant="info">{confidenceText}</Badge>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(250px,0.85fr)]">
              <div className="space-y-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
                    Executive summary
                  </p>
                  <p className="mt-3 max-w-2xl text-[15px] leading-8 text-slate-200/90">{summaryText}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="report-stat-slab report-hover-lift rounded-[24px] px-4 py-4">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                      {t(language, "overallScore")}
                    </div>
                    <div className="mt-2 text-[2rem] font-semibold tracking-[-0.03em] text-white">{officialScore}</div>
                    <div className="mt-2 text-sm text-slate-500">
                      Backend-authoritative
                    </div>
                  </div>
                  <div className="report-stat-slab report-hover-lift rounded-[24px] px-4 py-4">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                      {t(language, "riskLevel")}
                    </div>
                    <div className="mt-2 text-[1.6rem] font-semibold tracking-[-0.03em] text-white">{officialRisk}</div>
                    <div className="mt-2 text-sm text-slate-500">{t(language, "backend")}</div>
                  </div>
                  <div className="report-stat-slab report-hover-lift rounded-[24px] px-4 py-4">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                      Signal
                    </div>
                    <div className="mt-2 text-[1.6rem] font-semibold tracking-[-0.03em] text-white">
                      {valueLabel(language, confidenceValue)}
                    </div>
                    <div className="mt-2 text-sm text-slate-500">{t(language, "separateFromScore")}</div>
                  </div>
                </div>
              </div>

              <ScoreRing
                value={officialScore}
                tone={riskToneValue}
                label="Official score"
                caption="Animated display only. Numeric authority stays with the backend report."
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="report-fade-up report-fade-up-delay-2 report-panel rounded-[30px] px-6 py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-slate-200">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">
                  Compact critical findings
                </h4>
                <p className="mt-2 text-sm text-slate-500">
                  Short-form briefing from backend findings and top risks.
                </p>
              </div>
            </div>
            <Badge variant={criticalFindings.length ? badgeVariantForTone(riskToneValue) : "neutral"}>
              {criticalFindings.length || 0} items
            </Badge>
          </div>

          <div className="mt-4 grid gap-3">
            {criticalFindings.length ? (
              criticalFindings.map((finding) => (
                <article
                  key={finding.id}
                  className="report-row report-hover-lift rounded-[22px] px-4 py-3.5"
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
                  <h5 className="mt-3 text-[15px] font-semibold text-white">{finding.title}</h5>
                  {finding.summary ? (
                    <p className="mt-2 text-sm leading-6 text-slate-400">{finding.summary}</p>
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
                No compact findings available yet. Generate or refresh the backend report to populate this briefing.
              </div>
            )}
          </div>
        </section>

        <section className="report-fade-up report-fade-up-delay-3 report-panel rounded-[30px] px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-slate-200">
              <Target className="h-5 w-5" />
            </span>
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">
                Priority next steps
              </h4>
              <p className="mt-2 text-sm text-slate-500">
                Compact frontend layout of backend next actions.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {prioritySteps.length ? (
              prioritySteps.map((step, index) => (
                <article
                  key={step.id}
                  className="report-row report-hover-lift flex gap-4 rounded-[22px] px-4 py-3.5"
                >
                  <div className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold text-slate-950 shadow-[0_10px_20px_rgba(255,255,255,0.08)]",
                    `bg-gradient-to-br ${toneAccent(step.tone)}`,
                  )}>
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="text-[15px] font-semibold text-white">{step.title}</h5>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{step.meta}</p>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/8 bg-white/[0.02] p-4 text-sm leading-6 text-slate-500">
                No prioritized next steps available yet.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="report-fade-up report-fade-up-delay-4 report-panel rounded-[30px] px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-slate-200">
              <Radar className="h-5 w-5" />
            </span>
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">
                Domain risk map
              </h4>
              <p className="mt-2 text-sm text-slate-500">
                Animated bars show backend domain scores only.
              </p>
            </div>
          </div>
          <Badge variant="neutral" className="border-white/8 bg-white/[0.04] text-slate-200">
            {domainEntries.length} domains
          </Badge>
        </div>

        <div className="mt-5 grid gap-2.5 lg:grid-cols-2">
          {sortedDomains.map(([domain, detail], index) => {
            const score = clamp(roundNumber(Number(detail?.score ?? 0)));
            const domainTone = riskToneForCompletion(detail?.risk_level, completionRate);
            return (
              <article
                key={domain}
                className="report-row report-hover-lift rounded-[20px] px-4 py-3.5"
                style={{ animationDelay: `${120 + index * 60}ms` }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h5 className="text-[15px] font-semibold text-white">{domainLabel(language, domain)}</h5>
                    <p className="mt-1 text-sm text-slate-500">
                      {detail?.risk_level ? riskLabel(language, detail.risk_level) : "No risk label"}
                      {report.domain_confidence?.[domain]
                        ? ` - ${valueLabel(language, report.domain_confidence[domain])} ${t(language, "confidence").toLowerCase()}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-[1.7rem] font-semibold tracking-[-0.03em] text-white">{score}</div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">/100</div>
                  </div>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8">
                  <div
                    className={cn("report-bar-fill h-full rounded-full", toneTrack(domainTone))}
                    style={{ width: `${score}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  {detail?.answered_questions !== undefined && detail?.total_questions !== undefined ? (
                    <span>
                      Coverage {detail.answered_questions}/{detail.total_questions}
                    </span>
                  ) : null}
                  {detail?.critical_negative_answers?.length ? (
                    <span>{detail.critical_negative_answers.length} critical negatives</span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="report-fade-up report-fade-up-delay-5 report-panel rounded-[30px] px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-slate-200">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">
                What-if Simulator
              </h4>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
                Frontend-only scenario tool. It never changes backend score, session data, questions,
                or the official report.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="warning">Unofficial preview</Badge>
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
              Reset
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_320px]">
          <div className="space-y-4">
            {simulatorDomains.length ? (
              simulatorDomains.map(([domain, detail]) => {
                const baseScore = clamp(roundNumber(Number(detail?.score ?? 0)));
                const simulatedValue = clamp(baseScore + (simulatorAdjustments[domain] || 0));
                return (
                  <div key={domain} className="report-row rounded-[20px] px-4 py-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[15px] font-semibold text-white">
                          {domainLabel(language, domain)}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          Base {baseScore} {"->"} Simulated {simulatedValue}
                        </div>
                      </div>
                      <Badge variant={badgeVariantForTone(riskTone(advisoryRiskLevel(simulatedValue)))}>
                        +{simulatorAdjustments[domain] || 0}
                      </Badge>
                    </div>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8">
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
                      className="mt-4 w-full accent-amber-300"
                    />
                  </div>
                );
              })
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/8 bg-white/[0.02] p-4 text-sm leading-6 text-slate-500">
                Simulator becomes available once domain scores exist in the backend report.
              </div>
            )}
          </div>

          <div className="report-panel-soft report-hover-lift rounded-[28px] px-5 py-5">
            <div className="text-[10px] uppercase tracking-[0.28em] text-slate-400">
              Advisory preview
            </div>
            <div className="mt-4 flex items-end gap-3">
              <div className="text-5xl font-semibold tracking-[-0.04em] text-white">{simulatedCount}</div>
              <div className="pb-1 text-sm text-slate-500">simulated score</div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8">
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
                {simulatorDelta} vs official
              </Badge>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-500">
              This cockpit only previews a local scenario by lifting the weakest domain scores.
              The official backend score remains {officialScore}/100.
            </p>
          </div>
        </div>
      </section>

      {narrativeText || report.external_exposure_self_check?.items?.length ? (
        <ReportDisclosure
          title="Detailed narrative"
          description={narrativeOpen ? "Expanded" : "Collapsed by default"}
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
          title="Sources used"
          description={sourcesOpen ? "Expanded" : "Collapsed by default"}
          open={sourcesOpen}
          onOpenChange={setSourcesOpen}
        >
          <Separator className="mb-4 bg-white/6" />
          <ScrollArea className="max-h-72 pr-3">
            <div className="space-y-3">
              {sources.map((source) => (
                <article
                  key={`${source.name}-${source.url || ""}`}
                  className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-3.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">Reference</Badge>
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-cyan-300 transition-colors hover:text-cyan-200"
                      >
                        Open source
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
          </ScrollArea>
        </ReportDisclosure>
      ) : null}
    </div>
  );
}
