import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createSessionToken, SESSION_COOKIE, SESSION_DAYS } from "@/lib/auth";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// ---- brute-force throttle: 5 failed tries → locked for 10 minutes ----
// In-memory per server instance: enough to blunt dumb password guessing on a
// single-admin CMS without any storage dependency.
const MAX_FAILURES = 5;
const LOCK_MS = 10 * 60 * 1000;
const failures = new Map<
  string,
  { count: number; lockedUntil: number; last: number }
>();

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function isLocked(ip: string): boolean {
  const rec = failures.get(ip);
  if (!rec) return false;
  if (rec.lockedUntil > Date.now()) return true;
  if (rec.lockedUntil > 0) failures.delete(ip); // lock expired — fresh start
  return false;
}

function recordFailure(ip: string) {
  const now = Date.now();
  // Opportunistic cleanup so the map can't grow without bound — evict
  // expired locks AND entries idle past a lock's length (spoofed-IP spray
  // otherwise accumulates count 1-4 records forever).
  if (failures.size > 1000) {
    for (const [k, v] of failures) {
      const expired = v.lockedUntil > 0 && v.lockedUntil <= now;
      const idle = v.lockedUntil === 0 && now - v.last > LOCK_MS;
      if (expired || idle) failures.delete(k);
    }
  }
  const rec = failures.get(ip) ?? { count: 0, lockedUntil: 0, last: now };
  rec.count += 1;
  rec.last = now;
  if (rec.count >= MAX_FAILURES) rec.lockedUntil = now + LOCK_MS;
  failures.set(ip, rec);
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (isLocked(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }
  const adminPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!adminPassword || !sessionSecret) {
    return NextResponse.json(
      { error: "Server not configured (ADMIN_PASSWORD / SESSION_SECRET)" },
      { status: 500 }
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!body.password || !safeEqual(body.password, adminPassword)) {
    recordFailure(ip);
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  failures.delete(ip); // success clears the counter

  const token = await createSessionToken(sessionSecret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}
