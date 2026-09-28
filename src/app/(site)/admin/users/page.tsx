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
import { getDeps } from "@/server/env";

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

export default async function AdminUsersPage() {
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
