import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const LINKS = ["HOME", "PLATFORM", "METHODOLOGY", "IMPACT", "ABOUT"];

export default function Navbar() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="relative z-30 flex items-center justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6 md:px-10 md:pt-8"
    >
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <svg width="26" height="16" viewBox="0 0 30 18" fill="none" className="shrink-0 text-cream/85 sm:h-[18px] sm:w-[30px]">
          <path d="M1 13.5C4.2 7.5 7.4 7.5 10.5 13.5C13.7 19.5 16.8 19.5 20 13.5C23.2 7.5 26.3 7.5 29.5 13.5" stroke="currentColor" strokeWidth="1" />
          <path d="M1 6C4.2 1.8 7.4 1.8 10.5 6C13.7 10.2 16.8 10.2 20 6C23.2 1.8 26.3 1.8 29.5 6" stroke="currentColor" strokeWidth="1" opacity="0.45" />
        </svg>
        <div className="min-w-0 leading-none">
          <div className="whitespace-nowrap text-[13px] tracking-[0.06em] text-cream sm:text-[14px]">
            FLOOD<span className="text-water">//</span>SIM
          </div>
          <div className="mt-1 hidden whitespace-nowrap text-[8.5px] uppercase tracking-[0.32em] text-mist/65 sm:block">
            HADR Intelligence Platform
          </div>
        </div>
      </div>

      <nav className="hidden items-center gap-9 text-[11px] uppercase tracking-[0.18em] text-mist/80 lg:flex">
        {LINKS.map((l) => (
          <a
            key={l}
            href={`#${l.toLowerCase()}`}
            data-cursor="hover"
            className="transition-colors duration-300 hover:text-cream"
          >
            {l}
          </a>
        ))}
      </nav>

      <Link
        to="/dashboard"
        data-cursor="open"
        className="group inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-cream/25 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-cream/90 transition-all duration-300 hover:border-cream/60 hover:bg-cream/[0.06] sm:gap-2 sm:px-4 sm:text-[11px] sm:tracking-[0.16em]"
      >
        Launch App
        <ArrowRight size={13} className="transition-transform duration-300 group-hover:translate-x-1.5" />
      </Link>
    </motion.header>
  );
}
