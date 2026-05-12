import { CheckCircle2 } from "lucide-react";
import type { EvidenceItem, ReportResponse } from "../types/api";
import { Badge, Card } from "./ui";

const placeholderEvidence: EvidenceItem[] = [
  {
    domain: "backups",
    title: "Backups and restore",
    items: ["restore test date", "backup isolation method"],
  },
  {
    domain: "mfa",
    title: "MFA",
    items: ["MFA coverage", "admin MFA"],
  },
  {
    domain: "patching",
    title: "Patching",
    items: ["critical patch SLA"],
  },
  {
    domain: "admin_rights",
    title: "Admin rights",
    items: ["admin review date"],
  },
  {
    domain: "incident_response",
    title: "Incident response",
    items: ["IR contact list", "tabletop exercise date"],
  },
];

export default function EvidenceBinderView({ report }: { report?: ReportResponse | null }) {
  const hasBackendEvidence = Boolean(report?.evidence_checklist?.length);
  const groups = hasBackendEvidence ? report?.evidence_checklist || [] : placeholderEvidence;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-white">Evidence Binder</h2>
          <p className="mt-2 text-sm text-slate-400">
            Checklist grouped by domain. Evidence supports audit readiness but does not calculate score.
          </p>
        </div>
        <Badge tone={hasBackendEvidence ? "success" : "warning"}>
          {hasBackendEvidence ? "backend checklist" : "placeholder checklist"}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <Card
            key={`${group.domain}-${group.based_on_skill || group.title}`}
            className="!border-white/10 !bg-white/[0.07] p-5 backdrop-blur-xl"
          >
            <div className="flex flex-wrap gap-2">
              <Badge tone="info">{group.domain || "domain"}</Badge>
              {group.based_on_skill ? <Badge tone="neutral">{group.based_on_skill}</Badge> : null}
            </div>
            <h3 className="mt-4 text-base font-semibold text-white">
              {group.title || group.based_on_skill || "Evidence"}
            </h3>
            {group.nist_csf?.length ? (
              <p className="mt-1 text-xs text-slate-500">NIST CSF: {group.nist_csf.join(", ")}</p>
            ) : null}
            <ul className="mt-4 space-y-3 text-sm leading-5 text-slate-300">
              {(group.items || []).map((item) => (
                <li key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
