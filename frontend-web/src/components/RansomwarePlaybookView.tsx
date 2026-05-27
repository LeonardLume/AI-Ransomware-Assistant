import { ClipboardCheck, LifeBuoy, RotateCcw, ShieldCheck } from "lucide-react";
import type { ReportResponse } from "../types/api";
import { domainLabel, localizeKnownText, riskLabel, valueLabel } from "../utils/i18n";
import { Badge } from "./ProgressCard";
import { riskTone } from "./progress-card-helpers";

export default function RansomwarePlaybookView({ report }: { report?: ReportResponse | null }) {
  const language = "et";
  const topActions = report?.action_plan?.slice(0, 6) || [];
  const evidence = report?.evidence_checklist?.slice(0, 4) || [];
  const risks = report?.top_risks?.slice(0, 3) || [];

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Lunavara juhend</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Kaitsev töövaade, mis koondab raporti tegevused ja tõendinõuded.
              See ei arvuta tulemust.
            </p>
          </div>
          <Badge tone={riskTone(report?.risk_level)}>{report?.risk_level ? riskLabel(language, report.risk_level) : "Raport puudub"}</Badge>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-4">
        {[
          {
            title: "Valmista ette",
            icon: ShieldCheck,
            text: "Kinnita varukoopiad, MFA, paikamise omanik, administraatori ligipääsude ülevaatus ja reageerimiskontaktid.",
          },
          {
            title: "Ohjelda",
            icon: LifeBuoy,
            text: "Eskaleeri majasiseselt, isoleeri mõjutatud süsteemid, säilita tõendid ja võta ühendust usaldatud partneritega.",
          },
          {
            title: "Taasta",
            icon: RotateCcw,
            text: "Taasta kontrollitud varukoopiatest, jälgi RTO/RPO näitajaid ja kontrolli ärikriitilisi süsteeme.",
          },
          {
            title: "Paranda",
            icon: ClipboardCheck,
            text: "Sulge puudujäägid, kogu tõendid ja tee otsustajatega läbimänguharjutus.",
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
          <h4 className="text-sm font-semibold text-slate-950">Prioriteetsed tegevused</h4>
          <div className="mt-3 space-y-3">
            {topActions.length ? (
              topActions.map((action, index) => (
                <div key={`${action.title}-${index}`} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={riskTone(action.priority)}>{riskLabel(language, action.priority || "medium")}</Badge>
                    {action.domain ? <Badge tone="neutral">{domainLabel(language, action.domain)}</Badge> : null}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {localizeKnownText(language, action.title) || "Tegevus"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Omanik: {valueLabel(language, action.owner || action.owner_suggestion)} · Tähtaeg:{" "}
                    {valueLabel(language, action.deadline)}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Koosta raport, et juhendi tegevused ilmuksid.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-950">Kogutavad tõendid</h4>
          <div className="mt-3 space-y-3">
            {evidence.length ? (
              evidence.map((group) => (
                <div key={`${group.domain}-${group.based_on_skill}`} className="rounded-lg bg-slate-50 p-3">
                  <div className="text-sm font-semibold text-slate-900">
                    {localizeKnownText(language, group.title) || domainLabel(language, group.domain)}
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-5 text-slate-600">
                    {(group.items || []).slice(0, 3).map((item) => (
                      <li key={item}>{localizeKnownText(language, item)}</li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Tõendite kontrollnimekiri ilmub pärast raporti koostamist.</p>
            )}
          </div>
        </section>
      </div>

      {risks.length ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-950">Jälgitavad valdkonnad</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {risks.map((risk) => (
              <div key={`${risk.domain}-${risk.title}`} className="rounded-lg border border-slate-200 p-3">
                <Badge tone={riskTone(risk.risk_level)}>{risk.risk_level ? riskLabel(language, risk.risk_level) : risk.score}</Badge>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {localizeKnownText(language, risk.title) || domainLabel(language, risk.domain)}
                </div>
                {risk.risk ? (
                  <p className="mt-1 text-xs leading-5 text-slate-500">{localizeKnownText(language, risk.risk)}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
