import { useEffect, useMemo, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { Engine, ISourceOptions } from "@tsparticles/engine";

let particlesEngineReady: Promise<void> | null = null;

function ensureParticlesEngine(): Promise<void> {
  if (!particlesEngineReady) {
    particlesEngineReady = initParticlesEngine(async (engine: Engine) => {
      await loadSlim(engine);
    });
  }

  return particlesEngineReady;
}

function usePrefersReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);

    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  return reducedMotion;
}

export default function HomeParticles() {
  const [ready, setReady] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    let mounted = true;

    ensureParticlesEngine().then(() => {
      if (mounted) {
        setReady(true);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const options = useMemo<ISourceOptions>(
    () => ({
      autoPlay: true,
      background: {
        color: {
          value: "transparent",
        },
      },
      detectRetina: true,
      fpsLimit: reducedMotion ? 20 : 45,
      fullScreen: {
        enable: false,
      },
      interactivity: {
        detectsOn: "window",
        events: {
          onClick: {
            enable: false,
          },
          onHover: {
            enable: false,
          },
          resize: {
            enable: true,
          },
        },
      },
      particles: {
        color: {
          value: ["#f8ffff", "#a7f3d0", "#67e8f9"],
        },
        links: {
          enable: false,
        },
        move: {
          direction: "none",
          enable: !reducedMotion,
          outModes: {
            default: "out",
          },
          random: true,
          speed: 0.18,
          straight: false,
        },
        number: {
          density: {
            enable: true,
            area: 900,
          },
          value: 58,
        },
        opacity: {
          value: {
            min: 0.08,
            max: 0.32,
          },
          animation: {
            enable: !reducedMotion,
            speed: 0.28,
            sync: false,
            startValue: "random",
            minimumValue: 0.05,
          },
        },
        shape: {
          type: "circle",
        },
        size: {
          value: {
            min: 0.6,
            max: 1.8,
          },
          animation: {
            enable: false,
          },
        },
      },
      pauseOnBlur: true,
      pauseOnOutsideViewport: true,
    }),
    [reducedMotion],
  );

  if (!ready) {
    return null;
  }

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 opacity-80">
      <Particles className="h-full w-full" id="home-particles" options={options} />
    </div>
  );
}
