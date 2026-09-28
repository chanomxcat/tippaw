import { themeConfig } from "./theme-config";

// ----------------------------------------------------------------------
// Ported from minimal-ui-kit/material-kit-react (MIT) — see ../LICENSE.md
// ----------------------------------------------------------------------

export function createClasses(className: string): string {
  return `${themeConfig.classesPrefix}__${className}`;
}
