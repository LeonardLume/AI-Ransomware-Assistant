import { ClipboardCheck, LifeBuoy, RotateCcw, ShieldCheck } from "lucide-react";
import type { ReportResponse } from "../types/api";
import { Badge, riskTone } from "./ProgressCard";

export default function RansomwarePlaybookView({ report }: { report?: ReportResponse | null }) {
  const topActions = report?.action_plan?.slice(0, 6) || [];
  const evidence = report?.evidence_checklist?.slice(0, 4) || [];
  const risks = report?.top_risks?.slice(0, 3) || [];

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Ransomware Playbook</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              A defensive operating view built from backend report recommendations and evidence
              requirements. It does not calculate score.
            </p>
          </div>
          <Badge tone={riskTone(report?.risk_level)}>{report?.risk_level || "No report"}</Badge>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-4">
        {[
          {
            title: "Prepare",
            icon: ShieldCheck,
            text: "Confirm backups, MFA, patch ownership, admin access review, and response contacts.",
          },
          {
            title: "Contain",
            icon: LifeBuoy,
            text: "Escalate internally, isolate affected systems, preserve evidence, and call trusted providers.",
          },
          {
            title: "Recover",
            icon: RotateCcw,
            text: "Restore from validated backups, track RTO/RPO, and verify business-critical systems.",
          },
          {
            title: "Improve",
            icon: ClipboardCheck,
            text: "Close gaps, collect proof, and run a tabletop exercise with decision makers.",
          },
        ].map((phase) => {
          const Icon = phase.icon;
          return (
            <article key={phase.title} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <Icon className="h-4 w-4" />
                {phase.title}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{phase.text}</p>
            </article>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-950">Priority actions</h4>
          <div className="mt-3 space-y-3">
            {topActions.length ? (
              topActions.map((action, index) => (
                <div key={`${action.title}-${index}`} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={riskTone(action.priority)}>{action.priority || "Priority"}</Badge>
                    {action.domain ? <Badge tone="neutral">{action.domain}</Badge> : null}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {action.title || "Action"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Owner: {action.owner || action.owner_suggestion || "-"} · Deadline:{" "}
                    {action.deadline || "-"}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Generate a report to populate playbook actions.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-950">Evidence to gather</h4>
          <div className="mt-3 space-y-3">
            {evidence.length ? (
              evidence.map((group) => (
                <div key={`${group.domain}-${group.based_on_skill}`} className="rounded-lg bg-slate-50 p-3">
                  <div className="text-sm font-semibold text-slate-900">
                    {group.title || group.domain}
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-5 text-slate-600">
                    {(group.items || []).slice(0, 3).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Evidence checklist will appear after report generation.</p>
            )}
          </div>
        </section>
      </div>

      {risks.length ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-950">Watch areas</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {risks.map((risk) => (
              <div key={`${risk.domain}-${risk.title}`} className="rounded-lg border border-slate-200 p-3">
                <Badge tone={riskTone(risk.risk_level)}>{risk.risk_level || risk.score}</Badge>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {risk.title || risk.domain}
                </div>
                {risk.risk ? (
                  <p className="mt-1 text-xs leading-5 text-slate-500">{risk.risk}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
