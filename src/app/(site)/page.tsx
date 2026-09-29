import Link from "next/link";
import { Bell, Link2, Wallet } from "lucide-react";

import { TippawLogo, TippawMark } from "@/components/brand/logo";

const STEPS = [
  {
    icon: Link2,
    title: "สร้างหน้ารับทิป",
    body: "ตั้งชื่อช่องและลิงก์ของคุณเอง แชร์ให้แฟนๆ ได้ทันที",
    tone: "bg-primary text-primary-content",
  },
  {
    icon: Wallet,
    title: "แฟนๆ โดเนทง่ายๆ",
    body: "กรอกชื่อ ข้อความ และจำนวนเงิน จ่ายจบในไม่กี่วินาที",
    tone: "bg-secondary text-secondary-content",
  },
  {
    icon: Bell,
    title: "แจ้งเตือนขึ้นจอสด",
    body: "Overlay ใน OBS เด้งทันทีที่มีคนส่งกำลังใจมา",
    tone: "bg-accent text-accent-content",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4">
        <TippawLogo />
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost">
            เข้าสู่ระบบ
          </Link>
          <Link href="/register" className="btn btn-primary">
            สมัครสมาชิก
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="bg-pearls">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-5 py-16 text-center sm:py-24">
            <TippawMark size={112} className="animate-bob" title="TipPaw แมวส้มกับชานมไข่มุก" />
            <h1 className="text-4xl leading-tight font-semibold sm:text-6xl">
              รับกำลังใจจากแฟนๆ
              <br />
              <span className="text-primary">หวานละมุนเหมือนชานมไข่มุก</span>
            </h1>
            <p className="text-base-content/70 max-w-xl text-lg">
              แพลตฟอร์มรับโดเนทสำหรับสตรีมเมอร์และ VTuber สร้างหน้ารับทิปสวยๆ
              พร้อมแจ้งเตือนสดบนสตรีมในไม่กี่นาที
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/register" className="btn btn-primary btn-lg">
                เริ่มรับโดเนท
              </Link>
              <Link href="/login" className="btn btn-outline btn-lg">
                มีบัญชีแล้ว
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 pb-20">
          <ol className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="surface flex flex-col gap-3 p-6">
                <span className={`flex size-11 items-center justify-center rounded-2xl ${step.tone}`}>
                  <step.icon size={22} aria-hidden />
                </span>
                <h2 className="text-lg font-semibold">
                  <span className="text-base-content/40 mr-2">{i + 1}</span>
                  {step.title}
                </h2>
                <p className="text-base-content/70">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="text-base-content/60 py-6 text-center text-sm">
        © TipPaw · ทำด้วยความรัก แมวส้ม และชานมไข่มุก
      </footer>
    </div>
  );
}
