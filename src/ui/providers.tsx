"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v13-appRouter";

import { ThemeProvider } from "./minimal/theme";

// ----------------------------------------------------------------------
// AppRouterCacheProvider (Emotion SSR for the App Router) + the TipPaw
// MUI theme (palette/typography, spec §11) + CssBaseline.
// ----------------------------------------------------------------------

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: "mui" }}>
      <ThemeProvider>{children}</ThemeProvider>
    </AppRouterCacheProvider>
  );
}
