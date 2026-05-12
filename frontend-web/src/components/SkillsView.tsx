import { BookOpenCheck } from "lucide-react";
import type { ReportResponse } from "../types/api";
import { Badge, Card, EmptyState } from "./ui";

export default function SkillsView({ report }: { report?: ReportResponse | null }) {
  const skills = report?.skill_references || [];

  if (!skills.length) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-semibold text-white">Skills</h2>
          <p className="mt-2 text-sm text-slate-400">
            Defensive skills and playbooks support explanations and action plans.
          </p>
        </div>
        <EmptyState
          title="Skills layer not loaded yet"
          description="Skills support explanations, action plans, and evidence suggestions. They do not calculate the numeric score."
          icon={<BookOpenCheck className="h-5 w-5" />}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-white">Skills</h2>
        <p className="mt-2 text-sm text-slate-400">
          Matched defensive skills returned by the backend report.
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
            <h3 className="mt-4 text-base font-semibold text-white">{skill.title || skill.id}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {skill.domain ? <Badge tone="info">{skill.domain}</Badge> : null}
              {skill.safe_use ? <Badge tone="success">{skill.safe_use}</Badge> : null}
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
                    {tag}
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
