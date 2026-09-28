"use client";

import type { IconButtonProps } from "@mui/material/IconButton";

import IconButton from "@mui/material/IconButton";

import { Iconify } from "../../components/iconify";

// ----------------------------------------------------------------------
// Ported from minimal-ui-kit/material-kit-react (MIT) — see ../../LICENSE.md
// ----------------------------------------------------------------------

export function MenuButton({ sx, ...other }: IconButtonProps) {
  return (
    <IconButton sx={sx} {...other}>
      <Iconify icon="solar:hamburger-menu-bold" width={24} />
    </IconButton>
  );
}
