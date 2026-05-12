import type { ActionItem, ReportResponse } from "../types/api";
import { Badge, Card, EmptyState, riskTone } from "./ui";

const fallbackPhases = [
  {
    title: "Next 48 hours",
    items: ["Confirm ransomware incident contacts", "Identify backup owner", "Review admin MFA coverage"],
  },
  {
    title: "Next 14 days",
    items: ["Run a backup restore test", "Document critical patch SLA", "Review privileged accounts"],
  },
  {
    title: "Next 30 days",
    items: ["Run a tabletop exercise", "Collect evidence binder items", "Finalize remediation owners"],
  },
];

export default function ActionPlanView({ report }: { report?: ReportResponse | null }) {
  const items = report?.action_plan || [];

  if (!items.length) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-semibold text-white">Action Plan</h2>
          <p className="mt-2 text-sm text-slate-400">
            Backend action-plan data will appear here after report generation.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {fallbackPhases.map((phase) => (
            <Card key={phase.title} className="!border-white/10 !bg-white/[0.07] p-5 backdrop-blur-xl">
              <h3 className="text-base font-semibold text-white">{phase.title}</h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                {phase.items.map((item) => (
                  <li key={item} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        <EmptyState
          title="No backend action plan yet"
          description="Complete the interview or load a demo profile to populate prioritized actions."
        />
      </div>
    );
  }

  const grouped = groupItems(items);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-white">Action Plan</h2>
        <p className="mt-2 text-sm text-slate-400">
          Prioritized remediation actions from the backend report.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Object.entries(grouped).map(([phase, phaseItems]) => (
          <Card key={phase} className="!border-white/10 !bg-white/[0.07] p-5 backdrop-blur-xl">
            <h3 className="text-base font-semibold text-white">{phase}</h3>
            <div className="mt-4 space-y-3">
              {phaseItems.map((item, index) => (
                <article
                  key={`${item.title}-${index}`}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={riskTone(item.priority)}>{item.priority || "Priority"}</Badge>
                    {item.domain ? <Badge tone="neutral">{item.domain}</Badge> : null}
                  </div>
                  <h4 className="mt-3 text-sm font-semibold leading-6 text-white">
                    {item.title || "Action item"}
                  </h4>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <span>Owner: {item.owner || item.owner_suggestion || "-"}</span>
                    <span>Effort: {item.effort || "-"}</span>
                    <span className="col-span-2">Deadline: {item.deadline || "-"}</span>
                  </div>
                </article>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function groupItems(items: ActionItem[]) {
  const groups: Record<string, ActionItem[]> = {
    "Next 48 hours": [],
    "Next 14 days": [],
    "Next 30 days": [],
  };
  items.forEach((item, index) => {
    if (index < Math.ceil(items.length / 3)) {
      groups["Next 48 hours"].push(item);
    } else if (index < Math.ceil((items.length / 3) * 2)) {
      groups["Next 14 days"].push(item);
    } else {
      groups["Next 30 days"].push(item);
    }
  });
  return groups;
}
