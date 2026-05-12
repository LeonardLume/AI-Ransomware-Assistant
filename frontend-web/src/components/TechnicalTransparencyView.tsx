import { ArrowRight, BrainCircuit, Database, FileJson, Filter, MessageSquare, ShieldCheck } from "lucide-react";
import type { ProviderStatusResponse, TechnicalFlowResponse } from "../types/api";
import { Badge, Card, Accordion } from "./ui";

const workflow = [
  "User message",
  "Prompt firewall",
  "Redaction",
  "Intent detection",
  "LLM extraction/advisor",
  "Backend validation",
  "Structured answers",
  "Rule-based scoring",
  "Report/action plan",
];

export default function TechnicalTransparencyView({
  flow,
  providerStatus,
}: {
  flow?: TechnicalFlowResponse | null;
  providerStatus?: ProviderStatusResponse | null;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-white">Technical Transparency</h2>
        <p className="mt-2 text-sm text-slate-400">
          What the UI sends, what the LLM can influence, and what remains deterministic in FastAPI.
        </p>
      </div>

      <Card className="!border-white/10 !bg-white/[0.07] p-5 backdrop-blur-xl">
        <h3 className="text-lg font-semibold text-white">Workflow</h3>
        <div className="mt-5 grid gap-3 xl:grid-cols-9">
          {workflow.map((step, index) => (
            <div key={step} className="relative rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="text-[11px] font-semibold uppercase text-slate-500">Step {index + 1}</div>
              <div className="mt-1 text-sm font-medium leading-5 text-slate-100">{step}</div>
              {index < workflow.length - 1 ? (
                <ArrowRight className="absolute -right-4 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-white/25 xl:block" />
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <InfoCard
          icon={FileJson}
          title="Question source"
          text="Questions come from questions.json. The UI does not define the official questionnaire."
        />
        <InfoCard
          icon={BrainCircuit}
          title="LLM role"
          text="The LLM explains concepts and extracts candidate structured answers. It does not invent or calculate the official score."
        />
        <InfoCard
          icon={ShieldCheck}
          title="Backend validation"
          text="FastAPI validates question IDs and allowed options before storing structured answers."
        />
        <InfoCard
          icon={Database}
          title="Rule scoring"
          text="The score is deterministic and rule-based from scoring_rules.json."
        />
        <InfoCard
          icon={Filter}
          title="Fallback mode"
          text={`Fallback works without an API key. Provider currently reports ${providerStatus?.provider || "unknown"}.`}
        />
        <InfoCard
          icon={MessageSquare}
          title="Sensitive data"
          text="Sensitive data should not be entered. This tool is a self-assessment, not a full technical audit."
          warning
        />
      </section>

      <Accordion title="Debug technical data">
        <pre className="scrollbar-slim max-h-72 overflow-auto rounded-2xl bg-black/50 p-4 text-xs leading-5 text-slate-200">
          {JSON.stringify({ flow, providerStatus }, null, 2)}
        </pre>
      </Accordion>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  text,
  warning,
}: {
  icon: typeof FileJson;
  title: string;
  text: string;
  warning?: boolean;
}) {
  return (
    <Card className="!border-white/10 !bg-white/[0.07] p-5 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Icon className={warning ? "h-4 w-4 text-amber-300" : "h-4 w-4 text-sky-300"} />
        {title}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{text}</p>
      {warning ? (
        <div className="mt-3">
          <Badge tone="warning">defensive-only</Badge>
        </div>
      ) : null}
    </Card>
  );
}
