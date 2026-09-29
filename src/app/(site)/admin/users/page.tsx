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
    <div className="flex max-w-7xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">ผู้ใช้</h1>

      <div className="surface">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>ชื่อผู้ใช้</th>
                <th>Slug</th>
                <th>ผู้ให้บริการ</th>
                <th>Invite code</th>
                <th>สร้างเมื่อ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.username ?? "-"}</td>
                  <td>{u.slug ?? "-"}</td>
                  <td>{u.providers.length > 0 ? u.providers.join(", ") : "-"}</td>
                  <td>{u.inviteCode ?? "-"}</td>
                  <td>{dateFormatter.format(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
