"use client";

import type { LinkProps } from "@mui/material/Link";

import { mergeClasses } from "minimal-shared/utils";

import Link from "@mui/material/Link";
import { styled, useTheme } from "@mui/material/styles";

import { RouterLink } from "../router-link";

import { logoClasses } from "./classes";

// ----------------------------------------------------------------------
// Structural port of minimal-ui-kit/material-kit-react's Logo (MIT) —
// see ../../LICENSE.md. The original's bird artwork is Minimal's own
// brand mark; replaced here with a simple TipPaw wordmark/badge using
// the TipPaw palette (spec §11) instead of porting unrelated artwork.
// ----------------------------------------------------------------------

export type LogoProps = LinkProps & {
  isSingle?: boolean;
  disabled?: boolean;
};

export function Logo({
  sx,
  disabled,
  className,
  href = "/",
  isSingle = true,
  ...other
}: LogoProps) {
  const theme = useTheme();

  const singleLogo = (
    <svg width="100%" height="100%" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill={theme.vars.palette.primary.main} />
      <text
        x="50%"
        y="54%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={theme.vars.palette.common.white}
        fontFamily={theme.typography.fontFamily}
        fontWeight={700}
        fontSize="18"
      >
        T
      </text>
    </svg>
  );

  const fullLogo = (
    <svg width="100%" height="100%" viewBox="0 0 140 36" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="9" fill={theme.vars.palette.primary.main} />
      <text
        x="18"
        y="19.5"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={theme.vars.palette.common.white}
        fontFamily={theme.typography.fontFamily}
        fontWeight={700}
        fontSize="16"
      >
        T
      </text>
      <text
        x="48"
        y="19.5"
        dominantBaseline="middle"
        fill={theme.vars.palette.primary.dark}
        fontFamily={theme.typography.fontFamily}
        fontWeight={700}
        fontSize="20"
      >
        TipPaw
      </text>
    </svg>
  );

  return (
    <LogoRoot
      component={RouterLink}
      href={href}
      aria-label="Logo"
      underline="none"
      className={mergeClasses([logoClasses.root, className])}
      sx={[
        {
          width: 40,
          height: 40,
          ...(!isSingle && { width: 102, height: 36 }),
          ...(disabled && { pointerEvents: "none" }),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      {isSingle ? singleLogo : fullLogo}
    </LogoRoot>
  );
}

// ----------------------------------------------------------------------

const LogoRoot = styled(Link)(() => ({
  flexShrink: 0,
  color: "transparent",
  display: "inline-flex",
  verticalAlign: "middle",
}));
