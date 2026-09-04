import { useState } from "react";
import Hero from "../components/landing/Hero";
import FrameworkSection from "../components/landing/FrameworkSection";
import SimulationPreviewModal from "../components/landing/SimulationPreviewModal";
import CustomCursor from "../components/landing/CustomCursor";

export default function Landing() {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div className="fs-root fs-cursor-none relative bg-abyss text-cream">
      <div className="fs-grain animate-grain" />
      <CustomCursor />

      <Hero onWatch={() => setPreviewOpen(true)} />
      <FrameworkSection />

      <SimulationPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </div>
  );
}
