"use client";

import type { IconButtonProps } from "@mui/material/IconButton";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import Popover from "@mui/material/Popover";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";

// ----------------------------------------------------------------------
// Simplified port of minimal-ui-kit/material-kit-react's AccountPopover
// (MIT) — see ../../LICENSE.md. The original lists arbitrary account
// menu links backed by mock data; TipPaw only needs the user's name and
// a sign-out action (see task-10-brief.md), so those parts were dropped
// rather than ported.
// ----------------------------------------------------------------------

export type AccountPopoverProps = IconButtonProps & {
  user: { name: string };
};

export function AccountPopover({ user, sx, ...other }: AccountPopoverProps) {
  const router = useRouter();

  const [openPopover, setOpenPopover] = useState<HTMLButtonElement | null>(null);

  const handleOpenPopover = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setOpenPopover(event.currentTarget);
  }, []);

  const handleClosePopover = useCallback(() => {
    setOpenPopover(null);
  }, []);

  const handleSignOut = useCallback(async () => {
    handleClosePopover();
    // better-auth's endpoint requires a JSON content type even for an empty
    // body, or it 415s and the session cookie never gets cleared.
    await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    router.push("/login");
    router.refresh();
  }, [handleClosePopover, router]);

  return (
    <>
      <IconButton
        onClick={handleOpenPopover}
        aria-label="บัญชีผู้ใช้"
        sx={{
          p: "2px",
          width: 40,
          height: 40,
          background: (theme) =>
            `conic-gradient(${theme.vars.palette.primary.light}, ${theme.vars.palette.secondary.main}, ${theme.vars.palette.primary.light})`,
          ...sx,
        }}
        {...other}
      >
        <Avatar sx={{ width: 1, height: 1 }}>{user.name.charAt(0).toUpperCase()}</Avatar>
      </IconButton>

      <Popover
        open={!!openPopover}
        anchorEl={openPopover}
        onClose={handleClosePopover}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: { width: 200 },
          },
        }}
      >
        <Box sx={{ p: 2, pb: 1.5 }}>
          <Typography variant="subtitle2" noWrap>
            {user.name}
          </Typography>
        </Box>

        <Divider sx={{ borderStyle: "dashed" }} />

        <Box sx={{ p: 1 }}>
          <Button fullWidth color="error" size="medium" variant="text" onClick={handleSignOut}>
            ออกจากระบบ
          </Button>
        </Box>
      </Popover>
    </>
  );
}
