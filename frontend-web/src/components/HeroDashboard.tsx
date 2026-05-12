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
    <section className="assessment-wallpaper relative isolate -m-4 flex min-h-[calc(100vh-1rem)] items-center justify-center overflow-hidden rounded-[30px] px-4 py-20 text-center sm:-m-6 sm:min-h-[calc(100vh-1.5rem)] sm:px-6 lg:-m-8 lg:min-h-[calc(100vh-2rem)] lg:px-8">
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
