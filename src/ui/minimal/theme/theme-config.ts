import type { CommonColors } from "@mui/material/styles";

import type { ThemeCssVariables } from "./types";
import type { PaletteColorNoChannels } from "./core/palette";

// ----------------------------------------------------------------------
// Ported from minimal-ui-kit/material-kit-react (MIT) — see ../LICENSE.md
// Palette values replaced with the TipPaw palette (spec §11); font family
// points at the self-hosted Prompt font (see src/app/layout.tsx).
// ----------------------------------------------------------------------

type ThemeConfig = {
  classesPrefix: string;
  cssVariables: ThemeCssVariables;
  fontFamily: Record<"primary" | "secondary", string>;
  palette: Record<
    "primary" | "secondary" | "info" | "success" | "warning" | "error",
    PaletteColorNoChannels
  > & {
    common: Pick<CommonColors, "black" | "white">;
    grey: Record<
      "50" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900",
      string
    >;
  };
};

export const themeConfig: ThemeConfig = {
  /** **************************************
   * Base
   *************************************** */
  classesPrefix: "tippaw",
  /** **************************************
   * Typography
   *************************************** */
  fontFamily: {
    primary: "var(--font-prompt)",
    secondary: "var(--font-prompt)",
  },
  /** **************************************
   * Palette (spec §11 "UI & Design system")
   *************************************** */
  palette: {
    primary: {
      lighter: "#E7D6E3",
      light: "#AF719D",
      main: "#8B639B",
      dark: "#403D88",
      darker: "#2A2860",
      contrastText: "#FFFFFF",
    },
    secondary: {
      lighter: "#FDE3E3",
      light: "#FBC9C9",
      main: "#F8B2B2",
      dark: "#C97D7D",
      darker: "#8F5252",
      contrastText: "#403D88",
    },
    // success/warning/error/info/grey: ใช้ค่าเดิมของ Minimal (spec §11)
    info: {
      lighter: "#CAFDF5",
      light: "#61F3F3",
      main: "#00B8D9",
      dark: "#006C9C",
      darker: "#003768",
      contrastText: "#FFFFFF",
    },
    success: {
      lighter: "#D3FCD2",
      light: "#77ED8B",
      main: "#22C55E",
      dark: "#118D57",
      darker: "#065E49",
      contrastText: "#ffffff",
    },
    warning: {
      lighter: "#FFF5CC",
      light: "#FFD666",
      main: "#FFAB00",
      dark: "#B76E00",
      darker: "#7A4100",
      contrastText: "#1C252E",
    },
    error: {
      lighter: "#FFE9D5",
      light: "#FFAC82",
      main: "#FF5630",
      dark: "#B71D18",
      darker: "#7A0916",
      contrastText: "#FFFFFF",
    },
    grey: {
      "50": "#FCFDFD",
      "100": "#F9FAFB",
      "200": "#F4F6F8",
      "300": "#DFE3E8",
      "400": "#C4CDD5",
      "500": "#919EAB",
      "600": "#637381",
      "700": "#454F5B",
      "800": "#1C252E",
      "900": "#141A21",
    },
    common: { black: "#000000", white: "#FFFFFF" },
  },
  /** **************************************
   * Css variables
   *************************************** */
  cssVariables: {
    cssVarPrefix: "",
    colorSchemeSelector: "data-color-scheme",
  },
};
