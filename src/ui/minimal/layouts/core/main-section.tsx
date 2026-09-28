"use client";

import { mergeClasses } from "minimal-shared/utils";

import { styled } from "@mui/material/styles";

import { layoutClasses } from "./classes";

// ----------------------------------------------------------------------
// Ported from minimal-ui-kit/material-kit-react (MIT) — see ../../LICENSE.md
// ----------------------------------------------------------------------

export type MainSectionProps = React.ComponentProps<typeof MainRoot>;

export function MainSection({ children, className, sx, ...other }: MainSectionProps) {
  return (
    <MainRoot className={mergeClasses([layoutClasses.main, className])} sx={sx} {...other}>
      {children}
    </MainRoot>
  );
}

// ----------------------------------------------------------------------

const MainRoot = styled("main")({
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column",
});
