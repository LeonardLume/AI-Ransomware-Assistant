import { FileText, RefreshCw } from "lucide-react";
import type { DomainScore, ReportResponse } from "../types/api";
import {
  isEarlyPreview,
  riskToneForCompletion,
  scoreConfidenceLabel,
} from "../utils/assessmentUi";
import { Badge, Button, Card, EmptyState, MetricCard, Progress } from "./ui";

export default function ReportView({
  report,
  canGenerate,
  loading,
  onGenerate,
}: {
  report?: ReportResponse | null;
  canGenerate: boolean;
  loading?: boolean;
  onGenerate: () => void;
}) {
  if (!report) {
    return (
      <EmptyState
        title="No report loaded"
        description="A report can be generated from the current backend session. It uses deterministic scoring from scoring_rules.json and optional LLM wording from the backend."
        icon={<FileText className="h-5 w-5" />}
        action={
          <Button
            type="button"
            variant="primary"
            disabled={!canGenerate || loading}
            onClick={onGenerate}
          >
            <RefreshCw className="h-4 w-4" />
            Generate report
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
  const confidenceText = earlyPreview
    ? `Low confidence because only ${report.answered_questions ?? 0} / ${
        report.total_questions ?? 0
      } required answers are collected.`
    : scoreConfidenceLabel(completionRate);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Readiness report</h3>
          <p className="mt-1 text-sm text-slate-500">
            Official score and risk level are returned by FastAPI.
          </p>
        </div>
        <Button type="button" disabled={!canGenerate || loading} onClick={onGenerate}>
          <RefreshCw className="h-4 w-4" />
          Refresh report
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard
          label="Overall score"
          value={
            earlyPreview && report.overall_score !== undefined
              ? "Early preview"
              : report.overall_score !== undefined
                ? `${report.overall_score}/100`
                : "-"
          }
          caption={
            earlyPreview && report.overall_score !== undefined
              ? `Backend score: ${report.overall_score}/100. ${confidenceText}`
              : confidenceText
          }
          tone={riskTone}
        />
        <MetricCard
          label="Risk level"
          value={earlyPreview ? "Early preview" : report.risk_level || "-"}
          caption={
            earlyPreview && report.risk_level ? `Backend risk: ${report.risk_level}` : undefined
          }
          tone={riskTone}
        />
        <MetricCard
          label="Completion"
          value={`${completionRate}%`}
          progress={completionRate}
          tone={report.score_status === "final" ? "success" : "warning"}
        />
        <MetricCard
          label="Confidence"
          value={report.overall_confidence || scoreConfidenceLabel(completionRate).replace("Confidence ", "")}
          caption="Separate from score"
          tone={report.overall_confidence === "High" ? "success" : report.overall_confidence === "Low" ? "warning" : "info"}
        />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={report.score_status === "final" ? "success" : "warning"}>
            {earlyPreview ? "Early preview" : report.score_status || "preliminary"}
          </Badge>
          <Badge tone={earlyPreview ? "warning" : "info"}>{scoreConfidenceLabel(completionRate)}</Badge>
          <Badge tone="neutral">
            {report.is_complete ? "all required questions answered" : "preliminary assessment"}
          </Badge>
        </div>
        {report.summary ? (
          <p className="mt-3 text-sm leading-6 text-slate-700">{report.summary}</p>
        ) : null}
        {report.llm_report_text ? (
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            {report.llm_report_text}
          </div>
        ) : null}
      </Card>

      <Card className="p-4">
        <h4 className="text-sm font-semibold text-slate-950">Domain scores</h4>
        <div className="mt-4 space-y-4">
          {domainEntries.map(([domain, detail]) => {
            const score = Number(detail?.score ?? 0);
            return (
              <div key={domain}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-800">{detail?.title || domain}</span>
                  <span className="text-slate-500">
                    {score}/100
                    {report.domain_confidence?.[domain] ? ` · ${report.domain_confidence[domain]} confidence` : ""}
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
          <h4 className="text-sm font-semibold text-slate-950">Findings</h4>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {report.findings.map((finding) => (
              <article key={finding.id || finding.title} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{finding.title}</span>
                  <Badge tone={riskToneForCompletion(finding.severity, 100)}>
                    {finding.severity || "Finding"}
                  </Badge>
                  {finding.domain ? <Badge tone="neutral">{finding.domain}</Badge> : null}
                </div>
                {finding.business_impact ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">{finding.business_impact}</p>
                ) : null}
                {finding.recommended_fix ? (
                  <p className="mt-2 text-sm leading-6 text-slate-700">{finding.recommended_fix}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  {finding.owner ? <Badge tone="neutral">Owner: {finding.owner}</Badge> : null}
                  {finding.deadline ? <Badge tone="warning">Deadline: {finding.deadline}</Badge> : null}
                </div>
              </article>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <h4 className="text-sm font-semibold text-slate-950">Top risks</h4>
          <div className="mt-3 space-y-3">
            {report.top_risks?.length ? (
              report.top_risks.map((risk, index) => (
                <div key={`${risk.domain}-${index}`} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{risk.title || risk.domain}</span>
                    <Badge tone={riskToneForCompletion(risk.risk_level, completionRate)}>
                      {earlyPreview ? "preview" : risk.risk_level || risk.score}
                    </Badge>
                  </div>
                  {risk.risk ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600">{risk.risk}</p>
                  ) : null}
                  {risk.recommended_actions?.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                      {risk.recommended_actions.slice(0, 3).map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Top risks will appear in backend reports.</p>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="text-sm font-semibold text-slate-950">Next steps</h4>
          <div className="mt-3 space-y-2">
            {report.next_steps?.length ? (
              report.next_steps.map((step) => (
                <div
                  key={step}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
                >
                  {step}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Next steps will appear in backend reports.</p>
            )}
          </div>
        </Card>
      </div>

      {report.external_exposure_self_check?.items?.length ? (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-950">External exposure self-check</h4>
            <Badge tone="neutral">advisory only</Badge>
            <Badge tone="success">no scanning</Badge>
          </div>
          {report.external_exposure_self_check.note ? (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {report.external_exposure_self_check.note}
            </p>
          ) : null}
          <ul className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
            {report.external_exposure_self_check.items.slice(0, 6).map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                {item.question || item.id}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
