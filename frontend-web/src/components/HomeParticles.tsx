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
        collisions: {
          enable: false,
        },
        color: {
          value: ["#ffffff", "#f0ffff", "#c8fbff"],
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
          speed: 0.34,
          straight: false,
        },
        number: {
          density: {
            enable: true,
            area: 780,
          },
          value: 68,
        },
        opacity: {
          value: {
            min: 0.22,
            max: 0.58,
          },
          animation: {
            enable: !reducedMotion,
            speed: 0.42,
            sync: false,
            startValue: "random",
            minimumValue: 0.16,
          },
        },
        shape: {
          type: "circle",
        },
        size: {
          value: {
            min: 0.9,
            max: 2.2,
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
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-90 [filter:drop-shadow(0_0_3px_rgba(255,255,255,0.38))]"
    >
      <Particles
        className="absolute inset-0 h-full w-full"
        id="home-particles"
        options={options}
        style={{
          height: "100%",
          inset: 0,
          position: "absolute",
          width: "100%",
        }}
      />
    </div>
  );
}
