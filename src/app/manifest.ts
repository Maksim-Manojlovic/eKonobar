import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             "eKonobar",
    short_name:       "eKonobar",
    description:      "Digitalni pasoš za konobara — Waiter Passport™",
    start_url:        "/",
    display:          "standalone",
    orientation:      "portrait",
    background_color: "#120a00",
    theme_color:      "#fb923c",
    categories:       ["business", "productivity"],
    icons: [
      {
        src:     "/icons/72",
        sizes:   "72x72",
        type:    "image/png",
        purpose: "any",
      },
      {
        src:     "/icons/192",
        sizes:   "192x192",
        type:    "image/png",
        purpose: "maskable",
      },
      {
        src:     "/apple-icon",
        sizes:   "180x180",
        type:    "image/png",
        purpose: "any",
      },
    ],
  };
}
