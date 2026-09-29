import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getDeps } from "@/server/env";
import { getPublicTipPage } from "@/server/tip-page/tip-page";

import { TipForm } from "./TipForm";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const deps = await getDeps();
  const page = await getPublicTipPage(deps, slug);

  if (!page) {
    return { title: "ไม่พบหน้านี้", robots: { index: false, follow: false } };
  }

  const description = `โดเนทสนับสนุน ${page.channelName} ผ่าน TipPaw — แพลตฟอร์มรับโดเนทสำหรับสตรีมเมอร์ไทย`;
  const url = `/${page.slug}`;

  return {
    title: page.channelName,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      locale: "th_TH",
      title: page.channelName,
      description,
      url,
    },
    twitter: {
      card: "summary",
      title: page.channelName,
      description,
    },
    robots: page.accepting ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function TipPage({ params }: { params: Params }) {
  const { slug } = await params;
  const deps = await getDeps();
  const page = await getPublicTipPage(deps, slug);
  if (!page) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: page.channelName,
      url: `/${page.slug}`,
      sameAs: page.links.map((link) => link.url),
    },
  };

  return (
    <div className="mx-auto flex max-w-xs flex-col gap-6 py-8">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="card bg-base-100 shadow p-8 text-center">
        <h1 className="mb-2 text-3xl font-medium">{page.channelName}</h1>
        {page.links.length > 0 && (
          <div className="flex flex-col gap-2">
            {page.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-block"
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>

      {page.accepting ? (
        <TipForm
          slug={page.slug}
          minThb={Number(deps.env.MIN_DONATION_THB)}
          maxThb={Number(deps.env.MAX_DONATION_THB)}
        />
      ) : (
        <div className="card bg-base-100 shadow p-8">
          <div role="alert" className="alert alert-info">
            <span>ยังไม่เปิดรับโดเนท</span>
          </div>
        </div>
      )}
    </div>
  );
}
