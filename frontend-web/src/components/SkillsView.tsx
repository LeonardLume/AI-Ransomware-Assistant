import type { ReportResponse, SkillReference } from "../types/api";
import {
  domainLabel,
  skillTitle,
  t,
  valueLabel,
  type UiLanguage,
} from "../utils/i18n";
import { EmptyState } from "./ui";

export default function SkillsView({
  report,
  language = "et",
}: {
  report?: ReportResponse | null;
  language?: UiLanguage;
}) {
  const skills = report?.skill_references || [];

  if (!skills.length) {
    return (
      <div className="report-scene relative overflow-hidden rounded-[38px] border border-white/[0.08] p-4 text-zinc-100 shadow-[0_28px_90px_rgba(0,0,0,0.22)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(125,211,252,0.09),transparent_34%),radial-gradient(circle_at_82%_10%,rgba(255,255,255,0.05),transparent_32%)]" />
        <div className="relative space-y-6">
          <SkillsHeader
            language={language}
            description={t(language, "skillsDescription")}
          />
          <EmptyState
            title={t(language, "skillsNotLoaded")}
            description={t(language, "skillsNotLoadedDescription")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="report-scene relative overflow-hidden rounded-[38px] border border-white/[0.08] p-4 text-zinc-100 shadow-[0_28px_90px_rgba(0,0,0,0.22)] sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(125,211,252,0.09),transparent_34%),radial-gradient(circle_at_82%_10%,rgba(255,255,255,0.05),transparent_32%)]" />

      <div className="relative space-y-6">
        <SkillsHeader
          language={language}
          description={t(language, "skillsMatchedDescription")}
          count={skills.length}
        />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {skills.map((skill) => (
            <SkillTile
              key={skill.id || skill.title}
              skill={skill}
              language={language}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SkillsHeader({
  language,
  description,
  count,
}: {
  language: UiLanguage;
  description: string;
  count?: number;
}) {
  return (
    <section className="report-panel rounded-[34px] px-6 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <h2 className="text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl">
            {t(language, "skills")}
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-400">
            {description}
          </p>
        </div>

        {count !== undefined ? (
          <div className="flex items-center gap-3 rounded-[22px] border border-white/[0.07] bg-black/[0.14] px-4 py-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Skills
              </div>
              <div className="mt-0.5 text-2xl font-semibold leading-none tracking-[-0.05em] text-white">
                {count}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SkillTile({
  skill,
  language,
}: {
  skill: SkillReference;
  language: UiLanguage;
}) {
  return (
    <article className="group rounded-[28px] border border-white/[0.065] bg-white/[0.026] px-5 py-5 backdrop-blur-xl transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]">
      <div className="flex min-h-full flex-col gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-7 tracking-[-0.03em] text-white">
            {skillTitle(language, skill)}
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {skill.domain ? domainLabel(language, skill.domain) : fallbackDomainLabel(language)}
            {skill.safe_use ? ` - ${valueLabel(language, skill.safe_use)}` : ""}
          </p>
        </div>

        {skill.nist_csf?.length ? (
          <p className="text-sm leading-6 text-slate-400">
            <span className="text-slate-500">NIST CSF:</span> {skill.nist_csf.join(", ")}
          </p>
        ) : null}

        {skill.tags?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {skill.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/[0.08] bg-black/[0.14] px-3 py-1 text-xs font-medium text-slate-300"
              >
                {valueLabel(language, tag)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function fallbackDomainLabel(language: UiLanguage): string {
  if (language === "en") return "Defensive skill";
  if (language === "ru") return "Defensive skill";
  return "Kaitsev oskus";
}
