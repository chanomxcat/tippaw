import Card from "@mui/material/Card";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import { requireOnboarded } from "@/server/auth/page-guards";
import { listPaidDonations, PAGE_SIZE } from "@/server/donations/queries";
import { getDeps } from "@/server/env";
import { formatThb } from "@/server/lib/money";

import { ReplayButton } from "./ReplayButton";

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

/** `?page=` is 1-indexed; anything non-integer or non-positive falls back to page 1. */
function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireOnboarded();
  const deps = await getDeps();
  const { page: rawPage } = await searchParams;
  const page = parsePage(rawPage);

  const { items, total } = await listPaidDonations(deps, user.id, page);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Stack spacing={3}>
      <Typography variant="h4">ธุรกรรม</Typography>

      {items.length === 0 ? (
        <Typography variant="body1">ยังไม่มีรายการโดเนท</Typography>
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>วันที่</TableCell>
                  <TableCell>ชื่อ</TableCell>
                  <TableCell>จำนวนเงิน</TableCell>
                  <TableCell>ข้อความ</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{dateFormatter.format(item.paidAt)}</TableCell>
                    <TableCell>{item.donorName}</TableCell>
                    <TableCell>฿{formatThb(item.amountSatang)}</TableCell>
                    <TableCell>{item.message}</TableCell>
                    <TableCell align="right">
                      <ReplayButton donationId={item.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {totalPages > 1 && (
            <Stack
              direction="row"
              spacing={2}
              sx={{ p: 2, alignItems: "center", justifyContent: "flex-end" }}
            >
              {page > 1 ? (
                <Link href={`/dashboard/transactions?page=${page - 1}`} underline="hover">
                  ก่อนหน้า
                </Link>
              ) : (
                <Typography variant="body2" color="text.disabled">
                  ก่อนหน้า
                </Typography>
              )}
              <Typography variant="body2">
                หน้า {page} / {totalPages}
              </Typography>
              {page < totalPages ? (
                <Link href={`/dashboard/transactions?page=${page + 1}`} underline="hover">
                  ถัดไป
                </Link>
              ) : (
                <Typography variant="body2" color="text.disabled">
                  ถัดไป
                </Typography>
              )}
            </Stack>
          )}
        </Card>
      )}
    </Stack>
  );
}
