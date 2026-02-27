import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://101stdoombattalion.com";

  const routes = [
    "/",
    "/Who-Are-We",
    "/certifications",
    "/Galactic-Campaign",
    "/pcs",
    "/Art-of-War",
    "/personnel-profile",
    "/grand-orbat",
    "/roster",
    "/servers",
    "/vault",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "/" ? 1 : 0.8,
  }));
}