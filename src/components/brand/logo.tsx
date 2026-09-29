// แมวส้ม + ชานมไข่มุก: แก้วชานมทรงแมว มีหู หลอดสีชมพู และไข่มุกที่ก้นแก้ว
// ใช้สีคงที่ (ไม่ผูกกับธีม) เพื่อให้มาสคอตหน้าตาเหมือนเดิมทั้งโหมดสว่าง/มืด

const ORANGE = "#FF7A1A";
const ORANGE_DEEP = "#E85F00";
const BROWN = "#3B2416";
const PINK = "#FF8FB1";
const CREAM = "#FFE8C2";

export type TippawMarkProps = {
  size?: number;
  className?: string;
  title?: string;
};

export function TippawMark({ size = 40, className, title }: TippawMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {/* หลอด */}
      <path d="M38 24 L44 5" stroke={PINK} strokeWidth="5" strokeLinecap="round" />
      {/* หูแมว */}
      <path d="M13 26 L15 8 L28 22 Z" fill={ORANGE} stroke={BROWN} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M51 26 L49 8 L36 22 Z" fill={ORANGE} stroke={BROWN} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M16.5 21 L17 14 L22 19.5 Z" fill={PINK} />
      <path d="M47.5 21 L47 14 L42 19.5 Z" fill={PINK} />
      {/* ฝาแก้ว */}
      <rect x="9" y="22" width="46" height="7" rx="3.5" fill={CREAM} stroke={BROWN} strokeWidth="2.5" />
      {/* ตัวแก้ว */}
      <path
        d="M12 29 H52 L48 57 Q47.7 59 45.7 59 H18.3 Q16.3 59 16 57 Z"
        fill={ORANGE}
        stroke={BROWN}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* ลายแมวส้ม */}
      <path d="M32 29 V35 M26 29 L27 33 M38 29 L37 33" stroke={ORANGE_DEEP} strokeWidth="2.5" strokeLinecap="round" />
      {/* หน้า */}
      <circle cx="24" cy="41" r="2.4" fill={BROWN} />
      <circle cx="40" cy="41" r="2.4" fill={BROWN} />
      <path d="M30 44.5 H34 L32 47 Z" fill={PINK} stroke={BROWN} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M32 47 Q29.5 50 27 48.5 M32 47 Q34.5 50 37 48.5" stroke={BROWN} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* ไข่มุก */}
      <circle cx="22" cy="55" r="2.4" fill={BROWN} />
      <circle cx="29" cy="55.5" r="2.4" fill={BROWN} />
      <circle cx="36" cy="55.5" r="2.4" fill={BROWN} />
      <circle cx="43" cy="55" r="2.4" fill={BROWN} />
    </svg>
  );
}

export type TippawLogoProps = {
  size?: number;
  className?: string;
};

export function TippawLogo({ size = 36, className }: TippawLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <TippawMark size={size} />
      <span className="text-xl font-semibold tracking-tight">
        Tip<span className="text-primary">Paw</span>
      </span>
    </span>
  );
}
