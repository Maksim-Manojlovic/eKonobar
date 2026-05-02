import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { B2BSection } from "@/components/landing/B2BSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { PassportShowcase } from "@/components/landing/PassportShowcase";
import { TopVenuesSection } from "@/components/landing/TopVenuesSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { Footer } from "@/components/landing/Footer";

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    const role = session.user?.role;
    if (role === "VENUE_OWNER")  redirect("/venue");
    else if (role === "ADMIN")   redirect("/admin");
    else if (role === "HEADHUNTER") redirect("/headhunter");
    else redirect("/waiter");
  }

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
