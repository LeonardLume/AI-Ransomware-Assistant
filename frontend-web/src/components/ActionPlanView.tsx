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
import { EmptyState } from "./ui";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Separator } from "./ui/separator";
import { riskTone } from "./ui-helpers";

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
          <Card key={phase} className="border-white/10 bg-white/[0.07]">
            <CardHeader className="pb-4">
              <CardTitle>{phaseLabel(language, phase as PhaseKey)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {phaseItems.map((item, index) => (
                <article
                  key={`${item.title}-${index}`}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={badgeVariant(riskTone(item.priority))}>
                      {riskLabel(language, item.priority || t(language, "priority"))}
                    </Badge>
                    {item.domain ? <Badge variant="neutral">{domainLabel(language, item.domain)}</Badge> : null}
                  </div>
                  <h4 className="mt-3 text-sm font-semibold leading-6 text-white">
                    {localizeKnownText(language, item.title) || actionItemLabel(language)}
                  </h4>
                  <Separator className="my-3 bg-white/6" />
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <span>{t(language, "owner")}: {valueLabel(language, item.owner || item.owner_suggestion)}</span>
                    <span>{t(language, "effort")}: {effortLabel(language, item.effort)}</span>
                    <span className="col-span-2">{t(language, "deadline")}: {valueLabel(language, item.deadline)}</span>
                  </div>
                </article>
              ))}
            </CardContent>
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
  if (language === "ru") return "Ð”ÐµÐ¹ÑÑ‚Ð²Ð¸Ðµ";
  return "Tegevus";
}

function badgeVariant(tone: ReturnType<typeof riskTone>) {
  if (tone === "success") return "success" as const;
  if (tone === "warning") return "warning" as const;
  if (tone === "orange") return "orange" as const;
  if (tone === "danger") return "danger" as const;
  return "neutral" as const;
}
