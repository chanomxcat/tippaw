"use client";

import Link from "next/link";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

export default function Home() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        textAlign: "center",
        px: 2,
      }}
    >
      <Typography variant="h2" sx={{ color: "primary.dark" }}>
        TipPaw
      </Typography>

      <Typography variant="body1" sx={{ color: "text.secondary" }}>
        แพลตฟอร์มรับโดเนทสำหรับสตรีมเมอร์
      </Typography>

      <Button component={Link} href="/login" variant="contained" size="large">
        เข้าสู่ระบบ
      </Button>
    </Box>
  );
}
