import { useState } from "react";
import { motion } from "framer-motion";

const TOP = 81.2;
const HEIGHT = 7.8;

const CHECKPOINTS = [
  { label: "T + 00 MIN", left: 77.8, width: 5.7, center: 80.65 },
  { label: "T + 15 MIN", left: 84.9, width: 5.9, center: 87.85 },
  { label: "T + 30 MIN", left: 91.5, width: 8.2, center: 95.6 },
];

export default function SimulationTimeline() {
  const [hover, setHover] = useState<number | null>(null);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 hidden lg:block">
      <div className="absolute inset-x-0" style={{ top: `${TOP - 6.4}%` }}>
        {CHECKPOINTS.map((c, i) => (
          <span
            key={c.label}
            className="absolute -translate-x-1/2 whitespace-nowrap text-[8.5px] tracking-[0.16em] transition-colors duration-300"
            style={{ left: `${c.center}%`, color: hover === i ? "#F1F0EA" : "rgba(241,240,234,0.5)" }}
          >
            {c.label}
          </span>
        ))}
      </div>

      <motion.div
        className="absolute h-px origin-left bg-cream/25"
        style={{ top: `${TOP - 1.4}%`, left: "77.8%", width: "22%" }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.1, delay: 2.15, ease: [0.16, 1, 0.3, 1] }}
      />

      {CHECKPOINTS.map((c, i) => (
        <div
          key={c.label}
          data-cursor="hover"
          className="pointer-events-auto absolute transition-all duration-300 ease-out"
          style={{
            top: `${TOP}%`,
            left: `${c.left}%`,
            width: `${c.width}%`,
            height: `${HEIGHT}%`,
            border: `1px solid ${hover === i ? "rgba(241,240,234,0.5)" : "rgba(241,240,234,0.1)"}`,
            backdropFilter: hover === i ? "brightness(1.3) saturate(1.1)" : "none",
            transform: hover === i ? "scale(1.04)" : "scale(1)",
          }}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
        />
      ))}

      <div
        className="absolute whitespace-nowrap text-[8px] uppercase tracking-[0.32em] text-mist/55"
        style={{ top: `${TOP + HEIGHT + 2}%`, left: "77.8%" }}
      >
        Flood Propagation
      </div>
    </div>
  );
}
