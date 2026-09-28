import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";

import { Providers } from "@/ui/providers";

const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-prompt",
});

export const metadata: Metadata = {
  title: "TipPaw",
  description: "แพลตฟอร์มรับโดเนทสำหรับสตรีมเมอร์",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={prompt.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
