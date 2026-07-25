"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { pageMeta } from "@/lib/pages";
import InlinePreview from "@/components/InlinePreview";
import HBar from "@/components/atoms/HBar";
import "../grow.css";

/**
 * Experiments — A/B tests on content blocks. Draft → Running → Finished:
 * variant A is the live copy at creation time, B is the challenger; declaring
 * B the winner rewrites the block and republishes the site.
 */

type VariantStats = { exposed: number; converted: number; rate: number };
type Stats = { a: VariantStats; b: VariantStats; ready: boolean; lift: number | null };

type Test = {
  id: string;
  block_key: string;
  name: string;
  variant_a: string;
  variant_b: string;
  status: "draft" | "running" | "finished";
  winner: "" | "a" | "b";
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  stats: Stats;
};

type Block = { key: string; label: string; page: string; value: string };

type Publish = { ok?: boolean } | null | undefined;

const ZERO_STATS: Stats = {
  a: { exposed: 0, converted: 0, rate: 0 },
  b: { exposed: 0, converted: 0, rate: 0 },
  ready: false,
  lift: null,
};

const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";

function verdict(t: Test): { text: string; ready: boolean } | null {
  if (t.status === "draft") return null;
  const s = t.stats;
  if (!s.ready) {
    return { text: "Needs more data — 30+ visitors per variant", ready: false };
  }
  const { a, b } = s;
  if (a.rate === b.rate) {
    return { text: "Dead heat — both variants convert the same so far", ready: false };
  }
  const [leader, low, high] =
    b.rate > a.rate ? (["B", a.rate, b.rate] as const) : (["A", b.rate, a.rate] as const);
  if (low > 0) {
    return {
      text: `${leader} is ahead +${Math.round(((high - low) / low) * 100)}%`,
      ready: true,
    };
  }
  return { text: `${leader} is ahead — the other variant hasn't converted yet`, ready: true };
}

