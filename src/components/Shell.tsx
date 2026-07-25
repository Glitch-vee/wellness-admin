"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import CommandPalette from "@/components/CommandPalette";

type NavItem = { href: string; label: string; badge?: "leads" };

const NAV: { group: string | null; items: NavItem[] }[] = [
  {
    group: null,
    items: [{ href: "/", label: "📊 Dashboard" }],
  },
  {
    group: "Build",
    items: [
      { href: "/pages", label: "📄 Pages" },
      { href: "/sitemap", label: "🗺️ Site Map" },
      { href: "/style", label: "🎨 Design" },
    ],
  },
  {
    group: "Grow",
    items: [
      { href: "/analytics", label: "📈 Analytics" },
      { href: "/experiments", label: "🧪 Experiments" },
      { href: "/leads", label: "📥 Leads", badge: "leads" },
    ],
  },
  {
    group: "Library",
    items: [
      { href: "/manage/testimonials", label: "⭐ Testimonials" },
      { href: "/manage/faqs", label: "❓ FAQs" },
      { href: "/manage/lead_magnets", label: "🎁 Lead Magnets" },
      { href: "/gallery", label: "🖼 Media" },
    ],
  },
  {
    group: "Setup",
    items: [{ href: "/settings", label: "⚙️ Settings" }],
  },
];

/**
 * Pages is the hub for the whole page-editing flow (hub, builder, page text,
 * legacy manage tables — offers pricing included); Site Map owns /sitemap.
 */
function isOn(href: string, pathname: string): boolean {
  if (href === "/pages") {
    return (
      pathname === "/pages" ||
      pathname === "/content" ||
      pathname.startsWith("/builder") ||
      pathname.startsWith("/manage/pages") ||
      pathname.startsWith("/manage/page_sections") ||
      pathname.startsWith("/manage/offer_sections") ||
      pathname.startsWith("/manage/offers")
    );
  }
  if (href === "/sitemap") {
    return pathname === "/sitemap";
  }
  return pathname === href;
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [newLeads, setNewLeads] = useState(0);
  const onLogin = pathname === "/login";
  const [sideOpen, setSideOpen] = useState(() => !pathname.startsWith("/builder"));
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 820px)");
    const apply = () => {
      setIsMobile(mq.matches);
      if (mq.matches) setSideOpen(false);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobile && sideOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, sideOpen]);

  // Leads badge: cheap count poll on mount + every minute; quiet on failure.
  useEffect(() => {
    if (onLogin) return;
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/leads?count=1", { cache: "no-store" });
        if (!res.ok) return;
        const d = (await res.json()) as { counts?: { new?: number } };
        if (alive) setNewLeads(Number(d.counts?.new ?? 0));
      } catch {
        /* endpoint missing or offline — badge just stays hidden */
      }
    };
    poll();
    const timer = setInterval(poll, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [onLogin]);

  if (onLogin) {
    return <>{children}</>;
  }

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  // The builder needs the full viewport; everything else stays compact.
  const wide = pathname.startsWith("/builder");

  return (
    <div className="shell">
      {isMobile && sideOpen && (
        <div className="side-backdrop" onClick={() => setSideOpen(false)} />
      )}
      <aside className={`side ${sideOpen ? "" : "side--closed"}`}>
        <div className="side__brand">
          <span className="side__dot">AA</span>
          <div>
            <strong>Alvee Admin</strong>
            <span>Wellness Engine CMS</span>
          </div>
        </div>
        {NAV.map((g, gi) => (
          <div className="side__section" key={g.group ?? `g${gi}`}>
            {g.group && <div className="side__group">{g.group}</div>}
            {g.items.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`nav-item ${isOn(n.href, pathname) ? "on" : ""}`}
                onClick={() => isMobile && setSideOpen(false)}
              >
                {n.label}
                {n.badge === "leads" && newLeads > 0 && (
                  <span className="ob-navbadge" title={`${newLeads} new`}>
                    {newLeads > 99 ? "99+" : newLeads}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}
        <div className="side__spacer" />
        <button className="nav-item" onClick={logout}>
          🚪 Log out
        </button>
      </aside>
      <button
        className={`side-toggle ${sideOpen ? "side-toggle--open" : ""}`}
        onClick={() => setSideOpen((o) => !o)}
        aria-label={sideOpen ? "Collapse sidebar" : "Expand sidebar"}
        title={sideOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        {sideOpen ? "◀" : "▶"}
      </button>
      <main className={`main ${wide ? "main--wide" : ""}`}>{children}</main>
      <CommandPalette />
    </div>
  );
}
