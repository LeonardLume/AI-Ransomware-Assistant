import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  FileText,
  ShieldCheck,
  TicketCheck,
} from "lucide-react";

export type SolutionPageId =
  | "msp-readiness-reviews"
  | "client-recovery-proof"
  | "executive-reporting";

type SolutionPage = {
  id: SolutionPageId;
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCta: string;
  metrics: Array<{ label: string; value: string }>;
  workflow: Array<{ title: string; text: string }>;
  proofRows: Array<{ id: string; title: string; status: string; tone: string }>;
};

const solutionPages: Record<SolutionPageId, SolutionPage> = {
  "msp-readiness-reviews": {
    id: "msp-readiness-reviews",
    eyebrow: "For MSP readiness reviews",
    title: "Run ransomware readiness reviews without turning them into paperwork.",
    subtitle:
      "Guide the client through questionnaire sessions, keep evidence traceable, and turn weak domains into prioritized MSP work.",
    primaryCta: "Start MSP review",
    metrics: [
      { label: "Review paths", value: "2" },
      { label: "Domains", value: "12" },
      { label: "Report output", value: "PDF" },
    ],
    workflow: [
      {
        title: "Start with the right path",
        text: "Use Questionnaire for guided discovery or Recovery Proof when evidence already exists.",
      },
      {
        title: "Keep answers traceable",
        text: "Every answer, domain score, and report section stays attached to the selected session.",
      },
      {
        title: "Create MSP next steps",
        text: "Convert weak controls into practical actions, owners, and evidence requests.",
      },
    ],
    proofRows: [
      { id: "BCK-01", title: "Backup coverage verified", status: "Partial", tone: "warning" },
      { id: "IAM-02", title: "Admin MFA evidence found", status: "Ready", tone: "success" },
      { id: "IR-04", title: "IR owner assigned", status: "Missing", tone: "danger" },
    ],
  },
  "client-recovery-proof": {
    id: "client-recovery-proof",
    eyebrow: "For client recovery proof",
    title: "Show what can actually be recovered before ransomware tests it.",
    subtitle:
      "Import backup and security evidence, map it to recovery controls, and generate a defensible verdict with proof gaps.",
    primaryCta: "Open Recovery Proof",
    metrics: [
      { label: "Proof score", value: "70/100" },
      { label: "Evidence confidence", value: "70/100" },
      { label: "MSP tickets", value: "6" },
    ],
    workflow: [
      {
        title: "Import recovery evidence",
        text: "Bring backup reports, M365/ScubaGear, Wazuh, Prowler, DefectDojo, JSON, CSV, or YAML.",
      },
      {
        title: "Run proof mapping",
        text: "The system checks which recovery claims are supportable and where evidence is missing.",
      },
      {
        title: "Explain the gaps",
        text: "Create client-safe explanations and ticket-ready remediation for weak proof areas.",
      },
    ],
    proofRows: [
      { id: "RPF-01", title: "Restore test report", status: "Ready", tone: "success" },
      { id: "RPF-02", title: "Immutable repository proof", status: "Partial", tone: "warning" },
      { id: "RPF-03", title: "Backup admin separation", status: "Missing", tone: "danger" },
    ],
  },
  "executive-reporting": {
    id: "executive-reporting",
    eyebrow: "For executive reporting",
    title: "Turn technical readiness work into a report leadership can act on.",
    subtitle:
      "Summarize score, risk, proof, confidence, and priority actions without losing the source evidence behind the conclusion.",
    primaryCta: "Build report",
    metrics: [
      { label: "Score", value: "75/100" },
      { label: "Risk", value: "Medium" },
      { label: "Priority actions", value: "4" },
    ],
    workflow: [
      {
        title: "Summarize the verdict",
        text: "Separate official score, risk level, confidence, and incomplete-report signals.",
      },
      {
        title: "Show the source trail",
        text: "Keep source notes and evidence references available behind the executive view.",
      },
      {
        title: "Prioritize decisions",
        text: "Present the top risks and concrete next steps without flooding the report.",
      },
    ],
    proofRows: [
      { id: "REP-01", title: "Executive summary", status: "Ready", tone: "success" },
      { id: "REP-02", title: "Domain risk map", status: "Ready", tone: "success" },
      { id: "REP-03", title: "Evidence appendix", status: "Partial", tone: "warning" },
    ],
  },
};

