import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";

function LeaderAnnotation({
  top,
  left,
  dx,
  dy,
  title,
  value,
  delay = 0,
}: {
  top: string;
  left: string;
  dx: number;
  dy: number;
  title: string;
  value: ReactNode;
  delay?: number;
}) {
  const length = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const alignRight = dx < 0;

  return (
    <div className="absolute" style={{ top, left }}>
      <span className="absolute h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cream/80" />
      <motion.span
        className="absolute h-px origin-left bg-cream/25"
        style={{ width: length, transform: `rotate(${angle}deg)` }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.div
        className="absolute whitespace-nowrap"
        style={{
          top: dy + (dy < 0 ? -20 : 6),
          left: alignRight ? undefined : dx + 10,
          right: alignRight ? -dx + 10 : undefined,
          textAlign: alignRight ? "right" : "left",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: delay + 0.45 }}
      >
        <div className="text-[9px] uppercase tracking-[0.22em] text-mist/75">{title}</div>
        <div className="mt-0.5 text-[10.5px] text-water">{value}</div>
      </motion.div>
    </div>
  );
}

function ScenarioCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 1.15, ease: [0.16, 1, 0.3, 1] }}
      className="absolute right-[6%] top-[13%] hidden w-[172px] border border-cream/15 bg-abyss/25 px-4 py-3.5 backdrop-blur-[2px] md:block"
    >
      <div className="text-[8.5px] uppercase tracking-[0.28em] text-mist/70">Active Scenario</div>
      <div className="fs-serif mt-1.5 text-[14px] italic text-cream">Dam-Break / Cascade</div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-cream/10 pt-3">
        <div>
          <div className="text-[7.5px] uppercase tracking-[0.2em] text-mist/55">Domain</div>
          <div className="mt-0.5 text-[10.5px] text-cream/90">River Basin</div>
        </div>
        <div>
          <div className="text-[7.5px] uppercase tracking-[0.2em] text-mist/55">Status</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-water">
            <span className="h-1 w-1 rounded-full bg-water" />
            Ready
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function VerticalMotif() {
  const words = ["SIMULATE", "ANALYZE", "MITIGATE"];
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setActive((a) => (a + 1) % words.length), 3200);
    return () => window.clearInterval(id);
  }, [words.length]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay: 1.3 }}
      className="absolute right-[3.4%] top-1/2 hidden -translate-y-1/2 flex-col items-center gap-4 xl:flex"
    >
      <div className="h-8 w-px bg-cream/20" />
      {words.map((w, i) => (
        <span
          key={w}
          className="text-[9.5px] tracking-[0.28em] transition-colors duration-700"
          style={{ color: i === active ? "#F1F0EA" : "rgba(158,164,163,0.55)" }}
        >
          {w}
        </span>
      ))}
      <div className="h-8 w-px bg-cream/20" />
    </motion.div>
  );
}

export default function HeroAnnotations() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="hidden lg:block">
        <LeaderAnnotation
          top="34%"
          left="53%"
          dx={-88}
          dy={-34}
          title="Hydrodynamic Domain"
          value={
            <span className="flex items-center gap-1.5 text-emerald-300/90">
              <span className="h-1 w-1 rounded-full bg-emerald-300/90" />
              Active
            </span>
          }
          delay={1.7}
        />
        <LeaderAnnotation
          top="17%"
          left="70%"
          dx={64}
          dy={38}
          title="Simulation Ready"
          value="Standby → Armed"
          delay={1.85}
        />
        <LeaderAnnotation
          top="48%"
          left="35%"
          dx={92}
          dy={-16}
          title="Terrain Resolution"
          value="30 M"
          delay={2.0}
        />
      </div>

      <ScenarioCard />
      <VerticalMotif />
    </div>
  );
}
