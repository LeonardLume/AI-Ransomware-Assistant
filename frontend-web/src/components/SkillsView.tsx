import { ExternalLink } from "lucide-react";
import type { ReportResponse, SkillReference } from "../types/api";
import {
  domainLabel,
  skillTitle,
  t,
  valueLabel,
  type UiLanguage,
} from "../utils/i18n";
import { EmptyState } from "./ui";
import ArtifactTitleInfo from "./ArtifactTitleInfo";
import IncompleteReportBadge from "./IncompleteReportBadge";

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
            report={report}
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
          report={report}
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
  report,
}: {
  language: UiLanguage;
  description: string;
  count?: number;
  report?: ReportResponse | null;
}) {
  return (
    <section className="report-panel rounded-[34px] px-6 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl">
              {t(language, "skills")}
            </h2>
            <ArtifactTitleInfo kind="skills" language={language} />
          </div>
          <div className="mt-3">
            <IncompleteReportBadge report={report} language={language} />
          </div>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-400">
            {description}
          </p>
        </div>

        {count !== undefined ? (
          <div className="flex items-center gap-3 rounded-[22px] border border-white/[0.07] bg-black/[0.14] px-4 py-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                {skillsCountLabel(language)}
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
  const proofLinks = proofLinksFor(skill, language);

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

        <div className="mt-auto border-t border-white/[0.06] pt-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            {proofLabel(language)}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {matchedByBackendText(language)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {proofLinks.map((link) => (
              <a
                key={`${skill.id}-${link.href}`}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-cyan-300/15 bg-cyan-300/[0.055] px-3 py-1 text-xs font-medium text-cyan-100 transition-colors hover:border-cyan-300/35 hover:bg-cyan-300/[0.10]"
              >
                <span className="truncate">{link.label}</span>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function proofLinksFor(skill: SkillReference, language: UiLanguage): Array<{ label: string; href: string }> {
  const links: Array<{ label: string; href: string }> = [];
  const skillId = String(skill.id || "").trim();

  if (skillId) {
    links.push({
      label: `${localSkillLabel(language)}: ${skillId}.md`,
      href: `https://github.com/LeonardLume/AI-Ransomware-Assistant/blob/main/skills/${encodeURIComponent(skillId)}.md`,
    });
  }

  if (skill.nist_csf?.length) {
    links.push({
      label: `NIST CSF ${skill.nist_csf.slice(0, 2).join(", ")}`,
      href: "https://www.nist.gov/cyberframework",
    });
  }

  links.push({
    label: "CISA StopRansomware",
    href: "https://www.cisa.gov/resources-tools/resources/stopransomware-guide",
  });

  if (skillId.includes("patch") || skillId.includes("admin") || skillId.includes("mfa")) {
    links.push({
      label: "CIS Controls v8",
      href: "https://www.cisecurity.org/controls/v8",
    });
  }

  return links;
}

function proofLabel(language: UiLanguage): string {
  if (language === "en") return "Proof / sources";
  if (language === "ru") return "Подтверждение / источники";
  return "Tõendus / allikad";
}

function matchedByBackendText(language: UiLanguage): string {
  if (language === "en") return "Matched by the backend skills layer, not handwritten only in the UI.";
  if (language === "ru") return "Подобрано backend skills layer, а не просто вручную нарисовано в UI.";
  return "Valitud backend'i oskuste kihist, mitte ainult UI-s käsitsi joonistatud.";
}

function localSkillLabel(language: UiLanguage): string {
  if (language === "en") return "Local skill file";
  if (language === "ru") return "Локальный skill file";
  return "Kohalik skill-fail";
}

function fallbackDomainLabel(language: UiLanguage): string {
  if (language === "en") return "Defensive skill";
  if (language === "ru") return "Защитный навык";
  return "Kaitsev oskus";
}

function skillsCountLabel(language: UiLanguage): string {
  if (language === "en") return "Skills";
  if (language === "ru") return "Навыки";
  return "Oskused";
}
