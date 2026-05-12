import { FileText, RefreshCw } from "lucide-react";
import type { DomainScore, ReportResponse } from "../types/api";
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
import { Badge, Button, Card, EmptyState, MetricCard, Progress } from "./ui";

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
  const riskTone = riskToneForCompletion(report.risk_level, completionRate);
  const fallbackConfidence = scoreConfidenceLabel(completionRate).replace("Confidence ", "");
  const confidenceValue = report.overall_confidence || fallbackConfidence;
  const confidenceText = earlyPreview
    ? `${valueLabel(language, "Low")} ${t(language, "confidence").toLowerCase()}: ${
        report.answered_questions ?? 0
      } / ${report.total_questions ?? 0}.`
    : `${t(language, "confidence")}: ${valueLabel(language, confidenceValue)}`;
  const summaryText =
    language === "et" && report.summary
      ? report.summary
      : localizedSummary(language, report.overall_score, report.risk_level, completionRate);
  const narrativeText =
    language === "et" && report.llm_report_text ? report.llm_report_text : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">{t(language, "readinessReport")}</h3>
          <p className="mt-1 text-sm text-slate-500">{t(language, "officialScoreBackend")}</p>
        </div>
        <Button type="button" disabled={!canGenerate || loading} onClick={onGenerate}>
          <RefreshCw className="h-4 w-4" />
          {t(language, "refreshReport")}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard
          label={t(language, "overallScore")}
          value={
            earlyPreview && report.overall_score !== undefined
              ? valueLabel(language, "preliminary")
              : report.overall_score !== undefined
                ? `${report.overall_score}/100`
                : "-"
          }
          caption={
            earlyPreview && report.overall_score !== undefined
              ? `${t(language, "backend")}: ${report.overall_score}/100. ${confidenceText}`
              : confidenceText
          }
          tone={riskTone}
        />
        <MetricCard
          label={t(language, "riskLevel")}
          value={earlyPreview ? valueLabel(language, "preliminary") : riskLabel(language, report.risk_level)}
          caption={
            earlyPreview && report.risk_level
              ? `${t(language, "backend")}: ${riskLabel(language, report.risk_level)}`
              : undefined
          }
          tone={riskTone}
        />
        <MetricCard
          label={t(language, "completion")}
          value={`${completionRate}%`}
          progress={completionRate}
          tone={report.score_status === "final" ? "success" : "warning"}
        />
        <MetricCard
          label={t(language, "confidence")}
          value={valueLabel(language, confidenceValue)}
          caption={t(language, "separateFromScore")}
          tone={report.overall_confidence === "High" ? "success" : report.overall_confidence === "Low" ? "warning" : "info"}
        />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={report.score_status === "final" ? "success" : "warning"}>
            {earlyPreview ? valueLabel(language, "preliminary") : valueLabel(language, report.score_status || "preliminary")}
          </Badge>
          <Badge tone={earlyPreview ? "warning" : "info"}>{confidenceText}</Badge>
          <Badge tone="neutral">
            {report.is_complete ? valueLabel(language, "final") : valueLabel(language, "preliminary")}
          </Badge>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-700">{summaryText}</p>
        {narrativeText ? (
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            {narrativeText}
          </div>
        ) : null}
      </Card>

      <Card className="p-4">
        <h4 className="text-sm font-semibold text-slate-950">{t(language, "domainScores")}</h4>
        <div className="mt-4 space-y-4">
          {domainEntries.map(([domain, detail]) => {
            const score = Number(detail?.score ?? 0);
            return (
              <div key={domain}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-800">{domainLabel(language, domain)}</span>
                  <span className="text-slate-500">
                    {score}/100
                    {report.domain_confidence?.[domain]
                      ? ` - ${valueLabel(language, report.domain_confidence[domain])} ${t(language, "confidence").toLowerCase()}`
                      : ""}
                  </span>
                </div>
                <Progress
                  value={score}
                  tone={riskToneForCompletion(detail?.risk_level, completionRate)}
                />
              </div>
            );
          })}
        </div>
      </Card>

      {report.findings?.length ? (
        <Card className="p-4">
          <h4 className="text-sm font-semibold text-slate-950">{t(language, "findings")}</h4>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {report.findings.map((rawFinding) => {
              const finding = localizedFinding(language, rawFinding);
              return (
                <article key={finding.id || finding.title} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{finding.title}</span>
                    <Badge tone={riskToneForCompletion(finding.severity, 100)}>
                      {riskLabel(language, finding.severity || "Finding")}
                    </Badge>
                    {finding.domain ? <Badge tone="neutral">{domainLabel(language, finding.domain)}</Badge> : null}
                  </div>
                  {finding.business_impact ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600">{finding.business_impact}</p>
                  ) : null}
                  {finding.recommended_fix ? (
                    <p className="mt-2 text-sm leading-6 text-slate-700">{finding.recommended_fix}</p>
                  ) : null}
                  {finding.verification ? (
                    <p className="mt-2 text-xs leading-5 text-slate-500">{finding.verification}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    {finding.owner ? <Badge tone="neutral">{t(language, "owner")}: {valueLabel(language, finding.owner)}</Badge> : null}
                    {finding.deadline ? <Badge tone="warning">{t(language, "deadline")}: {valueLabel(language, finding.deadline)}</Badge> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <h4 className="text-sm font-semibold text-slate-950">{t(language, "topRisks")}</h4>
          <div className="mt-3 space-y-3">
            {report.top_risks?.length ? (
              report.top_risks.map((risk, index) => (
                <div key={`${risk.domain}-${index}`} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{domainLabel(language, risk.domain || risk.title)}</span>
                    <Badge tone={riskToneForCompletion(risk.risk_level, completionRate)}>
                      {earlyPreview ? valueLabel(language, "preliminary") : riskLabel(language, risk.risk_level || String(risk.score || ""))}
                    </Badge>
                  </div>
                  {risk.risk ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600">{localizedDomainRisk(language, risk.domain, risk.risk)}</p>
                  ) : null}
                  {risk.recommended_actions?.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                      {risk.recommended_actions.slice(0, 3).map((action) => (
                        <li key={action}>{localizeKnownText(language, action)}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">{t(language, "topRisks")}.</p>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="text-sm font-semibold text-slate-950">{t(language, "nextSteps")}</h4>
          <div className="mt-3 space-y-2">
            {report.next_steps?.length ? (
              report.next_steps.map((step) => (
                <div
                  key={step}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
                >
                  {localizeKnownText(language, step)}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">{t(language, "nextSteps")}.</p>
            )}
          </div>
        </Card>
      </div>

      {report.external_exposure_self_check?.items?.length ? (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-950">{t(language, "externalExposure")}</h4>
            <Badge tone="neutral">{t(language, "advisoryOnly")}</Badge>
            <Badge tone="success">{t(language, "noScanning")}</Badge>
          </div>
          {report.external_exposure_self_check.note && language === "et" ? (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {report.external_exposure_self_check.note}
            </p>
          ) : null}
          <ul className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
            {report.external_exposure_self_check.items.slice(0, 6).map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                {localizedExposureQuestion(language, item)}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
