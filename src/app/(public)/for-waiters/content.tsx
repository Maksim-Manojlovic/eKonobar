import { ShieldCheck, Star, Map, ArrowLeftRight, Palmtree, BadgeCheck } from "lucide-react";
import type { FAQItem } from "@/components/ui/FAQAccordion";
import type { FeatureTile } from "@/components/ui/FeatureGrid";
import type { NavLink } from "@/components/landing/LandingNav";

/**
 * Static content for /for-waiters — data separated from the page's view (CQ-W).
 * Kept as .tsx because FAQ answers carry inline JSX. Mirrors the repo convention
 * of co-located constants (cf. waiter-constants.ts).
 */

export const NAV_LINKS: NavLink[] = [
  { href: "#mogucnosti",   label: "Passport™"      },
  { href: "#verifikacija", label: "Verifikacija"   },
  { href: "#smene",        label: "Smene i odmori" },
  { href: "#faq",          label: "FAQ"            },
];

export const FOOTER_LINKS = [
  { href: "/",            label: "Početna"   },
  { href: "/for-waiters", label: "Passport™" },
  { href: "/for-venues",  label: "Za lokale" },
  { href: "/login",       label: "Prijava"   },
];

export const HERO_STATS = [
  { value: "2.400+", label: "aktivnih Passporta" },
  { value: "43%",    label: "brže do prve smene" },
  { value: "4.8★",   label: "prosečna ocena"     },
];

// The "what the Passport gives you" overview — one tile per feature.
export const WAITER_FEATURES: FeatureTile[] = [
  { Icon: ShieldCheck,    title: "Verifikovan identitet", desc: "Lična karta, jedan profil po osobi — bez lažnih duplikata." },
  { Icon: Star,           title: "Skor 0–100",           desc: "Bayesov skor iz stvarnih recenzija — ne kupuje se, zarađuje." },
  { Icon: Map,            title: "Živa mapa poslova",     desc: "Otvorene smene i oglasi u realnom vremenu, na mapi." },
  { Icon: ArrowLeftRight, title: "Zameni smenu",          desc: "Ne možeš da dođeš? Prebaci kolegi kroz aplikaciju." },
  { Icon: Palmtree,       title: "Godišnji iz app",       desc: "Zahtev + balans dana, auto-odobrenje po pravilima lokala." },
  { Icon: BadgeCheck,     title: "Sertifikati & badge",   desc: "Sanitarna, somelijer, jezici — uploaduješ jednom, važi svuda." },
];

export const faqItems: FAQItem[] = [
  {
    question: "Mogu li poneti Passport iz Beograda u Novi Sad ili Zagreb?",
    answer: (
      <>
        Da. Passport je vezan za tebe, ne za grad. Trenutno radimo u Beogradu, Novom Sadu i Nišu — Zagreb stiže u Q3 2026. Skor, verifikacija i sve recenzije se prenose, ne resetuju.
      </>
    ),
  },
  {
    question: "Šta ako vlasnik napiše nepravednu negativnu recenziju?",
    answer: (
      <>
        Imaš 14 dana da uložiš prigovor — naš tim moderira spor i može{" "}
        <strong className="font-semibold text-neutral-700">povući recenziju</strong> ako su dokazi nedosledni. Vlasnici sa istorijom nepravednih ocena gube pravo ocenjivanja.
      </>
    ),
  },
  {
    question: "Mogu li sakriti nizak skor od poslodavca?",
    answer: (
      <>
        Ne — to je suština sistema. Ali nizak skor na početku{" "}
        <strong className="font-semibold text-neutral-700">nije rupa</strong>; svi smo počeli odatle. Lokali koji traže iskusne ljude filtriraju po skoru, ali ima podosta otvorenih ka početnicima.
      </>
    ),
  },
  {
    question: "Da li skor opada ako mesec dana ne radim?",
    answer: (
      <>
        Skor ne opada zbog pauze — broj smena i recenzije ostaju. Ali aktivnost u poslednjih 90 dana{" "}
        <strong className="font-semibold text-neutral-700">poboljšava prioritet</strong> u algoritmu preporuke. Ako planiraš pauzu, postaviš status „nedostupan&rdquo; i ne kvariš statistiku.
      </>
    ),
  },
  {
    question: "Koliko košta Passport?",
    answer: (
      <>
        Za konobare je <strong className="font-semibold text-neutral-700">besplatan u celosti</strong> — profil, verifikacija, recenzije, geofenced smene, web push, WhatsApp i SMS notifikacije. Nema pretplate i nema pozicije u pretrazi koja se može kupiti; rangira te skor koji si zaradio. Vlasnici lokala plaćaju samo proviziju pri angažmanu.
      </>
    ),
  },
  {
    question: "Mogu li da tražim godišnji odmor preko aplikacije?",
    answer: (
      <>
        Da — ako radiš u stalnoj ekipi lokala. Pošalješ zahtev iz aplikacije, vidiš{" "}
        <strong className="font-semibold text-neutral-700">svoj balans dana</strong> i status u realnom vremenu. Ako zahtev prođe pravila lokala (dovoljno najave, slobodan kapacitet, van blackout dana) — <strong className="font-semibold text-neutral-700">auto-odobrava se</strong>, bez čekanja. Bolovanje se vodi zasebno i ne troši godišnji. Isto tako možeš da zameniš smenu sa kolegom ili uzmeš otvorenu smenu na mapi.
      </>
    ),
  },
];
