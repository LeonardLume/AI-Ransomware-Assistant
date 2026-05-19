import type { ScoreResponse, SessionStateResponse } from "../types/api";
import PromptCard from "./PromptCard";

export default function HeroDashboard({
  sending,
  onPrompt,
}: {
  session?: SessionStateResponse | null;
  score?: ScoreResponse | null;
  sending?: boolean;
  canGenerateReport: boolean;
  reportLoading?: boolean;
  onPrompt: (message: string) => void;
  onLoadDemo: (profileId: "weak_sme" | "better_sme") => void;
  onGenerateReport: () => void;
  onOpenTechnical: () => void;
  onOpenInterview: () => void;
}) {
  return (
    <section className="relative isolate -m-4 flex min-h-[calc(100vh-1rem)] items-center justify-center overflow-hidden rounded-[30px] px-4 py-20 text-center sm:-m-6 sm:min-h-[calc(100vh-1.5rem)] sm:px-6 lg:-m-8 lg:min-h-[calc(100vh-2rem)] lg:px-8">
      <div className="relative z-10 w-full">
        <h1 className="mx-auto max-w-4xl text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
          What should we assess today?
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base font-medium text-white/72 sm:text-lg">
          AI-powered ransomware readiness assistant
        </p>

        <div className="mt-10">
          <PromptCard sending={sending} onSubmit={onPrompt} />
        </div>
      </div>
    </section>
  );
}
