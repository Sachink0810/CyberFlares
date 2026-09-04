import { useMemo } from "react";

/**
 * Cinematic fog: a one-time dense-to-clear reveal on mount, plus three
 * continuous ambient depth layers (bg/mid/fg) drifting at different speeds
 * and parallax weights. Positioned toward the right/lower terrain so the
 * headline column on the left always stays clear.
 */
export default function FogLayer({ mouse }: { mouse: { x: number; y: number } }) {
  const prefersReduced = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  return (
    <>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <filter id="fog-turbulence" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.015" numOctaves={2} seed={7} result="noise">
            {!prefersReduced && (
              <animate
                attributeName="baseFrequency"
                values="0.008 0.015;0.011 0.010;0.008 0.015"
                dur="14s"
                repeatCount="indefinite"
              />
            )}
          </feTurbulence>
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={prefersReduced ? 0 : 38}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>

      {/* Initial cinematic reveal — dense on mount, dissipates irregularly over ~3.2s, never once */}
      <div
        className={`pointer-events-none absolute inset-0 ${
          prefersReduced ? "opacity-0 transition-opacity duration-1000" : "animate-fog-reveal"
        }`}
        style={{
          background:
            "radial-gradient(60% 55% at 72% 55%, rgba(230,235,232,0.9), rgba(230,235,232,0.55) 45%, transparent 78%)",
          filter: prefersReduced ? undefined : "url(#fog-turbulence)",
          maskImage: "linear-gradient(90deg, transparent 0%, transparent 30%, black 52%, black 100%)",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent 0%, transparent 30%, black 52%, black 100%)",
        }}
      />

      {/* Distant haze — slowest drift, lightest parallax */}
      <div
        className="pointer-events-none absolute inset-0"
        style={
          prefersReduced
            ? undefined
            : {
                transform: `translate3d(${mouse.x * -14}px, ${mouse.y * -14}px, 0)`,
                transition: "transform 0.7s cubic-bezier(0.16,1,0.3,1)",
              }
        }
      >
        <div
          className={`absolute inset-0 mix-blend-soft-light ${prefersReduced ? "" : "animate-fog-drift-bg"}`}
          style={{
            opacity: 0.16,
            background: "radial-gradient(50% 40% at 82% 30%, rgba(255,255,255,0.5), transparent 72%)",
          }}
        />
      </div>

      {/* Midground fog — over the dam surrounds / river edges */}
      <div
        className="pointer-events-none absolute inset-0"
        style={
          prefersReduced
            ? undefined
            : {
                transform: `translate3d(${mouse.x * -20}px, ${mouse.y * -20}px, 0)`,
                transition: "transform 0.7s cubic-bezier(0.16,1,0.3,1)",
              }
        }
      >
        <div
          className={`absolute inset-0 mix-blend-soft-light ${prefersReduced ? "" : "animate-fog-drift-mid"}`}
          style={{
            opacity: 0.2,
            background: "radial-gradient(55% 45% at 78% 68%, rgba(255,255,255,0.45), transparent 70%)",
          }}
        />
      </div>

      {/* Foreground fog — lower-right terrain, fastest drift, strongest parallax */}
      <div
        className="pointer-events-none absolute inset-0"
        style={
          prefersReduced
            ? undefined
            : {
                transform: `translate3d(${mouse.x * -30}px, ${mouse.y * -30}px, 0)`,
                transition: "transform 0.7s cubic-bezier(0.16,1,0.3,1)",
              }
        }
      >
        <div
          className={`absolute inset-0 mix-blend-soft-light ${prefersReduced ? "" : "animate-fog-drift-fg"}`}
          style={{
            opacity: 0.14,
            background: "radial-gradient(40% 35% at 88% 88%, rgba(255,255,255,0.55), transparent 74%)",
          }}
        />
      </div>
    </>
  );
}
