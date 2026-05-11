"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Session } from "next-auth";

type TourUser = NonNullable<Session["user"]>;

function buildSteps(mobile: boolean) {
  const sidebarId = mobile ? "#tour-sidebar" : "#tour-sidebar-desktop";
  const p = mobile ? "mob-tour" : "tour";
  return [
    {
      element: sidebarId,
      popover: {
        title: "Navigacija",
        description: "Sve sekcije dashboarda su ovde — prelazi između Pregleda, Oglasa, Smena i ostalih jednim klikom.",
        side: "right" as const,
        align: "start" as const,
      },
    },
    {
      element: `#${p}-nav-posts`,
      popover: {
        title: "Oglasi za posao",
        description: "Postavi novi oglas i primaj prijave od verifikovanih konobara. Red Alert™ oglasi imaju prioritetnu distribuciju.",
        side: "right" as const,
        align: "center" as const,
      },
    },
    {
      element: `#${p}-nav-smene`,
      popover: {
        title: "Upravljanje smenama",
        description: "Zakazuj smene, prati ko se prijavio i odobravaj clock-in zahteve uživo.",
        side: "right" as const,
        align: "center" as const,
      },
    },
    {
      element: `#${p}-nav-waiters`,
      popover: {
        title: "Tvoj tim",
        description: "Konobari sa prihvaćenim prijavama postaju deo tvog tima. Njima prvi stignu oglasi pre nego idu na otvoreno tržište.",
        side: "right" as const,
        align: "center" as const,
      },
    },
    {
      element: "#tour-notifications",
      popover: {
        title: "Obaveštenja",
        description: "Prijave, clock-in zahtevi i zamene smena — sve u realnom vremenu. Sistem šalje i web push notifikacije.",
        side: "bottom" as const,
        align: "end" as const,
      },
    },
    {
      element: "#tour-profile-avatar",
      popover: {
        title: "Profil lokala",
        description: "Dodaj fotografije, kontakt i opis lokala. Bolji profil = više prijava od kvalitetnih konobara.",
        side: "bottom" as const,
        align: "end" as const,
      },
    },
  ];
}

async function buildDriver() {
  const { driver } = await import("driver.js");
  // @ts-expect-error — no type declarations for CSS asset
  await import("driver.js/dist/driver.css");
  return driver;
}

export function useDashboardTour(user: TourUser | undefined) {
  const driverFactory = useRef<typeof import("driver.js")["driver"] | null>(null);

  const startTour = useCallback(async () => {
    if (!driverFactory.current) {
      driverFactory.current = await buildDriver();
    }
    const mobile = window.innerWidth < 768;
    const driverObj = driverFactory.current({
      showProgress: true,
      animate: true,
      overlayOpacity: 0.65,
      smoothScroll: true,
      allowClose: true,
      progressText: "{{current}} / {{total}}",
      nextBtnText: "Sledeće →",
      prevBtnText: "← Nazad",
      doneBtnText: "Gotovo",
      steps: buildSteps(mobile),
      onDestroyStarted: () => {
        driverObj.destroy();
        fetch("/api/user/tour-complete", { method: "PATCH" }).catch(() => {});
      },
    });
    driverObj.drive();
  }, []);

  useEffect(() => {
    if (!user || user.tourCompleted) return;
    startTour();
  }, [user?.id, user?.tourCompleted]); // eslint-disable-line react-hooks/exhaustive-deps

  return { startTour };
}
