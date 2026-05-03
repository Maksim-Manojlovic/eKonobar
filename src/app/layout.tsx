import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import { SessionProvider } from "@/components/providers/SessionProvider";
import "./globals.css";

const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: {
    default: "eKonobar — Pronađi savršen angažman",
    template: "%s | eKonobar",
  },
  description:
    "Prva platforma sa Waiter Passport™ sistemom i geofencing recenzijama. Povežite se sa najboljim lokalima u Beogradu.",
  keywords: ["konobar", "posao", "ugostiteljstvo", "Srbija", "lokal", "restoran", "Beograd"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sr" className={lexend.variable}>
      <body className="min-h-screen bg-cream-50 text-neutral-900 antialiased" suppressHydrationWarning>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
