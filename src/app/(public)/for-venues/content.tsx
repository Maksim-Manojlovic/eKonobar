import { Zap, CalendarDays, MapPin, Users, Palmtree, Search } from "lucide-react";
import type { FAQItem } from "@/components/ui/FAQAccordion";
import type { FeatureTile } from "@/components/ui/FeatureGrid";
import type { NavLink } from "@/components/landing/LandingNav";

/**
 * Static content for /for-venues — data separated from the page's view (CQ-W).
 * .tsx because FAQ answers carry inline JSX. Mirrors the co-located-constants
 * convention (cf. venue-constants.ts).
 */

export const NAV_LINKS_VENUE: NavLink[] = [
  { href: "#mogucnosti", label: "Mogućnosti"       },
  { href: "#kako-radi",  label: "Kako funkcioniše" },
  { href: "#cenovnik",   label: "Cenovnik"         },
  { href: "#faq",        label: "FAQ"              },
];

export const FOOTER_LINKS = [
  { href: "/for-waiters", label: "Za konobare" },
  { href: "/for-waiters", label: "Passport™"   },
  { href: "/for-venues",  label: "Za lokale"   },
  { href: "/login",       label: "Prijava"     },
];

export const HERO_STATS = [
  { value: "10k+",   label: "aktivnih ugostitelja" },
  { value: "12 min", label: "prosečna popuna"      },
  { value: "5–8%",   label: "provizija po smeni"   },
  { value: "182k",   label: "ušteda/mes (RSD)"     },
];

// eKonobar vs agencije — [what you need, agency, eKonobar].
export const COMPARISON_ROWS: [string, string, string][] = [
  ["Vreme do popune smene", "2–4 sata", "↓ 11 minuta"],
  ["Provizija", "22–28%", "5–8%"],
  ["Vidiš istoriju kandidata", "Ne", "Pun Passport™ ✓"],
  ["Raspored i templati smena", "Ručno / Excel", "Auto ✓"],
  ["Godišnji odmori po Zakonu o radu", "Papir / tabela", "Auto balans ✓"],
  ["Plaćaš za neuspešno popunjenu smenu", "Da (pretplata)", "0 RSD ✓"],
];

// The "what eKonobar does" overview — scannable, one tile per feature.
export const VENUE_FEATURES: FeatureTile[] = [
  { Icon: Zap,          title: "Hitna zamena",       desc: "Fali čovek? Smena ide na marketplace — prva prijava za ~12 min." },
  { Icon: CalendarDays, title: "Raspored & templati", desc: "Generiši ceo mesec smena iz šablona, ne ručno." },
  { Icon: MapPin,       title: "GPS check-in",        desc: "Geofencing potvrđuje dolazak — bez lažiranja sati." },
  { Icon: Users,        title: "Sala + kuhinja",      desc: "Ceo tim po pozicijama, FOH i BOH odvojeno." },
  { Icon: Palmtree,     title: "Godišnji odmori",     desc: "Balans po Zakonu o radu, auto-odobrenje po tvojim pravilima." },
  { Icon: Search,       title: "Passport pretraga",   desc: "Filtriraj konobare po skoru, veštini, sanitarnoj, opštini." },
];

