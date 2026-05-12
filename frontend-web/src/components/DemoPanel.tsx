import { FileText, HelpCircle, PlayCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button, Card } from "./ui";

export default function DemoPanel({
  onLoadDemo,
  onAsk,
  onGenerateReport,
  canGenerateReport,
  loading,
}: {
  onLoadDemo: (profileId: "weak_sme" | "better_sme") => void;
  onAsk: (message: string) => void;
  onGenerateReport: () => void;
  canGenerateReport: boolean;
  loading?: boolean;
}) {
  const prompts = [
    "Mida tähendab MFA?",
    "Meil on varukoopiad olemas, aga taastamist pole testitud.",
    "Kas see on suur probleem, kui meil IR plaani pole?",
    "Selgita seda lihtsamalt juhile.",
    "Koosta raport praeguste vastuste põhjal.",
  ];

  const secondaryButton =
    "!border-white/10 !bg-white/[0.08] !text-white hover:!bg-white/[0.12] disabled:!bg-white/[0.04] disabled:!text-white/35";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-white">Demo</h2>
        <p className="mt-2 text-sm text-slate-400">
          Use demo profiles and canned prompts to show the full ransomware readiness flow.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="!border-white/10 !bg-white/[0.07] p-6 backdrop-blur-xl">
          <h3 className="text-lg font-semibold text-white">Demo flow</h3>
          <div className="mt-5 grid gap-3 text-sm leading-6 text-slate-300">
            {[
              "Start assessment",
              'Ask: "Mida tähendab MFA?"',
              'Answer: "Meil on varukoopiad olemas, aga taastamist pole testitud."',
              "Load weak SME demo",
              "Show report",
            ].map((step, index) => (
              <div key={step} className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button type="button" variant="primary" onClick={() => onAsk("")} disabled={loading}>
              <PlayCircle className="h-4 w-4" />
              Start assessment
            </Button>
            <Button
              type="button"
              onClick={() => onAsk("Mida tähendab MFA?")}
              disabled={loading}
              className={secondaryButton}
            >
              <HelpCircle className="h-4 w-4" />
              Ask MFA explanation
            </Button>
            <Button
              type="button"
              onClick={() => onLoadDemo("weak_sme")}
              disabled={loading}
              className={secondaryButton}
            >
              <ShieldAlert className="h-4 w-4" />
              Load weak SME
            </Button>
            <Button
              type="button"
              onClick={() => onLoadDemo("better_sme")}
              disabled={loading}
              className={secondaryButton}
            >
              <ShieldCheck className="h-4 w-4" />
              Load better SME
            </Button>
            <Button
              type="button"
              onClick={onGenerateReport}
              disabled={!canGenerateReport || loading}
              className={`${secondaryButton} sm:col-span-2`}
            >
              <FileText className="h-4 w-4" />
              Generate report
            </Button>
          </div>
        </Card>

        <Card className="!border-white/10 !bg-white/[0.07] p-6 backdrop-blur-xl">
          <h3 className="text-sm font-semibold text-white">Useful prompts</h3>
          <div className="mt-4 space-y-2">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onAsk(prompt)}
                disabled={loading}
                className="block w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-left text-sm leading-5 text-slate-200 transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {prompt}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
