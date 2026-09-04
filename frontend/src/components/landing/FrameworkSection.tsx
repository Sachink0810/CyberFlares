import { motion } from "framer-motion";

const STEPS = [
  { n: "01", title: "OBSERVE", desc: "DEM + satellite + river networks" },
  { n: "02", title: "SIMULATE", desc: "SPH + Delft3D hydrodynamic modelling" },
  { n: "03", title: "RESPOND", desc: "Inundation + infrastructure + population impact" },
];

const EASE = [0.16, 1, 0.3, 1] as const;

export default function FrameworkSection() {
  return (
    <section id="platform" className="relative bg-abyss px-[7vw] py-28 md:py-36">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-10%" }}
        transition={{ duration: 0.8, ease: EASE }}
        className="flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-mist/60"
      >
        <span className="h-px w-6 bg-ember" />
        The Simulation Framework
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-10%" }}
        transition={{ duration: 0.9, delay: 0.1, ease: EASE }}
        className="fs-serif mt-7 max-w-4xl text-[clamp(38px,5.5vw,84px)] leading-[0.95] tracking-[-0.01em] text-cream"
      >
        From terrain
        <br />
        to consequence.
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-10%" }}
        transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
        className="mt-8 max-w-[480px] text-[16px] leading-[1.6] text-mist"
      >
        Transform terrain, hydrology and geospatial data into actionable flood intelligence.
      </motion.p>

      <div className="mt-24 grid grid-cols-1 gap-16 border-t border-cream/10 pt-14 md:grid-cols-3 md:gap-10">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.8, delay: 0.15 * i, ease: EASE }}
          >
            <div className="fs-serif text-[64px] leading-none text-cream/15 md:text-[88px]">
              {s.n}
            </div>
            <div className="mt-4 text-[13px] uppercase tracking-[0.2em] text-cream">
              {s.title}
            </div>
            <div className="mt-2 max-w-[260px] text-[14px] leading-relaxed text-mist">
              {s.desc}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
