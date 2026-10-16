import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://101stdoombattalion.com";

  const routes = [
    "/",
    "/Who-We-Are",
    "/Join",
    "/certs",
    "/certifications",
    "/whos-who",
    "/recognition",
    "/rank-structure",
    "/uniform-guide",
    "/rules-and-regulations",
    "/documents",
    "/faq",
    "/audit",
    "/roster",
    "/grand-orbat",
    "/Tags",
    "/servers",
    "/hammer-ridealongs",
    "/Galactic-Campaign",
    "/Galactic-Campaign/operation-last-stand",
    "/Art-of-War",
    "/News",
    "/model-customiser",
    "/legal/privacy",
    "/legal/terms",
    "/legal/cookies",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    changeFrequency: "weekly",
    priority: route === "/" ? 1 : 0.8,
  }));
}
