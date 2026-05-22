import { useState } from "react";
import { CircleHelp } from "lucide-react";
import type { UiLanguage } from "../utils/i18n";
import type { ScoreResponse, SessionStateResponse } from "../types/api";
import AboutOverlay from "./AboutOverlay";
import PromptCard from "./PromptCard";

export default function HeroDashboard({
  sending,
  onPrompt,
  onStartAssessment,
  language = "en",
}: {
  session?: SessionStateResponse | null;
  score?: ScoreResponse | null;
  sending?: boolean;
  canGenerateReport: boolean;
  reportLoading?: boolean;
  onPrompt: (message: string) => void;
  onStartAssessment: () => void;
  onLoadDemo: (profileId: "weak_sme" | "better_sme") => void;
  onGenerateReport: () => void;
  onOpenTechnical: () => void;
  onOpenInterview: () => void;
  language?: UiLanguage;
}) {
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <section className="relative isolate -m-4 flex min-h-[calc(100vh-1rem)] items-center justify-center overflow-hidden rounded-[30px] px-4 py-20 text-center sm:-m-6 sm:min-h-[calc(100vh-1.5rem)] sm:px-6 lg:-m-8 lg:min-h-[calc(100vh-2rem)] lg:px-8">
      <button
        type="button"
        onClick={() => setAboutOpen(true)}
        aria-label="About this project"
        className="absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/78 shadow-[0_16px_46px_rgba(2,6,23,0.24)] backdrop-blur-xl transition hover:border-cyan-300/26 hover:bg-white/[0.1] hover:text-white hover:shadow-[0_18px_54px_rgba(56,189,248,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 sm:right-6 sm:top-6"
      >
        <CircleHelp className="h-4 w-4" />
      </button>

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

      <AboutOverlay
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        onStart={onStartAssessment}
        language={language}
      />
    </section>
  );
}
