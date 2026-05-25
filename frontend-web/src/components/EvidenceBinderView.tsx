import type { ReportResponse } from "../types/api";
import {
  domainLabel,
  localizeKnownText,
  skillTitle,
  t,
  type UiLanguage,
} from "../utils/i18n";
import { EmptyState } from "./ui";
import ArtifactTitleInfo from "./ArtifactTitleInfo";

export default function EvidenceBinderView({
  report,
  language = "et",
}: {
  report?: ReportResponse | null;
  language?: UiLanguage;
}) {
  const groups = report?.evidence_checklist || [];
  const totalItems = groups.reduce((total, group) => total + (group.items?.length || 0), 0);

  if (!groups.length) {
    return (
      <div className="report-scene relative overflow-hidden rounded-[38px] border border-white/[0.08] p-4 text-zinc-100 shadow-[0_28px_90px_rgba(0,0,0,0.22)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_0%,rgba(125,211,252,0.10),transparent_34%),radial-gradient(circle_at_78%_12%,rgba(255,255,255,0.055),transparent_32%)]" />
        <div className="relative space-y-6">
          <section className="report-panel rounded-[34px] px-6 py-10 text-center sm:px-8">
            <div className="inline-flex items-center justify-center gap-3">
              <h2 className="text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl">
                {t(language, "evidenceBinder")}
              </h2>
              <ArtifactTitleInfo kind="evidenceBinder" language={language} />
            </div>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
              {t(language, "evidenceBinderDescription")}
            </p>
          </section>
          <EmptyState
            title={t(language, "noReportLoaded")}
            description={t(language, "noReportDescription")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="report-scene relative overflow-hidden rounded-[38px] border border-white/[0.08] p-4 text-zinc-100 shadow-[0_28px_90px_rgba(0,0,0,0.22)] sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(125,211,252,0.10),transparent_34%),radial-gradient(circle_at_82%_10%,rgba(255,255,255,0.055),transparent_32%)]" />

      <div className="relative space-y-7">
        <section className="report-panel relative rounded-[34px] px-6 py-10 sm:px-8 lg:min-h-[250px] lg:px-10 lg:py-12">
          <div className="mx-auto flex max-w-3xl flex-col items-center justify-center text-center lg:min-h-[170px]">
            <div className="inline-flex items-center justify-center gap-3">
              <h2 className="text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl">
                {t(language, "evidenceBinder")}
              </h2>
              <ArtifactTitleInfo kind="evidenceBinder" language={language} />
            </div>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
              {t(language, "evidenceBinderDescription")}
            </p>
          </div>

          <div className="mx-auto mt-7 w-full max-w-[168px] rounded-[24px] border border-white/[0.08] bg-black/[0.18] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] lg:absolute lg:right-5 lg:top-5 lg:mt-0">
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                {evidenceCountLabel(language)}
              </div>
              <div className="mt-0.5 text-3xl font-semibold leading-none tracking-[-0.06em] text-white">
                {totalItems}
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-4">
          {groups.map((group) => {
            const title =
              group.domain
                ? domainLabel(language, group.domain)
                : localizeKnownText(language, group.title) || evidenceLabel(language);
            const skillName = group.based_on_skill
              ? skillTitle(language, { id: group.based_on_skill, title: group.based_on_skill })
              : null;
            const items = group.items || [];

            return (
              <section
                key={`${group.domain}-${group.based_on_skill || group.title}`}
                className="report-panel rounded-[32px] px-5 py-6 sm:px-7"
              >
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">
                      {title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      {skillName || t(language, "backendChecklist")}
                      {group.nist_csf?.length ? ` - NIST CSF: ${group.nist_csf.join(", ")}` : ""}
                    </p>
                  </div>
                  <div className="text-sm font-medium text-slate-500">
                    {items.length} / {totalItems}
                  </div>
                </div>

                <div className="mt-6 divide-y divide-white/[0.06] rounded-[26px] border border-white/[0.07] bg-white/[0.022]">
                  {items.map((item) => (
                    <article key={item} className="px-4 py-4 sm:px-5">
                      <p className="text-sm leading-6 text-slate-300">
                        {localizeKnownText(language, item)}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function evidenceLabel(language: UiLanguage): string {
  if (language === "en") return "Evidence";
  if (language === "ru") return "Доказательство";
  return "Tõend";
}

function evidenceCountLabel(language: UiLanguage): string {
  if (language === "en") return "Evidence";
  if (language === "ru") return "Доказательства";
  return "Tõendid";
}
