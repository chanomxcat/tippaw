"use client";

import type { Theme, SxProps, Breakpoint } from "@mui/material/styles";

import { usePathname } from "next/navigation";
import { varAlpha } from "minimal-shared/utils";

import Box from "@mui/material/Box";
import ListItem from "@mui/material/ListItem";
import { useTheme } from "@mui/material/styles";
import ListItemButton from "@mui/material/ListItemButton";
import Drawer, { drawerClasses } from "@mui/material/Drawer";

import { Logo } from "../../components/logo";
import { Iconify } from "../../components/iconify";
import { Scrollbar } from "../../components/scrollbar";
import { RouterLink } from "../../components/router-link";

import type { NavItem } from "../../../nav-config";

// ----------------------------------------------------------------------
// Ported from minimal-ui-kit/material-kit-react's dashboard nav (MIT) —
// see ../../LICENSE.md. React Router's `usePathname`/`Link` replaced
// with next/navigation / next/link; workspaces popover and nav-upgrade
// dropped (not used by TipPaw, see task-10-brief.md).
// ----------------------------------------------------------------------

export type NavContentProps = {
  data: NavItem[];
  slots?: {
    topArea?: React.ReactNode;
    bottomArea?: React.ReactNode;
  };
  sx?: SxProps<Theme>;
};

export function NavDesktop({
  sx,
  data,
  slots,
  layoutQuery,
}: NavContentProps & { layoutQuery: Breakpoint }) {
  const theme = useTheme();

  return (
    <Box
      sx={[
        {
          pt: 2.5,
          px: 2.5,
          top: 0,
          left: 0,
          height: 1,
          display: "none",
          position: "fixed",
          flexDirection: "column",
          zIndex: "var(--layout-nav-zIndex)",
          width: "var(--layout-nav-vertical-width)",
          borderRight: `1px solid ${varAlpha(theme.vars.palette.grey["500Channel"], 0.12)}`,
          [theme.breakpoints.up(layoutQuery)]: {
            display: "flex",
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <NavContent data={data} slots={slots} />
    </Box>
  );
}

// ----------------------------------------------------------------------

export function NavMobile({
  sx,
  data,
  open,
  slots,
  onClose,
}: NavContentProps & { open: boolean; onClose: () => void }) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      sx={{
        [`& .${drawerClasses.paper}`]: {
          pt: 2.5,
          px: 2.5,
          overflow: "unset",
          width: "var(--layout-nav-mobile-width)",
        },
      }}
    >
      <NavContent data={data} slots={slots} sx={sx} />
    </Drawer>
  );
}

// ----------------------------------------------------------------------

export function NavContent({ data, slots, sx }: NavContentProps) {
  const pathname = usePathname();

  return (
    <>
      <Logo />

      {slots?.topArea}

      <Scrollbar fillContent>
        <Box
          component="nav"
          sx={[
            {
              mt: 2.5,
              display: "flex",
              flex: "1 1 auto",
              flexDirection: "column",
            },
            ...(Array.isArray(sx) ? sx : [sx]),
          ]}
        >
          <Box
            component="ul"
            sx={{
              gap: 0.5,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {data.map((item) => {
              const isActived = item.path === pathname;

              return (
                <ListItem disableGutters disablePadding key={item.title}>
                  <ListItemButton
                    disableGutters
                    component={RouterLink}
                    href={item.path}
                    sx={[
                      (theme) => ({
                        pl: 2,
                        py: 1,
                        gap: 2,
                        pr: 1.5,
                        borderRadius: 0.75,
                        typography: "body2",
                        fontWeight: "fontWeightMedium",
                        color: theme.vars.palette.text.secondary,
                        minHeight: 44,
                        ...(isActived && {
                          fontWeight: "fontWeightSemiBold",
                          color: theme.vars.palette.primary.main,
                          bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
                          "&:hover": {
                            bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.16),
                          },
                        }),
                      }),
                    ]}
                  >
                    <Box component="span" sx={{ width: 24, height: 24 }}>
                      <Iconify icon={item.icon} width={24} />
                    </Box>

                    <Box component="span" sx={{ flexGrow: 1 }}>
                      {item.title}
                    </Box>
                  </ListItemButton>
                </ListItem>
              );
            })}
          </Box>
        </Box>
      </Scrollbar>

      {slots?.bottomArea}
    </>
  );
}
