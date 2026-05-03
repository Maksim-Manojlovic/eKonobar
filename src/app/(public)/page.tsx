import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { B2BSection } from "@/components/landing/B2BSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { PassportShowcase } from "@/components/landing/PassportShowcase";
import { TopVenuesSection } from "@/components/landing/TopVenuesSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { Footer } from "@/components/landing/Footer";

export default async function LandingPage() {
  return (
    <main className="bg-white">
      <Navbar />
      <HeroSection />
      <B2BSection />
      <HowItWorksSection />
      <PassportShowcase />
      <TopVenuesSection />
      <FAQSection />
      <Footer />
    </main>
  );
}
