import { notFound } from "next/navigation";

import Container from "@mui/material/Container";

import { getDeps } from "@/server/env";
import { getPublicTipPage } from "@/server/tip-page/tip-page";

import { ResultPoller } from "./ResultPoller";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ d?: string }>;

export default async function DonationResultPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const { d } = await searchParams;
  if (!d) notFound();

  const deps = await getDeps();
  const page = await getPublicTipPage(deps, slug);
  if (!page) notFound();

  return (
    <Container maxWidth="xs" sx={{ py: 8 }}>
      <ResultPoller
        donationId={d}
        slug={page.slug}
        successMessage={page.successMessage}
        failureMessage={page.failureMessage}
      />
    </Container>
  );
}
