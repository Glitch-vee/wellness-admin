"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/", label: "📊 Dashboard" },
  { href: "/settings", label: "⚙️ Site Settings" },
  { href: "/content", label: "✏️ Page Text" },
  { href: "/manage/offers", label: "💰 Offers" },
  { href: "/manage/testimonials", label: "⭐ Testimonials" },
  { href: "/manage/faqs", label: "❓ FAQs" },
  { href: "/manage/lead_magnets", label: "🎁 Lead Magnets" },
  { href: "/gallery", label: "🖼 Gallery" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="shell">
      <aside className="side">
        <div className="side__brand">
          <span className="side__dot">AA</span>
          <div>
            <strong>Alvee Admin</strong>
            <span>Wellness Engine CMS</span>
          </div>
        </div>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`nav-item ${pathname === n.href ? "on" : ""}`}
          >
            {n.label}
          </Link>
        ))}
        <div className="side__spacer" />
        <button className="nav-item" onClick={logout}>
          🚪 Log out
        </button>
        <div className="side__foot">
          Saves publish to the live site automatically.
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
