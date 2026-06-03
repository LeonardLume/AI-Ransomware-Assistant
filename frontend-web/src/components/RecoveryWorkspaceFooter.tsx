import type { ReportResponse, SessionStateResponse } from "../types/api";

function valueOrDash(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}

function roundScore(value: unknown): number {
  const numberValue = Number(value ?? 0);
  return Math.round(Number.isFinite(numberValue) ? numberValue : 0);
}

export default function RecoveryWorkspaceFooter({
  session,
  report,
}: {
  session?: SessionStateResponse | null;
  report?: ReportResponse | null;
}) {
  const proof = session?.recovery_proof || report?.recovery_proof || null;
  const evidenceCount =
    proof?.evidence_items_count ??
    session?.recovery_evidence?.length ??
    report?.evidence_checklist?.length ??
    0;
  const proofScore = roundScore(report?.recovery_proof_score ?? proof?.recovery_proof_score);
  const confidence = roundScore(report?.evidence_confidence ?? proof?.evidence_confidence);
  const proofGaps = proof?.proof_gaps || report?.proof_gaps || [];
  const tickets = proof?.remediation_tickets || report?.remediation_tickets || [];
  const verdict = proof
    ? proofScore >= 80
      ? "Recovery is defensible"
      : proofScore >= 50
        ? "Recovery is partially defensible"
        : "Recovery is not defensible yet"
    : "Awaiting recovery evidence";

  const items = [
    {
      label: "Evidence imported",
      value: String(evidenceCount),
      detail: evidenceCount ? "Ready for proof review" : "Import backup, M365, Wazuh, Prowler, or manual files",
    },
    {
      label: "Recovery proof",
      value: proof ? `${proofScore}/100` : "-",
      detail: proof ? `${confidence}/100 evidence confidence` : "Run Recovery Proof after import",
    },
    {
      label: "Proof gaps",
      value: String(proofGaps.length),
      detail: proofGaps.length ? "Missing defensible evidence" : "No gaps shown yet",
    },
    {
      label: "MSP tickets",
      value: String(tickets.length),
      detail: tickets.length ? "Remediation work ready" : "Generated from proof gaps",
    },
  ];

  return (
    <footer className="sticky bottom-0 z-20 mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#07080b]/95 shadow-[0_-18px_54px_rgba(0,0,0,0.38)] backdrop-blur-xl">
      <div className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(210px,0.8fr)_minmax(0,2.4fr)] lg:items-center">
        <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2">
          <div className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Recovery verdict
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-100">
            {valueOrDash(verdict)}
          </div>
        </div>

        <div className="grid min-w-0 gap-2 text-xs text-slate-400 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.label}
              className="min-w-0 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2"
            >
              <div className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {item.label}
              </div>
              <div className="mt-0.5 truncate text-sm font-semibold text-slate-100">{item.value}</div>
              <div className="mt-0.5 truncate text-[11px] text-slate-500">{item.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
