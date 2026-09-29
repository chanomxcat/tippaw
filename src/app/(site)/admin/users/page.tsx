import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import { listUsers } from "@/server/admin/users";
import { requireAdmin } from "@/server/auth/page-guards";
import { getDeps } from "@/server/env";

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

export default async function AdminUsersPage() {
  // Layout-only guards aren't re-run on a partial RSC render (e.g. a
  // client-side navigation that only re-renders this segment), so each admin
  // page must also guard itself — not just rely on admin/layout.tsx.
  await requireAdmin();
  const deps = await getDeps();
  const users = await listUsers(deps);

  return (
    <Stack spacing={3}>
      <Typography variant="h4">ผู้ใช้</Typography>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ชื่อ</TableCell>
                <TableCell>ชื่อผู้ใช้</TableCell>
                <TableCell>Slug</TableCell>
                <TableCell>ผู้ให้บริการ</TableCell>
                <TableCell>Invite code</TableCell>
                <TableCell>สร้างเมื่อ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.username ?? "-"}</TableCell>
                  <TableCell>{u.slug ?? "-"}</TableCell>
                  <TableCell>{u.providers.length > 0 ? u.providers.join(", ") : "-"}</TableCell>
                  <TableCell>{u.inviteCode ?? "-"}</TableCell>
                  <TableCell>{dateFormatter.format(u.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Stack>
  );
}
