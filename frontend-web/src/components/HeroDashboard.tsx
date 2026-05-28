import { Suspense, lazy, useState } from "react";
import { CircleHelp } from "lucide-react";
import type { UiLanguage } from "../utils/i18n";
import type { ScoreResponse, SessionStateResponse } from "../types/api";
import AboutOverlay from "./AboutOverlay";
import PromptCard from "./PromptCard";

const DarkVeil = lazy(() => import("./DarkVeil"));

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
      <div className="absolute -inset-[18%] z-0 bg-black brightness-[1.85] saturate-[1.35]">
        <Suspense fallback={null}>
          <DarkVeil
            hueShift={36}
            noiseIntensity={0.045}
            scanlineIntensity={0.025}
            scanlineFrequency={0.85}
            speed={0.58}
            warpAmount={0.18}
            resolutionScale={1}
          />
        </Suspense>
      </div>
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0.035)_18%,rgba(0,0,0,0)_34%),radial-gradient(circle_at_50%_52%,rgba(0,0,0,0)_0%,rgba(0,0,0,0.08)_48%,rgba(0,0,0,0.30)_100%),linear-gradient(180deg,rgba(0,0,0,0.04)_0%,rgba(0,0,0,0.10)_48%,rgba(0,0,0,0.24)_100%)]" />
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
