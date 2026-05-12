import type { ActionItem, ReportResponse } from "../types/api";
import {
  domainLabel,
  effortLabel,
  localizeKnownText,
  riskLabel,
  t,
  valueLabel,
  type UiLanguage,
} from "../utils/i18n";
import { Badge, Card, EmptyState, riskTone } from "./ui";

const fallbackPhases: Array<{ key: PhaseKey; items: string[] }> = [
  {
    key: "48h",
    items: ["Confirm ransomware incident contacts", "Identify backup owner", "Review admin MFA coverage"],
  },
  {
    key: "14d",
    items: ["Run a backup restore test", "Document critical patch SLA", "Review privileged accounts"],
  },
  {
    key: "30d",
    items: ["Run a tabletop exercise", "Collect evidence binder items", "Finalize remediation owners"],
  },
];

type PhaseKey = "48h" | "14d" | "30d";

export default function ActionPlanView({
  report,
  language = "et",
}: {
  report?: ReportResponse | null;
  language?: UiLanguage;
}) {
  const items = report?.action_plan || [];

  if (!items.length) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-semibold text-white">{t(language, "actionPlan")}</h2>
          <p className="mt-2 text-sm text-slate-400">
            {t(language, "actionPlanDescription")}
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {fallbackPhases.map((phase) => (
            <Card key={phase.key} className="!border-white/10 !bg-white/[0.07] p-5 backdrop-blur-xl">
              <h3 className="text-base font-semibold text-white">{phaseLabel(language, phase.key)}</h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                {phase.items.map((item) => (
                  <li key={item} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    {localizeKnownText(language, item)}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        <EmptyState
          title={t(language, "noActionPlanTitle")}
          description={t(language, "noActionPlanDescription")}
        />
      </div>
    );
  }

  const grouped = groupItems(items);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-white">{t(language, "actionPlan")}</h2>
        <p className="mt-2 text-sm text-slate-400">
          {t(language, "actionPlanDescription")}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Object.entries(grouped).map(([phase, phaseItems]) => (
          <Card key={phase} className="!border-white/10 !bg-white/[0.07] p-5 backdrop-blur-xl">
            <h3 className="text-base font-semibold text-white">{phaseLabel(language, phase as PhaseKey)}</h3>
            <div className="mt-4 space-y-3">
              {phaseItems.map((item, index) => (
                <article
                  key={`${item.title}-${index}`}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={riskTone(item.priority)}>{riskLabel(language, item.priority || t(language, "priority"))}</Badge>
                    {item.domain ? <Badge tone="neutral">{domainLabel(language, item.domain)}</Badge> : null}
                  </div>
                  <h4 className="mt-3 text-sm font-semibold leading-6 text-white">
                    {localizeKnownText(language, item.title) || actionItemLabel(language)}
                  </h4>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <span>{t(language, "owner")}: {valueLabel(language, item.owner || item.owner_suggestion)}</span>
                    <span>{t(language, "effort")}: {effortLabel(language, item.effort)}</span>
                    <span className="col-span-2">{t(language, "deadline")}: {valueLabel(language, item.deadline)}</span>
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
  const groups: Record<PhaseKey, ActionItem[]> = {
    "48h": [],
    "14d": [],
    "30d": [],
  };
  items.forEach((item, index) => {
    if (index < Math.ceil(items.length / 3)) {
      groups["48h"].push(item);
    } else if (index < Math.ceil((items.length / 3) * 2)) {
      groups["14d"].push(item);
    } else {
      groups["30d"].push(item);
    }
  });
  return groups;
}

function phaseLabel(language: UiLanguage, phase: PhaseKey): string {
  if (phase === "48h") return t(language, "next48Hours");
  if (phase === "14d") return t(language, "next14Days");
  return t(language, "next30Days");
}

function actionItemLabel(language: UiLanguage): string {
  if (language === "en") return "Action item";
  if (language === "ru") return "Действие";
  return "Tegevus";
}
