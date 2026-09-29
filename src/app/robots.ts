import type { MetadataRoute } from "next";

import { getDeps } from "@/server/env";
import { getSiteUrl } from "@/server/site-url";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const deps = await getDeps();
  const siteUrl = getSiteUrl(deps);

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/dashboard",
        "/onboarding",
        "/login",
        "/register",
        "/mock",
        "/overlay",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
