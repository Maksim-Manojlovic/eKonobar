export type Lang = "sr" | "en" | "ru";

export const FLAGS = [
  { code: "sr" as Lang, name: "Srpski" },
  { code: "en" as Lang, name: "English" },
  { code: "ru" as Lang, name: "Русский" },
];

export const translations = {
  sr: {
    preloader: {
      tagline: "Digitalni pasoš za ugostiteljstvo",
      ownerTitle: "Nastavi kao vlasnik",
      ownerSubtitle: "Objavite oglase, verifikujte osoblje",
      ownerBadge: "Za lokale",
      waiterTitle: "Nastavi kao konobar",
      waiterSubtitle: "Izgradite digitalni pasoš karijere",
      waiterBadge: "Za konobara",
      haveAccount: "Već imate nalog?",
      signIn: "Prijavite se",
    },
  },
  en: {
    preloader: {
      tagline: "Digital passport for hospitality",
      ownerTitle: "Continue as owner",
      ownerSubtitle: "Post jobs, verify your staff",
      ownerBadge: "For venues",
      waiterTitle: "Continue as waiter",
      waiterSubtitle: "Build your digital career passport",
      waiterBadge: "For waiters",
      haveAccount: "Already have an account?",
      signIn: "Sign in",
    },
  },
  ru: {
    preloader: {
      tagline: "Цифровой паспорт для гостеприимства",
      ownerTitle: "Продолжить как владелец",
      ownerSubtitle: "Размещайте вакансии, верифицируйте персонал",
      ownerBadge: "Для заведений",
      waiterTitle: "Продолжить как официант",
      waiterSubtitle: "Создайте цифровой паспорт карьеры",
      waiterBadge: "Для официантов",
      haveAccount: "Уже есть аккаунт?",
      signIn: "Войти",
    },
  },
} as const;

export type TranslationNamespace = keyof typeof translations.sr;
export type TranslationKeys<N extends TranslationNamespace> = keyof typeof translations.sr[N];
