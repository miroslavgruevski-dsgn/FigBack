import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FigBack",
    short_name: "FigBack",
    description: "Turn messy Figma comments into organized, prioritized design feedback.",
    start_url: "/",
    display: "standalone",
    background_color: "#1a1a2e",
    theme_color: "#6d5ce7",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
