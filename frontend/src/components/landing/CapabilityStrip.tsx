import { motion } from "framer-motion";

const ITEMS = [
  { n: "01", l1: "REAL-TIME", l2: "SIMULATION" },
  { n: "02", l1: "SPH + DELFT3D", l2: "MODELLING" },
  { n: "03", l1: "GIS-DRIVEN", l2: "ANALYSIS" },
  { n: "04", l1: "HADR", l2: "IMPACT ASSESSMENT" },
];

export default function CapabilityStrip() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 1.9, ease: [0.16, 1, 0.3, 1] }}
      className="grid grid-cols-2 gap-x-8 gap-y-4 sm:flex sm:gap-0 sm:divide-x sm:divide-cream/10"
    >
      {ITEMS.map((it) => (
        <div key={it.n} className="sm:px-7 sm:first:pl-0 md:px-9">
          <div className="text-[10px] tabular-nums text-steel">{it.n}</div>
          <div className="mt-1.5 text-[11px] uppercase leading-tight tracking-[0.12em] text-cream/90">
            {it.l1}
          </div>
          <div className="text-[11px] uppercase leading-tight tracking-[0.12em] text-mist/70">
            {it.l2}
          </div>
        </div>
      ))}
    </motion.div>
  );
}
