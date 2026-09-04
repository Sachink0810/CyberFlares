import { AnimatePresence, motion } from "framer-motion";
import { Play, X } from "lucide-react";

export default function SimulationPreviewModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-abyss/90 p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-4xl"
            initial={{ opacity: 0, scale: 0.97, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4">
              <span className="text-[10px] uppercase tracking-[0.32em] text-mist/70">
                Simulation Preview
              </span>
              <button
                onClick={onClose}
                data-cursor="hover"
                aria-label="Close preview"
                className="text-cream/70 transition-colors hover:text-cream"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <div className="relative aspect-video w-full overflow-hidden border border-cream/12 bg-graphite">
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  background:
                    "radial-gradient(circle at center, rgba(110,157,165,0.28), transparent 70%)",
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  data-cursor="play"
                  aria-label="Play simulation preview"
                  className="flex h-16 w-16 items-center justify-center rounded-full border border-cream/30 transition-colors duration-300 hover:border-cream/70"
                >
                  <Play size={18} className="ml-1 fill-cream text-cream" />
                </button>
              </div>
              <span className="absolute bottom-4 right-4 text-[10px] tabular-nums text-mist/60">
                00:00 / 02:14
              </span>
            </div>

            <div className="relative mt-4 h-px w-full bg-cream/10">
              <div className="absolute left-0 top-0 h-px w-0 bg-water" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
