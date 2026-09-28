import type {
  Shadows,
  ColorSystemOptions,
  CssVarsThemeOptions,
  SupportedColorScheme,
  ThemeOptions as MuiThemeOptions,
} from "@mui/material/styles";

import type { CustomShadows } from "./core/custom-shadows";

// ----------------------------------------------------------------------
// Ported from minimal-ui-kit/material-kit-react (MIT) — see ../LICENSE.md
// ----------------------------------------------------------------------

export type ThemeColorScheme = SupportedColorScheme;
export type ThemeCssVariables = Pick<
  CssVarsThemeOptions,
  "colorSchemeSelector" | "disableCssColorScheme" | "cssVarPrefix" | "shouldSkipGeneratingVar"
>;

type ColorSchemeOptionsExtended = ColorSystemOptions & {
  shadows?: Shadows;
  customShadows?: CustomShadows;
};

export type ThemeOptions = Omit<MuiThemeOptions, "components"> &
  Pick<CssVarsThemeOptions, "defaultColorScheme" | "components"> & {
    colorSchemes?: Partial<Record<ThemeColorScheme, ColorSchemeOptionsExtended>>;
    cssVariables?: ThemeCssVariables;
  };
