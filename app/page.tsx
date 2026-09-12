import Basketball3D from "@/components/Basketball3D";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import VideoToData from "@/components/VideoToData";
import AnnotationTimeline from "@/components/AnnotationTimeline";
import BasketballCourt from "@/components/BasketballCourt";
import Analytics from "@/components/Analytics";
import DataVisualization from "@/components/DataVisualization";
import Features from "@/components/Features";
import CinematicStatement from "@/components/CinematicStatement";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="fixed left-4 top-4 z-[100] -translate-y-24 bg-orange px-4 py-2 text-sm font-semibold text-background transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>

      <Basketball3D />
      <Navbar />

      <main id="main">
        <Hero />
        <VideoToData />
        <AnnotationTimeline />
        <BasketballCourt />
        <Analytics />
        <DataVisualization />
        <Features />
        <CinematicStatement />
        <FinalCTA />
      </main>

      <Footer />
    </>
  );
}
