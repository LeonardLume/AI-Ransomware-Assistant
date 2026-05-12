import { Sparkles } from "lucide-react";
import type { ScoreResponse, SessionStateResponse } from "../types/api";
import PromptCard from "./PromptCard";

export default function HeroDashboard({
  sending,
  onPrompt,
  onStart,
}: {
  session?: SessionStateResponse | null;
  score?: ScoreResponse | null;
  sending?: boolean;
  canGenerateReport: boolean;
  reportLoading?: boolean;
  onPrompt: (message: string) => void;
  onStart: () => void;
  onLoadDemo: (profileId: "weak_sme" | "better_sme") => void;
  onGenerateReport: () => void;
  onOpenTechnical: () => void;
  onOpenInterview: () => void;
}) {
  return (
    <section className="relative isolate -m-4 flex min-h-[calc(100vh-1rem)] items-center justify-center overflow-hidden rounded-[30px] px-4 py-20 text-center sm:-m-6 sm:min-h-[calc(100vh-1.5rem)] sm:px-6 lg:-m-8 lg:min-h-[calc(100vh-2rem)] lg:px-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_0%,rgba(8,10,12,0.98)_0%,rgba(11,18,22,0.94)_22%,transparent_42%),radial-gradient(ellipse_at_45%_34%,rgba(20,184,166,0.72)_0%,rgba(5,150,105,0.52)_25%,transparent_56%),radial-gradient(ellipse_at_70%_62%,rgba(132,204,22,0.42)_0%,transparent_46%),radial-gradient(ellipse_at_28%_70%,rgba(245,158,11,0.38)_0%,transparent_44%),linear-gradient(180deg,#080a0c_0%,#10201f_26%,#0f766e_48%,#16a34a_70%,#eab308_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_34%,rgba(255,255,255,0.10),transparent_32%),linear-gradient(180deg,rgba(0,0,0,0.22),rgba(0,0,0,0.34))]" />

      <div className="w-full">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-4 py-2 text-sm font-medium text-white shadow-[0_18px_42px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <Sparkles className="h-4 w-4 text-emerald-300" />
          AI-powered ransomware readiness assistant
        </div>
        <h1 className="mx-auto mt-7 max-w-4xl text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
          What should we assess today?
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base font-medium text-white/72 sm:text-lg">
          Controlled AI interview - Defensive-only - Rule-based scoring
        </p>

        <div className="mt-10">
          <PromptCard sending={sending} onSubmit={onPrompt} onStart={onStart} />
        </div>
      </div>
    </section>
  );
}
