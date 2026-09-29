import type { Metadata } from "next";

import { TippawLogo } from "@/components/brand/logo";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-pearls flex min-h-screen flex-col items-center px-4 pt-8 pb-12">
      <TippawLogo size={44} />
      <div className="w-full flex-1">{children}</div>
    </div>
  );
}
