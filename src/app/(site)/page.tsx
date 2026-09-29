"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-accent text-5xl font-medium">TipPaw</h1>

      <p className="text-base-content/60">แพลตฟอร์มรับโดเนทสำหรับสตรีมเมอร์</p>

      <Link href="/login" className="btn btn-primary btn-lg">
        เข้าสู่ระบบ
      </Link>
    </div>
  );
}
