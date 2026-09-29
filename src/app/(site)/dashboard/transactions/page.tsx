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
    <div className="flex max-w-7xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">ธุรกรรม</h1>

      {items.length === 0 ? (
        <p>ยังไม่มีรายการโดเนท</p>
      ) : (
        <div className="surface">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ชื่อ</th>
                  <th>จำนวนเงิน</th>
                  <th>ข้อความ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{dateFormatter.format(item.paidAt)}</td>
                    <td>{item.donorName}</td>
                    <td>฿{formatThb(item.amountSatang)}</td>
                    <td>{item.message}</td>
                    <td className="text-right">
                      <ReplayButton donationId={item.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 p-4">
              {page > 1 ? (
                <a href={`/dashboard/transactions?page=${page - 1}`} className="link link-hover">
                  ก่อนหน้า
                </a>
              ) : (
                <span className="text-base-content/40">ก่อนหน้า</span>
              )}
              <span className="text-sm">
                หน้า {page} / {totalPages}
              </span>
              {page < totalPages ? (
                <a href={`/dashboard/transactions?page=${page + 1}`} className="link link-hover">
                  ถัดไป
                </a>
              ) : (
                <span className="text-base-content/40">ถัดไป</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
