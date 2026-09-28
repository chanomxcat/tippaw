import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { getDeps } from "@/server/env";
import { getPublicTipPage } from "@/server/tip-page/tip-page";

import { TipForm } from "./TipForm";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const deps = await getDeps();
  const page = await getPublicTipPage(deps, slug);
  return { title: page ? page.channelName : "TipPaw" };
}

export default async function TipPage({ params }: { params: Params }) {
  const { slug } = await params;
  const deps = await getDeps();
  const page = await getPublicTipPage(deps, slug);
  if (!page) notFound();

  return (
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <Stack spacing={3}>
        <Card sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h4" sx={{ mb: 2 }}>
            {page.channelName}
          </Typography>
          {page.links.length > 0 && (
            <Stack spacing={1}>
              {page.links.map((link) => (
                <Button
                  key={link.url}
                  component="a"
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                  fullWidth
                >
                  {link.label}
                </Button>
              ))}
            </Stack>
          )}
        </Card>

        {page.accepting ? (
          <TipForm
            slug={page.slug}
            minThb={Number(deps.env.MIN_DONATION_THB)}
            maxThb={Number(deps.env.MAX_DONATION_THB)}
          />
        ) : (
          <Card sx={{ p: 4 }}>
            <Alert severity="info">ยังไม่เปิดรับโดเนท</Alert>
          </Card>
        )}
      </Stack>
    </Container>
  );
}
