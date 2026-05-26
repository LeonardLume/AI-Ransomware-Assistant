import { ExternalLink, FileSearch, Link2, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import type { ReportResponse, SourceLink } from "../types/api";
import {
  domainLabel,
  localizeKnownText,
  skillTitle,
  t,
  type UiLanguage,
} from "../utils/i18n";
import { EmptyState } from "./ui";
import ArtifactTitleInfo from "./ArtifactTitleInfo";
import IncompleteReportBadge from "./IncompleteReportBadge";

export default function EvidenceBinderView({
  report,
  language = "et",
}: {
  report?: ReportResponse | null;
  language?: UiLanguage;
}) {
  const groups = report?.evidence_checklist || [];
  const totalItems = groups.reduce((total, group) => total + (group.items?.length || 0), 0);
  const reportSources = normalizeReportSources(report);

  if (!groups.length) {
    return (
      <div className="report-scene relative overflow-hidden rounded-[38px] border border-white/[0.08] p-4 text-zinc-100 shadow-[0_28px_90px_rgba(0,0,0,0.22)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_0%,rgba(125,211,252,0.10),transparent_34%),radial-gradient(circle_at_78%_12%,rgba(255,255,255,0.055),transparent_32%)]" />
        <div className="relative space-y-6">
          <section className="report-panel rounded-[34px] px-6 py-10 text-center sm:px-8">
            <div className="inline-flex flex-wrap items-center justify-center gap-3">
              <h2 className="text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl">
                {t(language, "evidenceBinder")}
              </h2>
              <ArtifactTitleInfo kind="evidenceBinder" language={language} />
            </div>
            <div className="mt-3">
              <IncompleteReportBadge report={report} language={language} />
            </div>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
              {t(language, "evidenceBinderDescription")}
            </p>
            <ProvenanceStrip
              report={report}
              sourceCount={reportSources.length}
              totalItems={totalItems}
              language={language}
            />
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
            <div className="inline-flex flex-wrap items-center justify-center gap-3">
              <h2 className="text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl">
                {t(language, "evidenceBinder")}
              </h2>
              <ArtifactTitleInfo kind="evidenceBinder" language={language} />
            </div>
            <div className="mt-3">
              <IncompleteReportBadge report={report} language={language} />
            </div>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
              {t(language, "evidenceBinderDescription")}
            </p>
            <ProvenanceStrip
              report={report}
              sourceCount={reportSources.length}
              totalItems={totalItems}
              language={language}
            />
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
            const sourceLinks = normalizeSourceLinks(group.source_links);
            const evidenceExamples = (group.evidence_examples || []).slice(0, 4);

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
                <SourceTracePanel
                  sourceLinks={sourceLinks.length ? sourceLinks : reportSources.slice(0, 3)}
                  evidenceExamples={evidenceExamples}
                  language={language}
                />
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type NormalizedSource = {
  name: string;
  url?: string;
  publisher?: string;
  note?: string;
  usedFor?: string;
};

function normalizeReportSources(report?: ReportResponse | null): NormalizedSource[] {
  if (!Array.isArray(report?.sources)) {
    return [];
  }

  return report.sources
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      name: String(item.name || "").trim(),
      url: typeof item.url === "string" ? item.url : undefined,
      usedFor: typeof item.used_for === "string" ? item.used_for : undefined,
    }))
    .filter((item) => item.name);
}

function normalizeSourceLinks(sourceLinks?: SourceLink[]): NormalizedSource[] {
  return (sourceLinks || [])
    .map((source) => ({
      name: String(source.name || source.id || "").trim(),
      url: source.url,
      publisher: source.publisher,
      note: source.note,
    }))
    .filter((source) => source.name);
}

function ProvenanceStrip({
  report,
  sourceCount,
  totalItems,
  language,
}: {
  report?: ReportResponse | null;
  sourceCount: number;
  totalItems: number;
  language: UiLanguage;
}) {
  const copy = evidenceCopy(language);
  const methodologyVersion = report?.methodology?.methodology_version || "0.3.0";
  const scoringVersion = report?.methodology?.scoring_version || "2026-05-22";

  return (
    <div className="mt-7 grid w-full gap-3 text-left sm:grid-cols-3">
      <ProvenanceFact
        icon={<ShieldCheck className="h-4 w-4" />}
        label={copy.provenance}
        value={copy.backendGenerated}
        detail={copy.backendGeneratedDetail}
      />
      <ProvenanceFact
        icon={<FileSearch className="h-4 w-4" />}
        label={copy.methodology}
        value={`v${methodologyVersion}`}
        detail={`${copy.scoringVersion}: ${scoringVersion}`}
      />
      <ProvenanceFact
        icon={<Link2 className="h-4 w-4" />}
        label={copy.traceability}
        value={`${sourceCount} ${copy.sources}`}
        detail={`${totalItems} ${copy.evidenceItems}`}
      />
    </div>
  );
}

function ProvenanceFact({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        <span className="text-sky-300">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-white">{value}</div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function SourceTracePanel({
  sourceLinks,
  evidenceExamples,
  language,
}: {
  sourceLinks: NormalizedSource[];
  evidenceExamples: string[];
  language: UiLanguage;
}) {
  const copy = evidenceCopy(language);
  if (!sourceLinks.length && !evidenceExamples.length) {
    return null;
  }

  return (
    <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
      {sourceLinks.length ? (
        <div className="rounded-[24px] border border-sky-300/[0.12] bg-sky-300/[0.035] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200/80">
            <Link2 className="h-3.5 w-3.5" />
            {copy.sourceLinks}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {sourceLinks.slice(0, 4).map((source) =>
              source.url ? (
                <a
                  key={`${source.name}-${source.url}`}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/[0.10] bg-black/[0.20] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-sky-300/40 hover:text-white"
                  title={source.note || source.usedFor || source.name}
                >
                  <span className="truncate">{source.publisher || source.name}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ) : (
                <span
                  key={source.name}
                  className="inline-flex max-w-full rounded-full border border-white/[0.08] bg-black/[0.18] px-3 py-1.5 text-xs font-medium text-slate-300"
                  title={source.note || source.name}
                >
                  <span className="truncate">{source.publisher || source.name}</span>
                </span>
              ),
            )}
          </div>
        </div>
      ) : null}

      {evidenceExamples.length ? (
        <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <FileSearch className="h-3.5 w-3.5" />
            {copy.examples}
          </div>
          <ul className="mt-3 space-y-2">
            {evidenceExamples.map((example) => (
              <li key={example} className="text-xs leading-5 text-slate-400">
                {localizeKnownText(language, example)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function evidenceCopy(language: UiLanguage) {
  if (language === "en") {
    return {
      provenance: "Provenance",
      backendGenerated: "Backend generated",
      backendGeneratedDetail: "Checklist comes from matched skills and report domains.",
      methodology: "Methodology",
      scoringVersion: "Scoring",
      traceability: "Traceability",
      sources: "sources",
      evidenceItems: "evidence items",
      sourceLinks: "Source links",
      examples: "Evidence examples",
    };
  }
  if (language === "ru") {
    return {
      provenance: "Происхождение",
      backendGenerated: "Сформировано backend",
      backendGeneratedDetail: "Checklist взят из matched skills и доменов отчёта.",
      methodology: "Методология",
      scoringVersion: "Scoring",
      traceability: "Трассировка",
      sources: "источников",
      evidenceItems: "доказательств",
      sourceLinks: "Ссылки на источники",
      examples: "Примеры evidence",
    };
  }
  return {
    provenance: "Päritolu",
    backendGenerated: "Taustsüsteemi loodud",
    backendGeneratedDetail: "Checklist tuleb sobitatud oskustest ja raporti domeenidest.",
    methodology: "Metoodika",
    scoringVersion: "Skooring",
    traceability: "Jälgitavus",
    sources: "allikat",
    evidenceItems: "tõendit",
    sourceLinks: "Allikalingid",
    examples: "Tõendite näited",
  };
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
