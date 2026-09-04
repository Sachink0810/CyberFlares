import { motion } from "framer-motion";

export default function ScrollIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay: 2.2 }}
      className="flex flex-col items-center gap-2.5"
    >
      <span className="text-[9px] uppercase tracking-[0.32em] text-mist/55">Scroll</span>
      <div className="relative h-8 w-px overflow-hidden bg-cream/15">
        <div className="absolute inset-x-0 top-0 h-full origin-top animate-scroll-line bg-cream/60" />
      </div>
    </motion.div>
  );
}