export const faqItems: FAQItem[] = [
  {
    question: "Šta ako konobar ne dođe na smenu?",
    answer: (
      <>
        <strong className="font-semibold text-neutral-700">Ne plaćaš ništa</strong> — provizija se naplaćuje samo na verifikovano odrađenu smenu. Sistem automatski aktivira{" "}
        <strong className="font-semibold text-neutral-700">Red Alert™ rezervu</strong>: ako konobar ne potvrdi check-in 30 minuta pre smene, oglas ide ponovo. Pouzdanost u Passport-u tog konobara pada — što ga isključuje iz tvog filtera u budućnosti.
      </>
    ),
  },
  {
    question: "Da li je ovo radni odnos? Imam li obavezu poreza/doprinosa?",
    answer: (
      <>
        eKonobar generiše <strong className="font-semibold text-neutral-700">ugovor o privremenim i povremenim poslovima</strong> (omladinska/studentska zadruga ili honorarni rad — biraš model). Sve poreske obaveze obračunava i prijavljuje sistem. Ti dobijaš jednu fakturu mesečno sa obračunom za svaku smenu.
      </>
    ),
  },
  {
    question: "Mogu li da odbijem konobara koji se prijavi?",
    answer: (
      <>
        Naravno. Vidiš sve prijave, biraš koga god hoćeš (ili nikog) — bez obrazloženja, bez kazne. Ako želiš, postaviš filter (Gold+, sanitarna, jezik) — sistem te i ne uznemirava sa kandidatima koji ga ne ispunjavaju.
      </>
    ),
  },
  {
    question: "Šta sa konobarima koje već imam — mogu li ih dodati u sistem?",
    answer: (
      <>
        Da. Pošalješ pozivnicu — oni naprave Passport za 5 minuta i postaju deo{" "}
        <strong className="font-semibold text-neutral-700">&quot;Tvog tima&quot;</strong>. Sledeću smenu prvo vide oni, pa tek onda ide na otvoreno tržište. Ako ne odgovaraju u roku od sat vremena, sistem je automatski objavljuje šire.
      </>
    ),
  },
  {
    question: "Šta ako konobar napiše negativnu recenziju o mom lokalu?",
    answer: (
      <>
        Sistem je <strong className="font-semibold text-neutral-700">obostran i transparentan</strong> — gradiš reputaciju kao dobar poslodavac (uredne smene, plaćanje na vreme, atmosfera). Imaš 14 dana za prigovor; nepravedne ocene moderira naš tim. Lokali sa visokom ocenom dobijaju oznaku &quot;Top poslodavac&quot; — i prioritet kod najboljih konobara.
      </>
    ),
  },
  {
    question: "Kako tačno funkcioniše plaćanje?",
    answer: (
      <>
        Kada potvrdiš ponudu, iznos plate ide u <strong className="font-semibold text-neutral-700">escrow</strong> (zaštićen na našem računu). Kad sistem verifikuje da je smena završena, novac se prebacuje konobaru u roku od 24h. Ti dobijaš jednu zbirnu fakturu na kraju meseca — provizija + isplate, sa PDV-om.
      </>
    ),
  },
  {
    question: "Da li pokrivate kuhinju ili samo konobare?",
    answer: (
      <>
        I kuhinju. Osoblje se vodi kroz dva sektora —{" "}
        <strong className="font-semibold text-neutral-700">sala (FOH)</strong> i{" "}
        <strong className="font-semibold text-neutral-700">kuhinja (BOH)</strong> — sa pozicijama od konobara, šankera i šefa sale do šefa kuhinje, su-šefa i kuvara. Svaki sektor ima svoj raspored, kapacitet i pravila za odmore; šef sale i šef kuhinje vode svoj deo, a ti vidiš sve na jednom mestu.
      </>
    ),
  },
  {
    question: "Kako radi godišnji odmor u sistemu?",
    answer: (
      <>
        Zaposleni pošalje zahtev iz aplikacije. Sistem računa balans dana po{" "}
        <strong className="font-semibold text-neutral-700">Zakonu o radu</strong> (26 dana po difoltu, iznad zakonskog minimuma od 20) i{" "}
        <strong className="font-semibold text-neutral-700">automatski odobrava</strong> ako zahtev prođe tvoja pravila — dovoljno najave, slobodan kapacitet i van blackout dana. Blackout dane postavljaš za špic sezonu (npr. „niko na odmoru za Novu godinu&rdquo;), a ograničiš i koliko ljudi sme biti na odmoru istog dana po sektoru. Bolovanje se vodi zasebno i ne troši godišnji.
      </>
    ),
  },
];
