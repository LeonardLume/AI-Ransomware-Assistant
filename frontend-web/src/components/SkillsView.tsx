import { BookOpenCheck } from "lucide-react";
import type { ReportResponse } from "../types/api";
import {
  domainLabel,
  skillTitle,
  t,
  valueLabel,
  type UiLanguage,
} from "../utils/i18n";
import { Badge, Card, EmptyState } from "./ui";

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
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-semibold text-white">{t(language, "skills")}</h2>
          <p className="mt-2 text-sm text-slate-400">
            {t(language, "skillsDescription")}
          </p>
        </div>
        <EmptyState
          title={t(language, "skillsNotLoaded")}
          description={t(language, "skillsNotLoadedDescription")}
          icon={<BookOpenCheck className="h-5 w-5" />}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-white">{t(language, "skills")}</h2>
        <p className="mt-2 text-sm text-slate-400">
          {t(language, "skillsMatchedDescription")}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {skills.map((skill) => (
          <Card
            key={skill.id || skill.title}
            className="!border-white/10 !bg-white/[0.07] p-5 backdrop-blur-xl"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.08] text-sky-300">
              <BookOpenCheck className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-white">{skillTitle(language, skill)}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {skill.domain ? <Badge tone="info">{domainLabel(language, skill.domain)}</Badge> : null}
              {skill.safe_use ? <Badge tone="success">{valueLabel(language, skill.safe_use)}</Badge> : null}
            </div>
            {skill.nist_csf?.length ? (
              <p className="mt-3 text-sm leading-6 text-slate-400">
                NIST CSF: {skill.nist_csf.join(", ")}
              </p>
            ) : null}
            {skill.tags?.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {skill.tags.map((tag) => (
                  <Badge key={tag} tone="neutral">
                    {valueLabel(language, tag)}
                  </Badge>
                ))}
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