export default function SolutionLandingPage({
  solutionId,
  onBack,
  onStartAssessment,
}: {
  solutionId: SolutionPageId;
  onBack: () => void;
  onStartAssessment: () => void;
}) {
  const page = solutionPages[solutionId];

  return (
    <div className="triage-landing min-h-screen overflow-x-hidden bg-[hsl(var(--triage-background))] text-[hsl(var(--triage-foreground))]">
      <nav className="sticky top-0 z-50 w-full border-b border-[hsl(var(--triage-border))] bg-[hsl(var(--triage-background))]/96 px-4 backdrop-blur">
        <div className="mx-auto flex h-[56px] max-w-[1200px] items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-[13px] font-medium text-[hsl(var(--triage-muted-foreground))] transition-colors hover:text-[hsl(var(--triage-foreground))]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to landing
          </button>
          <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.1em]">
            <ShieldCheck className="h-4 w-4" />
            Solutions
          </div>
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden px-6 pb-20 pt-20">
          <div className="relative mx-auto grid max-w-[1200px] gap-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[hsl(var(--triage-muted-foreground))]">
                {page.eyebrow}
              </p>
              <h1 className="mt-5 max-w-[760px] text-[clamp(2.3rem,5vw,4.6rem)] font-[500] leading-[1.03] tracking-[-0.055em]">
                {page.title}
              </h1>
              <p className="mt-6 max-w-[560px] text-[16px] leading-7 text-[hsl(var(--triage-muted-foreground))]">
                {page.subtitle}
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onStartAssessment}
                  className="inline-flex h-11 items-center gap-2 bg-[hsl(var(--triage-foreground))] px-5 text-[14px] font-medium text-[hsl(var(--triage-background))] transition-colors hover:bg-[hsl(var(--triage-foreground))]/90"
                >
                  {page.primaryCta}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <a
                  href="/landing"
                  className="inline-flex h-11 items-center border border-[hsl(var(--triage-border))] px-5 text-[14px] font-medium text-[hsl(var(--triage-foreground))] transition-colors hover:border-[hsl(var(--triage-foreground))]/55"
                >
                  View products
                </a>
              </div>
            </div>

            <SolutionPreview page={page} />
          </div>
        </section>

        <section className="border-y border-[hsl(var(--triage-border))] px-6 py-16">
          <div className="mx-auto grid max-w-[1200px] gap-0 border border-[hsl(var(--triage-border))] md:grid-cols-3">
            {page.workflow.map((item, index) => (
              <article
                key={item.title}
                className={`${index > 0 ? "border-t border-[hsl(var(--triage-border))] md:border-l md:border-t-0" : ""} p-7`}
              >
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--triage-muted-foreground))]">
                  0{index + 1}
                </div>
                <h2 className="mt-5 text-[18px] font-semibold">{item.title}</h2>
                <p className="mt-3 text-[13px] leading-6 text-[hsl(var(--triage-muted-foreground))]">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="px-6 py-20">
          <div className="mx-auto max-w-[1200px]">
            <div className="max-w-[560px]">
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[hsl(var(--triage-muted-foreground))]">
                Built from the same assessment engine
              </p>
              <h2 className="mt-4 text-[clamp(1.8rem,3vw,2.7rem)] font-[500] leading-tight tracking-[-0.035em]">
                One workspace, separate paths, traceable outputs.
              </h2>
            </div>
            <div className="mt-10 grid gap-3 md:grid-cols-3">
              {page.metrics.map((metric) => (
                <div key={metric.label} className="border border-[hsl(var(--triage-border))] p-5">
                  <div className="text-[12px] text-[hsl(var(--triage-muted-foreground))]">
                    {metric.label}
                  </div>
                  <div className="mt-3 text-[32px] font-semibold tracking-[-0.05em]">
                    {metric.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function SolutionPreview({ page }: { page: SolutionPage }) {
  return (
    <aside className="border border-[hsl(var(--triage-border))] bg-[hsl(var(--triage-card))] p-4 shadow-2xl">
      <div className="flex h-10 items-center justify-between border-b border-[hsl(var(--triage-border))] px-1 pb-3">
        <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--triage-muted-foreground))]">
          <ClipboardCheck className="h-4 w-4" />
          Live workspace
        </div>
        <BarChart3 className="h-4 w-4 text-[hsl(var(--triage-muted-foreground))]" />
      </div>
      <div className="mt-4 space-y-2">
        {page.proofRows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[hsl(var(--triage-border))] py-3 last:border-b-0"
          >
            <span className="font-mono text-[11px] text-[hsl(var(--triage-muted-foreground))]">
              {row.id}
            </span>
            <span className="truncate text-[13px] text-[hsl(var(--triage-foreground))]/82">
              {row.title}
            </span>
            <span className={`h-2.5 w-2.5 ${toneClass(row.tone)}`} />
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="border border-[hsl(var(--triage-border))] p-3">
          <FileText className="h-4 w-4 text-[hsl(var(--triage-muted-foreground))]" />
          <div className="mt-3 text-[13px] font-semibold">Report-ready</div>
          <p className="mt-1 text-[12px] leading-4 text-[hsl(var(--triage-muted-foreground))]">
            Summary, score, risks, and traceable evidence.
          </p>
        </div>
        <div className="border border-[hsl(var(--triage-border))] p-3">
          <TicketCheck className="h-4 w-4 text-[hsl(var(--triage-muted-foreground))]" />
          <div className="mt-3 text-[13px] font-semibold">Ticket-ready</div>
          <p className="mt-1 text-[12px] leading-4 text-[hsl(var(--triage-muted-foreground))]">
            Prioritized work for MSP or IT owners.
          </p>
        </div>
      </div>
    </aside>
  );
}

function toneClass(tone: string) {
  if (tone === "success") return "bg-[hsl(var(--triage-success))]";
  if (tone === "warning") return "bg-[hsl(var(--triage-warning))]";
  if (tone === "danger") return "bg-[hsl(var(--triage-destructive))]";
  return "bg-[hsl(var(--triage-primary))]";
}
