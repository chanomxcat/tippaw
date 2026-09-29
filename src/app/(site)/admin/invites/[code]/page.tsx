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
    <div className="flex max-w-7xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">ผู้ใช้โค้ด {code}</h1>

      <div className="surface">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>ชื่อผู้ใช้</th>
                <th>ชื่อ</th>
                <th>ใช้เมื่อ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.userId}>
                  <td>{u.username ?? "-"}</td>
                  <td>{u.name}</td>
                  <td>{dateFormatter.format(u.redeemedAt)}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={3}>
                    <span className="text-base-content/60 text-sm">ยังไม่มีผู้ใช้โค้ดนี้</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
