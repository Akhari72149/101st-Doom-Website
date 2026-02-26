import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://https://101stdoombattalion.com/";

  const routes = [
    "/",
    "/Who-Are-We",
    "/certifications",
    "/galactic-campaign",
    "/pcs",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "/" ? 1 : 0.8,
  }));
}