export default function ExperimentsPage() {
  const [tests, setTests] = useState<Test[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [cardMsg, setCardMsg] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");

  // inline "edit B" on a draft
  const [editId, setEditId] = useState("");
  const [editVal, setEditVal] = useState("");

  // winner confirm modal
  const [winnerFor, setWinnerFor] = useState<Test | null>(null);

  // new-experiment modal
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Block | null>(null);
  const [newName, setNewName] = useState("");
  const [newB, setNewB] = useState("");
  const [modalMsg, setModalMsg] = useState("");

  // toast
  const [flash, setFlash] = useState<{ text: string; warn?: boolean } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showFlash = (text: string, warn = false) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash({ text, warn });
    flashTimer.current = setTimeout(() => setFlash(null), warn ? 6500 : 3800);
  };
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    []
  );

  const load = async () => {
    try {
      const [t, b] = await Promise.all([
        api<{ tests: Test[] }>("/api/experiments"),
        api<{ rows: Block[] }>("/api/blocks"),
      ]);
      setTests(t.tests);
      setBlocks(b.rows);
      setMsg("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blockOf = useMemo(() => {
    const map = new Map<string, Block>();
    for (const b of blocks) map.set(b.key, b);
    return map;
  }, [blocks]);

  const setCardError = (id: string, text: string) =>
    setCardMsg((m) => ({ ...m, [id]: text }));

  const mergeTest = (next: Partial<Test> & { id: string }, keep: Test) =>
    setTests((ts) =>
      ts.map((t) => (t.id === keep.id ? { ...t, ...next, stats: keep.stats } : t))
    );

  const start = async (t: Test) => {
    setBusy(t.id);
    setCardError(t.id, "");
    try {
      const d = await api<{ test: Test }>(`/api/experiments/${t.id}`, {
        method: "PUT",
        body: JSON.stringify({ action: "start" }),
      });
      mergeTest(d.test, t);
    } catch (e) {
      setCardError(t.id, e instanceof Error ? e.message : "Start failed");
    } finally {
      setBusy("");
    }
  };

  const stop = async (t: Test) => {
    if (!window.confirm("Stop this experiment without a winner? Variant A stays live."))
      return;
    setBusy(t.id);
    setCardError(t.id, "");
    try {
      const d = await api<{ test: Test }>(`/api/experiments/${t.id}`, {
        method: "PUT",
        body: JSON.stringify({ action: "stop" }),
      });
      mergeTest(d.test, t);
    } catch (e) {
      setCardError(t.id, e instanceof Error ? e.message : "Stop failed");
    } finally {
      setBusy("");
    }
  };

  const declareWinner = async (t: Test, winner: "a" | "b") => {
    setBusy(t.id);
    try {
      const d = await api<{ test: Test; publish: Publish }>(
        `/api/experiments/${t.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ action: "winner", winner }),
        }
      );
      mergeTest(d.test, t);
      setWinnerFor(null);
      if (d.publish?.ok !== false) {
        showFlash("Saved · Live ✓");
      } else {
        showFlash("Saved — but the live site didn't update. Retry from Dashboard.", true);
      }
    } catch (e) {
      setWinnerFor(null);
      setCardError(t.id, e instanceof Error ? e.message : "Could not declare a winner");
    } finally {
      setBusy("");
    }
  };

  const saveB = async (t: Test) => {
    setBusy(t.id);
    setCardError(t.id, "");
    try {
      const d = await api<{ test: Test }>(`/api/experiments/${t.id}`, {
        method: "PUT",
        body: JSON.stringify({ variant_b: editVal }),
      });
      mergeTest(d.test, t);
      setEditId("");
    } catch (e) {
      setCardError(t.id, e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy("");
    }
  };

  const remove = async (t: Test) => {
    if (!window.confirm("Delete this experiment? This can't be undone.")) return;
    setBusy(t.id);
    setCardError(t.id, "");
    try {
      await api(`/api/experiments/${t.id}`, { method: "DELETE" });
      setTests((ts) => ts.filter((x) => x.id !== t.id));
    } catch (e) {
      setCardError(t.id, e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy("");
    }
  };

  const openCreate = () => {
    setStep(1);
    setQuery("");
    setPicked(null);
    setNewName("");
    setNewB("");
    setModalMsg("");
    setCreating(true);
  };

  const create = async () => {
    if (!picked || !newB.trim()) return;
    setBusy("create");
    setModalMsg("");
    try {
      const d = await api<{ test: Test }>("/api/experiments", {
        method: "POST",
        body: JSON.stringify({
          block_key: picked.key,
          name: newName.trim(),
          variant_b: newB,
        }),
      });
      setTests((ts) => [{ ...d.test, stats: ZERO_STATS }, ...ts]);
      setCreating(false);
    } catch (e) {
      setModalMsg(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy("");
    }
  };

  // blocks grouped by page for the picker, filtered by the search box
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hits = blocks.filter(
      (b) =>
        !q ||
        b.label.toLowerCase().includes(q) ||
        b.key.toLowerCase().includes(q) ||
        (b.value || "").toLowerCase().includes(q)
    );
    const byPage = new Map<string, Block[]>();
    for (const b of hits) {
      const list = byPage.get(b.page) ?? [];
      list.push(b);
      byPage.set(b.page, list);
    }
    return [...byPage.entries()]
      .sort((x, y) => pageMeta(x[0]).order - pageMeta(y[0]).order)
      .map(([page, list]) => ({ label: pageMeta(page).label, list }));
  }, [blocks, query]);

  const active = tests.filter((t) => t.status !== "finished");
  const finished = tests.filter((t) => t.status === "finished");

  const displayName = (t: Test) =>
    t.name || blockOf.get(t.block_key)?.label || t.block_key;

  const renderVariant = (t: Test, letter: "a" | "b") => {
    const s = t.stats[letter];
    const other = t.stats[letter === "a" ? "b" : "a"];
    const showStats = t.status !== "draft";
    const leader = showStats && s.rate > other.rate;
    const maxRate = Math.max(s.rate, other.rate);
    return (
      <div className="gw-var">
        <span className={`gw-var__badge ${leader ? "gw-var__badge--lead" : ""}`}>
          {letter.toUpperCase()}
        </span>
        <div className="gw-var__body">
          <InlinePreview
            className="gw-var__preview"
            text={letter === "a" ? t.variant_a : t.variant_b || "(empty)"}
          />
        </div>
        {showStats && (
          <div className="gw-var__stats">
            <HBar
              label={`${s.exposed} seen · ${s.converted} converted`}
              meta={pct(s.rate)}
              value={s.rate}
              max={maxRate}
              tone={leader ? "green" : "neutral"}
              title={`Variant ${letter.toUpperCase()} — ${s.converted} of ${s.exposed} visitors converted`}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="page-head">
        <h1>Experiments</h1>
        <button className="btn btn--green" onClick={openCreate}>
          + New experiment
        </button>
      </div>

      {msg && <div className="msg msg--err">⚠️ {msg}</div>}
      {!loaded && <div className="card">Loading…</div>}

      {loaded && tests.length === 0 && !msg && (
        <div className="card gw-empty">
          <div className="gw-empty__art" aria-hidden>
            🧪
          </div>
          <strong>No experiments yet</strong>
          <p>
            Pit two versions of any text block against each other — visitors
            split 50/50, and the better converter can become the live copy in
            one click.
          </p>
          <button className="btn btn--green" onClick={openCreate}>
            + Start your first experiment
          </button>
        </div>
      )}

      {active.map((t) => {
        const block = blockOf.get(t.block_key);
        const v = verdict(t);
        return (
          <div className="card" key={t.id}>
            <div className="gw-x-head">
              <strong>{displayName(t)}</strong>
              <span className="chip chip--off">{block?.label ?? t.block_key}</span>
              {block && <span className="chip">{pageMeta(block.page).label}</span>}
              {t.status === "draft" ? (
                <span className="chip chip--off">Draft</span>
              ) : (
                <span className="chip">Running since {fmtDate(t.started_at)}</span>
              )}
            </div>

            {cardMsg[t.id] && (
              <div className="msg msg--err gw-x-msg">⚠️ {cardMsg[t.id]}</div>
            )}

            <div className="gw-x-vars">
              {renderVariant(t, "a")}
              {renderVariant(t, "b")}
            </div>

            {v && (
              <div className={`gw-verdict ${v.ready ? "gw-verdict--ready" : ""}`}>
                {v.ready ? "🏁 " : "⏳ "}
                {v.text}
              </div>
            )}

            {editId === t.id ? (
              <div className="gw-editb">
                <div className="field">
                  <label>Variant B text</label>
                  <textarea
                    autoFocus
                    value={editVal}
                    onChange={(e) => setEditVal(e.target.value)}
                  />
                  <div className="gw-ab-preview">
                    <InlinePreview text={editVal || " "} />
                  </div>
                </div>
                <div className="gw-x-actions">
                  <button
                    className="btn btn--sm btn--green"
                    onClick={() => saveB(t)}
                    disabled={busy === t.id}
                  >
                    {busy === t.id ? "Saving…" : "Save B"}
                  </button>
                  <button
                    className="btn btn--sm"
                    onClick={() => setEditId("")}
                    disabled={busy === t.id}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="gw-x-actions">
                {t.status === "draft" && (
                  <>
                    <button
                      className="btn btn--sm btn--green"
                      onClick={() => start(t)}
                      disabled={busy === t.id || !t.variant_b.trim()}
                      title={
                        t.variant_b.trim()
                          ? "Visitors start splitting 50/50"
                          : "Add variant B text first"
                      }
                    >
                      ▶ Start
                    </button>
                    <button
                      className="btn btn--sm"
                      onClick={() => {
                        setEditId(t.id);
                        setEditVal(t.variant_b);
                      }}
                      disabled={busy === t.id}
                    >
                      Edit B
                    </button>
                    <button
                      className="btn btn--sm btn--danger"
                      onClick={() => remove(t)}
                      disabled={busy === t.id}
                    >
                      Delete
                    </button>
                  </>
                )}
                {t.status === "running" && (
                  <>
                    <button
                      className="btn btn--sm btn--dark"
                      onClick={() => setWinnerFor(t)}
                      disabled={busy === t.id}
                    >
                      🏆 Declare winner…
                    </button>
                    <button
                      className="btn btn--sm"
                      onClick={() => stop(t)}
                      disabled={busy === t.id}
                    >
                      Stop
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {finished.length > 0 && (
        <>
          <h2 className="gw-h gw-arch-h">Archive</h2>
          {finished.map((t) => {
            const block = blockOf.get(t.block_key);
            return (
              <div className="card card--flat gw-arch" key={t.id}>
                <div className="gw-x-head">
                  <strong>{displayName(t)}</strong>
                  {t.winner ? (
                    <span className="chip chip--hl">
                      Winner {t.winner.toUpperCase()}
                    </span>
                  ) : (
                    <span className="chip chip--off">Stopped</span>
                  )}
                  {block && (
                    <span className="chip chip--off">
                      {pageMeta(block.page).label}
                    </span>
                  )}
                  <span className="chip chip--off">
                    Finished {fmtDate(t.finished_at)}
                  </span>
                  <div className="row-actions gw-arch__del">
                    <button
                      className="btn btn--sm btn--danger"
                      onClick={() => remove(t)}
                      disabled={busy === t.id}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {cardMsg[t.id] && (
                  <div className="msg msg--err gw-x-msg">⚠️ {cardMsg[t.id]}</div>
                )}
                <div className="gw-arch__rates">
                  A {pct(t.stats.a.rate)} ({t.stats.a.converted}/{t.stats.a.exposed})
                  {" · "}B {pct(t.stats.b.rate)} ({t.stats.b.converted}/
                  {t.stats.b.exposed})
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ---- declare-winner confirm ---- */}
      {winnerFor && (
        <div className="overlay" onClick={() => !busy && setWinnerFor(null)}>
          <div
            className="modal"
            role="dialog"
            aria-label="Declare winner"
            onClick={(e) => e.stopPropagation()}
          >
            <strong className="modal__title">Declare the winner</strong>
            <p className="gw-modal-sub">
              The winner&rsquo;s text becomes the live site copy and republishes.
              This can&rsquo;t be reopened.
            </p>
            {(["a", "b"] as const).map((letter) => {
              const s = winnerFor.stats[letter];
              return (
                <button
                  key={letter}
                  className="gw-win-choice"
                  onClick={() => declareWinner(winnerFor, letter)}
                  disabled={busy === winnerFor.id}
                >
                  <span className="gw-var__badge">{letter.toUpperCase()}</span>
                  <span className="gw-win-choice__body">
                    <InlinePreview
                      className="gw-var__preview"
                      text={
                        letter === "a"
                          ? winnerFor.variant_a
                          : winnerFor.variant_b || "(empty)"
                      }
                    />
                    <span className="gw-win-choice__rate">
                      {pct(s.rate)} conversion · {s.converted} of {s.exposed}{" "}
                      visitors
                    </span>
                  </span>
                </button>
              );
            })}
            <div className="form-foot">
              <button
                className="btn"
                onClick={() => setWinnerFor(null)}
                disabled={busy === winnerFor.id}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- new experiment ---- */}
      {creating && (
        <div className="overlay" onClick={() => busy !== "create" && setCreating(false)}>
          <div
            className="modal gw-modal--wide"
            role="dialog"
            aria-label="New experiment"
            onClick={(e) => e.stopPropagation()}
          >
            <strong className="modal__title">New experiment</strong>
            {step === 1 ? (
              <>
                <p className="gw-modal-sub">
                  Pick the text block you want to test.
                </p>
                <input
                  autoFocus
                  placeholder="Search blocks…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="gw-pick-list">
                  {groups.map((g) => (
                    <div key={g.label}>
                      <div className="gw-pick-group">{g.label}</div>
                      {g.list.map((b) => (
                        <button
                          key={b.key}
                          className="gw-pick-item"
                          onClick={() => {
                            setPicked(b);
                            setNewB("");
                            setModalMsg("");
                            setStep(2);
                          }}
                        >
                          <strong>{b.label}</strong>
                          <span>{b.value || "(empty)"}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                  {groups.length === 0 && (
                    <div className="gw-pick-none">
                      {blocks.length === 0
                        ? "No text blocks found."
                        : "No blocks match your search."}
                    </div>
                  )}
                </div>
                <div className="form-foot">
                  <button className="btn" onClick={() => setCreating(false)}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              picked && (
                <>
                  <p className="gw-modal-sub">
                    <span className="chip chip--off">{picked.label}</span>{" "}
                    <span className="chip">{pageMeta(picked.page).label}</span>
                  </p>
                  <div className="field">
                    <label>Name (optional)</label>
                    <input
                      value={newName}
                      placeholder="e.g. Punchier hero headline"
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>A — current live text</label>
                    <div className="gw-ab-preview">
                      <InlinePreview text={picked.value || "(empty)"} />
                    </div>
                  </div>
                  <div className="field">
                    <label>B — challenger</label>
                    <textarea
                      autoFocus
                      value={newB}
                      placeholder="Write the version to test against the current text…"
                      onChange={(e) => setNewB(e.target.value)}
                    />
                    <div className="gw-ab-preview">
                      <InlinePreview text={newB || " "} />
                    </div>
                  </div>
                  {modalMsg && <div className="msg msg--err">⚠️ {modalMsg}</div>}
                  <div className="form-foot">
                    <button
                      className="btn btn--green"
                      onClick={create}
                      disabled={busy === "create" || !newB.trim()}
                    >
                      {busy === "create" ? "Creating…" : "Create experiment"}
                    </button>
                    <button
                      className="btn"
                      onClick={() => setStep(1)}
                      disabled={busy === "create"}
                    >
                      ← Back
                    </button>
                    <button
                      className="btn"
                      onClick={() => setCreating(false)}
                      disabled={busy === "create"}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}

      {flash && (
        <div className={`cms-flash ${flash.warn ? "gw-flash--warn" : ""}`}>
          {flash.text}
        </div>
      )}
    </>
  );
}
