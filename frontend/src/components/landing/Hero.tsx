import { useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import Navbar from "./Navbar";
import HeroAnnotations from "./HeroAnnotations";
import SimulationTimeline from "./SimulationTimeline";
import CapabilityStrip from "./CapabilityStrip";
import ScrollIndicator from "./ScrollIndicator";
import FogLayer from "./FogLayer";
import WaterCanvas from "./WaterCanvas";

const EASE = [0.16, 1, 0.3, 1] as const;

const headlineLines = [
  { text: "Predict.", className: "text-cream" },
  { text: "Prepare.", className: "text-cream" },
  { text: "Protect.", className: "text-[#A6B6B9]" },
];

export default function Hero({ onWatch }: { onWatch: () => void }) {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMouse({
      x: (e.clientX - rect.left) / rect.width - 0.5,
      y: (e.clientY - rect.top) / rect.height - 0.5,
    });
  };

  return (
    <section
      onMouseMove={handleMouseMove}
      className="relative flex h-screen min-h-[760px] w-full flex-col overflow-hidden bg-abyss"
    >
      {/* Background image — parallax wrapper kept slightly oversized so translation never reveals an edge */}
      <div
        className="absolute -inset-4"
        style={{
          transform: `translate3d(${mouse.x * -9}px, ${mouse.y * -9}px, 0)`,
          transition: "transform 0.7s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <motion.img
          src="/images/hero-flood-dam.png"
          alt="Aerial view of a dam, reservoir and downstream river used as the hydrodynamic simulation domain"
          className="h-full w-full animate-slow-zoom object-cover"
          style={{ objectPosition: "68% 40%" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.8, ease: "easeOut" }}
        />
      </div>

      {/* Cinematic fog: initial clearing reveal + continuous ambient drift */}
      <FogLayer mouse={mouse} />

      {/* Masked water flow — reads /images/water-mask.png, affects only white regions */}
      <WaterCanvas mouse={mouse} />

      {/* Legibility scrims */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, #070A0B 0%, rgba(7,10,11,0.86) 20%, rgba(7,10,11,0.48) 38%, rgba(7,10,11,0.1) 50%, transparent 60%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[22%]"
        style={{ background: "linear-gradient(to bottom, rgba(7,10,11,0.5), transparent)" }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%]"
        style={{ background: "linear-gradient(to top, rgba(7,10,11,0.62), transparent)" }}
      />
      {/* Extra scrim for small screens, where the copy column covers most of the width */}
      <div className="pointer-events-none absolute inset-0 bg-abyss/35 sm:hidden" />

      {/* Annotation layer — slightly more parallax than the background */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate3d(${mouse.x * -16}px, ${mouse.y * -16}px, 0)`,
          transition: "transform 0.7s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <HeroAnnotations />
        <SimulationTimeline />
      </div>

      <Navbar />

      {/* Hero copy */}
      <div className="relative z-30 flex flex-1 flex-col justify-center pb-[2vh] pl-[7vw] pr-6 md:pb-[3vh] md:pr-0">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55, ease: EASE }}
          className="flex items-center gap-3 text-[10px] uppercase tracking-[0.24em] text-[#9EA4A3] sm:text-[11px] sm:tracking-[0.28em]"
        >
          <span className="h-px w-6 bg-ember" />
          Hydrodynamic Intelligence / HADR
        </motion.div>

        <h1
          className="fs-serif mt-4 text-[clamp(56px,7vw,125px)] leading-[0.85] tracking-[-0.01em] sm:mt-5"
          aria-label="Predict. Prepare. Protect."
        >
          {headlineLines.map((line, i) => (
            <span key={line.text} className="block overflow-hidden">
              <motion.span
                className={`block ${line.className}`}
                initial={{ y: "110%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 1, delay: 0.75 + i * 0.13, ease: EASE }}
              >
                {line.text}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.35, ease: EASE }}
          className="mt-5 max-w-[440px] text-[14.5px] leading-[1.55] text-mist sm:mt-8 sm:text-[16px] sm:leading-[1.6]"
        >
          A next-generation simulation framework for flood prediction,
          dam-break analysis and disaster-response intelligence.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.55, ease: EASE }}
          className="mt-6 flex flex-wrap items-center gap-6 sm:mt-10 sm:gap-10"
        >
          <Link
            to="/dashboard"
            data-cursor="open"
            className="group inline-flex h-[46px] w-[184px] items-center justify-center gap-2 rounded-md border border-cream/15 bg-graphite text-[11.5px] uppercase tracking-[0.14em] text-cream transition-colors duration-300 hover:bg-[#141a1b] sm:h-[50px] sm:w-[200px] sm:text-[12px]"
          >
            Explore Platform
            <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1.5" />
          </Link>

          <button onClick={onWatch} data-cursor="play" className="group flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-cream/25 transition-all duration-300 group-hover:scale-105 group-hover:rotate-[18deg] group-hover:border-cream/60">
              <Play size={12} className="ml-0.5 fill-cream text-cream" />
            </span>
            <span className="text-left">
              <span className="block text-[11px] uppercase tracking-[0.14em] text-cream/90">
                Watch Simulation
              </span>
              <span className="mt-0.5 block text-[10px] tabular-nums text-mist/60">02:14</span>
            </span>
          </button>
        </motion.div>
      </div>

      {/* Bottom strip */}
      <div className="relative z-30 shrink-0 px-[7vw] pb-5 pt-1 md:pb-10 md:pt-2">
        <CapabilityStrip />
      </div>

      <div className="relative z-30 hidden shrink-0 justify-center pb-4 sm:flex">
        <ScrollIndicator />
      </div>
    </section>
  );
}
