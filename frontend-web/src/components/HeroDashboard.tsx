import { Suspense, lazy, useState } from "react";
import { CircleHelp } from "lucide-react";
import type { UiLanguage } from "../utils/i18n";
import type { ScoreResponse, SessionStateResponse } from "../types/api";
import AboutOverlay from "./AboutOverlay";
import PromptCard from "./PromptCard";

const Beams = lazy(() => import("./Beams"));

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
      <div className="absolute inset-0 z-0 bg-black">
        <Suspense fallback={null}>
          <Beams
            beamWidth={5.1}
            beamHeight={33}
            beamNumber={9}
            lightColor="#f5f5f5"
            speed={1.38}
            noiseIntensity={2.4}
            scale={0.22}
            rotation={29}
          />
        </Suspense>
      </div>
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0.03)_14%,rgba(0,0,0,0)_27%),radial-gradient(circle_at_50%_44%,rgba(255,255,255,0.03)_0%,rgba(0,0,0,0)_24%),radial-gradient(circle_at_12%_20%,rgba(255,255,255,0.03)_0%,rgba(0,0,0,0)_22%),radial-gradient(circle_at_88%_18%,rgba(255,255,255,0.03)_0%,rgba(0,0,0,0)_22%),radial-gradient(circle_at_16%_84%,rgba(255,255,255,0.025)_0%,rgba(0,0,0,0)_24%),radial-gradient(circle_at_84%_86%,rgba(255,255,255,0.025)_0%,rgba(0,0,0,0)_24%),radial-gradient(circle_at_50%_54%,rgba(0,0,0,0)_0%,rgba(0,0,0,0.10)_52%,rgba(0,0,0,0.42)_100%),linear-gradient(180deg,rgba(0,0,0,0.01)_0%,rgba(0,0,0,0.09)_44%,rgba(0,0,0,0.28)_100%)]" />
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
