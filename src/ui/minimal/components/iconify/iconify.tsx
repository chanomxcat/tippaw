"use client";

import type { IconProps } from "@iconify/react";

import { useId } from "react";
import { Icon } from "@iconify/react";
import { mergeClasses } from "minimal-shared/utils";

import { styled } from "@mui/material/styles";

import { iconifyClasses } from "./classes";

// ----------------------------------------------------------------------
// Simplified port of minimal-ui-kit/material-kit-react's Iconify (MIT) —
// see ../../LICENSE.md. The original registers an offline-bundled icon
// set (`register-icons.ts` / `icon-sets.ts`, generated for the template's
// own pages) so icons never flicker; TipPaw only needs a handful of
// `solar:*` icons for the dashboard shell, so this loads them from the
// Iconify API directly instead of porting that bundle.
// ----------------------------------------------------------------------

export type IconifyProps = React.ComponentProps<typeof IconRoot> & Omit<IconProps, "icon"> & {
  icon: string;
};

export function Iconify({ className, icon, width = 20, height, sx, ...other }: IconifyProps) {
  const id = useId();

  return (
    <IconRoot
      ssr
      id={id}
      icon={icon}
      className={mergeClasses([iconifyClasses.root, className])}
      sx={[
        {
          width,
          flexShrink: 0,
          height: height ?? width,
          display: "inline-flex",
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    />
  );
}

// ----------------------------------------------------------------------

const IconRoot = styled(Icon)``;
