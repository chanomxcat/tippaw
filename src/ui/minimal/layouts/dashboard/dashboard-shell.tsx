"use client";

import type { Breakpoint } from "@mui/material/styles";

import { useBoolean } from "minimal-shared/hooks";

import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";

import { NavMobile, NavDesktop } from "./nav";
import { layoutClasses } from "../core/classes";
import { dashboardLayoutVars } from "./css-vars";
import { MainSection } from "../core/main-section";
import { MenuButton } from "./menu-button";
import { HeaderSection } from "../core/header-section";
import { LayoutSection } from "../core/layout-section";
import { AccountPopover } from "./account-popover";

import type { NavItem } from "../../../nav-config";

// ----------------------------------------------------------------------
// Simplified port of minimal-ui-kit/material-kit-react's DashboardLayout
// (MIT) — see ../../LICENSE.md. Header searchbar/language/notifications
// were dropped (not used by TipPaw, see task-10-brief.md); the
// `nav`/`user` props let Server Component pages (later tasks) supply the
// nav items and signed-in user.
// ----------------------------------------------------------------------

export type DashboardShellProps = {
  nav: NavItem[];
  user: { name: string };
  children: React.ReactNode;
  layoutQuery?: Breakpoint;
};

export function DashboardShell({
  nav,
  user,
  children,
  layoutQuery = "lg",
}: DashboardShellProps) {
  const theme = useTheme();

  const { value: open, onFalse: onClose, onTrue: onOpen } = useBoolean();

  const renderHeader = () => (
    <HeaderSection
      disableElevation
      layoutQuery={layoutQuery}
      slots={{
        leftArea: (
          <>
            {/** @slot Nav mobile */}
            <MenuButton
              onClick={onOpen}
              sx={{ mr: 1, ml: -1, [theme.breakpoints.up(layoutQuery)]: { display: "none" } }}
            />
            <NavMobile data={nav} open={open} onClose={onClose} />
          </>
        ),
        rightArea: (
          <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0, sm: 0.75 } }}>
            {/** @slot Account popover */}
            <AccountPopover user={user} />
          </Box>
        ),
      }}
      slotProps={{ container: { maxWidth: false } }}
    />
  );

  return (
    <LayoutSection
      headerSection={renderHeader()}
      sidebarSection={<NavDesktop data={nav} layoutQuery={layoutQuery} />}
      cssVars={dashboardLayoutVars(theme)}
      sx={{
        [`& .${layoutClasses.sidebarContainer}`]: {
          [theme.breakpoints.up(layoutQuery)]: {
            pl: "var(--layout-nav-vertical-width)",
            transition: theme.transitions.create(["padding-left"], {
              easing: "var(--layout-transition-easing)",
              duration: "var(--layout-transition-duration)",
            }),
          },
        },
      }}
    >
      <MainSection>{children}</MainSection>
    </LayoutSection>
  );
}
