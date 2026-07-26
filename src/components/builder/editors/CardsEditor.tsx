"use client";

import { useState } from "react";
import { parseCards, cardsToBody, type CardRow } from "@/lib/blocks";

/* ---------- cards: title + text mini-forms ---------- */

export function CardsEditor({
  body,
  onBody,
}: {
  body: string;
  onBody: (b: string) => void;
}) {
  const [cards, setCards] = useState<CardRow[]>(() => {
    const c = parseCards(body);
    return c.length > 0 ? c : [{ title: "", text: "" }];
  });

  const commit = (next: CardRow[]) => {
    setCards(next);
    onBody(cardsToBody(next));
  };

  const patch = (i: number, p: Partial<CardRow>) =>
    commit(cards.map((c, j) => (j === i ? { ...c, ...p } : c)));

  return (
    <div className="field">
      <label>Cards</label>
      <div className="bkedit__cards">
        {cards.map((c, i) => (
          <div className="bkedit__card" key={i}>
            <div className="bkedit__cardhead">
              <input
                value={c.title}
                placeholder="✨ Card title (emoji welcome)"
                onChange={(e) => patch(i, { title: e.target.value })}
              />
              <button
                type="button"
                className="ibtn ibtn--del"
                title="Remove card"
                onClick={() => commit(cards.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
            <textarea
              value={c.text}
              placeholder="A short description"
              rows={2}
              onChange={(e) => patch(i, { text: e.target.value })}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        className="bkedit__add"
        onClick={() => commit([...cards, { title: "", text: "" }])}
      >
        + Add card
      </button>
    </div>
  );
}
