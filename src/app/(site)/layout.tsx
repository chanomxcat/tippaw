import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "../globals.css";

import { getDeps } from "@/server/env";
import { getSiteUrl } from "@/server/site-url";
import { ToastProvider } from "@/components/ui/toast";

const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-prompt",
});

const SITE_NAME = "TipPaw";
const SITE_DESCRIPTION =
  "แพลตฟอร์มรับโดเนทสำหรับสตรีมเมอร์ไทย สร้างหน้ารับทิปของคุณเอง แจ้งเตือนแบบเรียลไทม์ผ่าน overlay ใน OBS";

export async function generateMetadata(): Promise<Metadata> {
  const deps = await getDeps();
  const url = getSiteUrl(deps);

  return {
    metadataBase: new URL(url),
    title: {
      default: `${SITE_NAME} — แพลตฟอร์มรับโดเนทสำหรับสตรีมเมอร์ไทย`,
      template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    keywords: [
      "TipPaw",
      "รับโดเนท",
      "โดเนทสตรีมเมอร์",
      "donation platform",
      "streamer donation",
      "overlay alert",
      "OBS alert",
    ],
    applicationName: SITE_NAME,
    openGraph: {
      type: "website",
      locale: "th_TH",
      siteName: SITE_NAME,
      title: `${SITE_NAME} — แพลตฟอร์มรับโดเนทสำหรับสตรีมเมอร์ไทย`,
      description: SITE_DESCRIPTION,
      url: "/",
    },
    twitter: {
      card: "summary",
      title: `${SITE_NAME} — แพลตฟอร์มรับโดเนทสำหรับสตรีมเมอร์ไทย`,
      description: SITE_DESCRIPTION,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    inLanguage: "th",
  };

  return (
    <html lang="th" className={prompt.variable} suppressHydrationWarning>
      <head>
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("tippaw-theme");var t=s==="tippaw"||s==="tippaw-dark"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"tippaw-dark":"tippaw");document.documentElement.dataset.theme=t;}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
