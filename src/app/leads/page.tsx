"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { timeAgo } from "@/components/stats/Feed";
import "../grow.css";

/**
 * Leads inbox — everything the live site's forms captured. Filter New/All,
 * expand a note with a click, and move leads through New → Seen → Archived.
 */

type Lead = {
  id: string;
  created_at: string;
  name: string | null;
  email: string | null;
  note: string | null;
  source: string | null;
  path: string | null;
  status: "new" | "seen" | "archived";
};

type Counts = { new: number; seen: number; archived: number };

export default function LeadsPage() {
  const [filter, setFilter] = useState<"new" | "all">("new");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [counts, setCounts] = useState<Counts>({ new: 0, seen: 0, archived: 0 });
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    api<{ leads: Lead[]; counts: Counts }>(`/api/leads?status=${filter}`)
      .then((d) => {
        if (!alive) return;
        setLeads(d.leads);
        setCounts(d.counts);
        setMsg("");
      })
      .catch((e) => {
        if (alive) setMsg(e instanceof Error ? e.message : "Load failed");
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [filter]);

  const total = counts.new + counts.seen + counts.archived;

  const toggleNote = (id: string) =>
    setOpenNotes((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setStatus = async (lead: Lead, status: Lead["status"]) => {
    if (status === lead.status) return;
    const prev = lead.status;
    // optimistic: flip the row and the counts, revert on failure
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, status } : l)));
    setCounts((c) => ({ ...c, [prev]: c[prev] - 1, [status]: c[status] + 1 }));
    try {
      await api(`/api/leads/${lead.id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
    } catch (e) {
      setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, status: prev } : l)));
      setCounts((c) => ({ ...c, [prev]: c[prev] + 1, [status]: c[status] - 1 }));
      setMsg(e instanceof Error ? e.message : "Save failed");
    }
  };

  const markAllSeen = async () => {
    const targets = leads.filter((l) => l.status === "new");
    if (targets.length === 0) return;
    setBusy(true);
    setMsg("");
    try {
      await Promise.all(
        targets.map((l) =>
          api(`/api/leads/${l.id}`, {
            method: "PUT",
            body: JSON.stringify({ status: "seen" }),
          })
        )
      );
      setLeads((ls) =>
        ls.map((l) => (l.status === "new" ? { ...l, status: "seen" } : l))
      );
      setCounts((c) => ({ ...c, new: 0, seen: c.seen + targets.length }));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Some leads didn't update");
      // resync with the server rather than guessing what stuck
      try {
        const d = await api<{ leads: Lead[]; counts: Counts }>(
          `/api/leads?status=${filter}`
        );
        setLeads(d.leads);
        setCounts(d.counts);
      } catch {
        /* keep the local view */
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Leads</h1>
      </div>

      {msg && <div className="msg msg--err">⚠️ {msg}</div>}

      <div className="gw-leadbar">
        <div className="tabs">
          <button
            className={`tab ${filter === "new" ? "on" : ""}`}
            onClick={() => setFilter("new")}
          >
            New <span className="tab__count">{counts.new}</span>
          </button>
          <button
            className={`tab ${filter === "all" ? "on" : ""}`}
            onClick={() => setFilter("all")}
          >
            All <span className="tab__count">{total}</span>
          </button>
        </div>
        {filter === "new" && counts.new > 0 && (
          <button
            className="btn btn--sm gw-ml-auto"
            onClick={markAllSeen}
            disabled={busy}
          >
            {busy ? "Marking…" : "✓ Mark all seen"}
          </button>
        )}
      </div>

      {!loaded && <div className="card">Loading…</div>}

      {loaded && leads.length === 0 && (
        <div className="card gw-empty">
          <div className="gw-empty__art" aria-hidden>
            📥
          </div>
          {total === 0 ? (
            <>
              <strong>No leads yet</strong>
              <p>Leads land here from your site&rsquo;s forms — nothing yet.</p>
            </>
          ) : (
            <>
              <strong>All caught up</strong>
              <p>No new leads right now — switch to All to browse everything.</p>
            </>
          )}
        </div>
      )}

      {loaded && leads.length > 0 && (
        <div className="card">
          {leads.map((l) => (
            <div
              className={`gw-lead ${l.status === "archived" ? "gw-lead--archived" : ""}`}
              key={l.id}
            >
              <div className="gw-lead__who">
                <strong>{l.name || "—"}</strong>
                {l.email && <a href={`mailto:${l.email}`}>{l.email}</a>}
                {l.source && <span className="chip chip--off">{l.source}</span>}
              </div>
              <div
                className={`gw-lead__note ${openNotes.has(l.id) ? "gw-lead__note--open" : ""}`}
                onClick={() => toggleNote(l.id)}
                title={openNotes.has(l.id) ? "Click to collapse" : "Click to expand"}
              >
                {l.note || <em>No message</em>}
              </div>
              <div className="gw-lead__side">
                <span className="gw-lead__time" title={new Date(l.created_at).toLocaleString()}>
                  {timeAgo(l.created_at)}
                </span>
                <select
                  value={l.status}
                  aria-label="Lead status"
                  onChange={(e) => setStatus(l, e.target.value as Lead["status"])}
                >
                  <option value="new">New</option>
                  <option value="seen">Seen</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
