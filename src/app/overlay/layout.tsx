import type { Metadata } from "next";
import { Prompt } from "next/font/google";

import "./overlay-reset.css";

// A separate Next.js root layout (own <html>/<body>) for the `/overlay/**`
// route group — it must NOT wrap pages in `@/ui/providers` (MUI +
// CssBaseline), since CssBaseline sets a non-transparent body background
// and pulls in styling the OBS browser-source overlay must not have. The
// transparent-body reset itself lives in ./overlay-reset.css, imported only
// here, so it can never leak into the (site) group via AlertPlayer's shared
// (animation-only) alert.css.
const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-prompt",
});

export const metadata: Metadata = {
  title: "TipPaw Overlay",
  description: "TipPaw alert overlay (OBS browser source)",
  robots: { index: false, follow: false },
};

export default function OverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={prompt.variable}>
      <body>{children}</body>
    </html>
  );
}
