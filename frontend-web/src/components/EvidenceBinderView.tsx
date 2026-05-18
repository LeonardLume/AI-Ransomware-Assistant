import { CheckCircle2 } from "lucide-react";
import type { EvidenceItem, ReportResponse } from "../types/api";
import {
  domainLabel,
  localizeKnownText,
  skillTitle,
  t,
  type UiLanguage,
} from "../utils/i18n";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";

const placeholderEvidence: EvidenceItem[] = [
  {
    domain: "backups",
    title: "Backups and restore",
    items: ["Backup policy or backup job schedule", "Restore test date and result"],
  },
  {
    domain: "mfa_access",
    title: "MFA and access",
    items: ["MFA coverage report for email, cloud, and remote access"],
  },
  {
    domain: "patching",
    title: "Patching",
    items: ["Patch management process or responsibility matrix"],
  },
  {
    domain: "admin_rights",
    title: "Admin rights",
    items: ["Current privileged user list"],
  },
  {
    domain: "incident_response",
    title: "Incident response",
    items: ["Incident response plan document"],
  },
];

export default function EvidenceBinderView({
  report,
  language = "et",
}: {
  report?: ReportResponse | null;
  language?: UiLanguage;
}) {
  const hasBackendEvidence = Boolean(report?.evidence_checklist?.length);
  const groups = hasBackendEvidence ? report?.evidence_checklist || [] : placeholderEvidence;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
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
        {groups.map((group, index) => {
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
              <Accordion type="single" collapsible defaultValue={index === 0 ? "items" : undefined}>
                <AccordionItem value="items" className="border-0 bg-transparent">
                  <AccordionTrigger className="px-0 py-0 hover:no-underline">
                    <div className="pr-3 text-left">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="info">{domainLabel(language, group.domain || "domain")}</Badge>
                        {skillBadge ? <Badge variant="neutral">{skillBadge}</Badge> : null}
                      </div>
                      <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
                      {group.nist_csf?.length ? (
                        <p className="mt-1 text-xs text-slate-500">NIST CSF: {group.nist_csf.join(", ")}</p>
                      ) : null}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-0 pb-0 pt-4">
                    <ScrollArea className="max-h-64 pr-3">
                      <ul className="space-y-3 text-sm leading-5 text-slate-300">
                        {(group.items || []).map((item) => (
                          <li key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                            <span>{localizeKnownText(language, item)}</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
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
