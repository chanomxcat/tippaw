import type { MetadataRoute } from "next";

import { getDeps } from "@/server/env";
import { getSiteUrl } from "@/server/site-url";
import { listAcceptingSlugs } from "@/server/tip-page/tip-page";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const deps = await getDeps();
  const slugs = await listAcceptingSlugs(deps);
  const baseUrl = getSiteUrl(deps);

  return [
    {
      url: baseUrl,
      changeFrequency: "monthly",
      priority: 1,
    },
    ...slugs.map((slug) => ({
      url: `${baseUrl}/${slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
