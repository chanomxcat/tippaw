import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import { requireAdmin } from "@/server/auth/page-guards";
import { getDeps } from "@/server/env";
import { listInviteUsers } from "@/server/invites/invites";

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

export default async function AdminInviteUsersPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  // See admin/users/page.tsx for why this page also self-guards.
  await requireAdmin();
  const { code } = await params;
  const deps = await getDeps();
  const users = await listInviteUsers(deps, code);

  return (
    <Stack spacing={3}>
      <Typography variant="h4">ผู้ใช้โค้ด {code}</Typography>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ชื่อผู้ใช้</TableCell>
                <TableCell>ชื่อ</TableCell>
                <TableCell>ใช้เมื่อ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.userId}>
                  <TableCell>{u.username ?? "-"}</TableCell>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{dateFormatter.format(u.redeemedAt)}</TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography variant="body2" color="text.secondary">
                      ยังไม่มีผู้ใช้โค้ดนี้
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Stack>
  );
}
