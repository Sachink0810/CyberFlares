import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

type CursorVariant = "default" | "hover" | "play" | "open";

const SIZE: Record<CursorVariant, number> = {
  default: 8,
  hover: 40,
  play: 64,
  open: 64,
};

export default function CustomCursor() {
  const [variant, setVariant] = useState<CursorVariant>("default");
  const [visible, setVisible] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 480, damping: 38, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 480, damping: 38, mass: 0.4 });

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const move = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      const el = (e.target as HTMLElement)?.closest?.("[data-cursor]");
      const next = (el?.getAttribute("data-cursor") as CursorVariant | null) ?? "default";
      setVariant(next);
    };
    const onEnter = () => setVisible(true);
    const onLeave = () => setVisible(false);

    window.addEventListener("mousemove", move);
    document.documentElement.addEventListener("mouseenter", onEnter);
    document.documentElement.addEventListener("mouseleave", onLeave);
    setVisible(true);

    return () => {
      window.removeEventListener("mousemove", move);
      document.documentElement.removeEventListener("mouseenter", onEnter);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, [x, y]);

  if (!visible) return null;

  const label = variant === "play" ? "Play" : variant === "open" ? "Open" : null;

  return (
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-[100] hidden items-center justify-center rounded-full border border-cream/70 mix-blend-difference md:flex"
      style={{ x: sx, y: sy, translateX: "-50%", translateY: "-50%" }}
      animate={{
        width: SIZE[variant],
        height: SIZE[variant],
        backgroundColor: variant === "default" ? "#F1F0EA" : "rgba(241,240,234,0)",
      }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      {label && (
        <span className="text-[9px] uppercase tracking-[0.22em] text-cream">{label}</span>
      )}
    </motion.div>
  );
}
