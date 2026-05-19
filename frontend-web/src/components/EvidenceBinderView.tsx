import { CheckCircle2 } from "lucide-react";
import type { ReportResponse } from "../types/api";
import {
  domainLabel,
  localizeKnownText,
  skillTitle,
  t,
  type UiLanguage,
} from "../utils/i18n";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { EmptyState } from "./ui";

export default function EvidenceBinderView({
  report,
  language = "et",
}: {
  report?: ReportResponse | null;
  language?: UiLanguage;
}) {
  const groups = report?.evidence_checklist || [];
  const hasBackendEvidence = Boolean(groups.length);

  if (!hasBackendEvidence) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-white">{t(language, "evidenceBinder")}</h2>
            <p className="mt-2 text-sm text-slate-400">
              {t(language, "evidenceBinderDescription")}
            </p>
          </div>
        </div>
        <EmptyState
          title={t(language, "noReportLoaded")}
          description={t(language, "noReportDescription")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-white">{t(language, "evidenceBinder")}</h2>
          <p className="mt-2 text-sm text-slate-400">
            {t(language, "evidenceBinderDescription")}
          </p>
        </div>
        <Badge variant={hasBackendEvidence ? "success" : "warning"}>
          {hasBackendEvidence ? t(language, "backendChecklist") : t(language, "placeholderChecklist")}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => {
          const title =
            group.domain
              ? domainLabel(language, group.domain)
              : localizeKnownText(language, group.title) || evidenceLabel(language);
          const skillBadge = group.based_on_skill
            ? skillTitle(language, { id: group.based_on_skill, title: group.based_on_skill })
            : null;

          return (
            <Card
              key={`${group.domain}-${group.based_on_skill || group.title}`}
              className="border-white/10 bg-white/[0.07] p-5"
            >
              <div className="text-left">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="info">{domainLabel(language, group.domain || "domain")}</Badge>
                  {skillBadge ? <Badge variant="neutral">{skillBadge}</Badge> : null}
                </div>
                <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
                {group.nist_csf?.length ? (
                  <p className="mt-1 text-xs text-slate-500">NIST CSF: {group.nist_csf.join(", ")}</p>
                ) : null}
              </div>
              <ScrollArea className="mt-4 max-h-72 pr-3">
                <ul className="space-y-3 text-sm leading-6 text-slate-300">
                  {(group.items || []).map((item) => (
                    <li key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                      <span>{localizeKnownText(language, item)}</span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function evidenceLabel(language: UiLanguage): string {
  if (language === "en") return "Evidence";
  if (language === "ru") return "Ð”Ð¾ÐºÐ°Ð·Ð°Ñ‚ÐµÐ»ÑŒÑÑ‚Ð²Ð¾";
  return "TÃµend";
}
