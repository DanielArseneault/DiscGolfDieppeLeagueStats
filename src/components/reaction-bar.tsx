"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const EMOJIS = ["👍", "❤️", "🔥", "😂", "🤯", "😮", "👏", "💪", "😢", "😡"] as const;
export type Emoji = (typeof EMOJIS)[number];
export type ReactionCounts = Partial<Record<Emoji, number>>;

const EMOJI_LABELS: Record<Emoji, string> = {
  "👍": "Like",
  "❤️": "Love",
  "🔥": "Fire",
  "😂": "Haha",
  "🤯": "Wow",
  "😮": "Amazed",
  "👏": "Clap",
  "💪": "Strong",
  "😢": "Sad",
  "😡": "Angry",
};

function storageKey(roundId: number, target: string) {
  return `reactions-${roundId}-${target}`;
}

function loadMyReactions(roundId: number, target: string): Set<Emoji> {
  try {
    const raw = localStorage.getItem(storageKey(roundId, target));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as Emoji[]);
  } catch {
    return new Set();
  }
}

function saveMyReactions(roundId: number, target: string, mine: Set<Emoji>) {
  try {
    localStorage.setItem(storageKey(roundId, target), JSON.stringify([...mine]));
  } catch {
    // ignore
  }
}

export function ReactionBar({
  roundId,
  target,
  initialCounts,
}: {
  roundId: number;
  target: string;
  initialCounts: ReactionCounts;
}) {
  const [counts, setCounts] = useState<ReactionCounts>(initialCounts);
  const [mine, setMine] = useState<Set<Emoji>>(new Set());
  const [pending, setPending] = useState<Set<Emoji>>(new Set());
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMine(loadMyReactions(roundId, target));
  }, [roundId, target]);

  // Close picker on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toggle = useCallback(async (emoji: Emoji) => {
    if (pending.has(emoji)) return;

    const reacting = !mine.has(emoji);
    // The emoji we're switching away from (if any)
    const [prev_emoji] = [...mine].filter((e) => e !== emoji);

    // Optimistic update
    setCounts((prev) => {
      const next = { ...prev };
      if (reacting) {
        next[emoji] = (next[emoji] ?? 0) + 1;
        if (prev_emoji) next[prev_emoji] = Math.max(0, (next[prev_emoji] ?? 0) - 1);
      } else {
        next[emoji] = Math.max(0, (next[emoji] ?? 0) - 1);
      }
      return next;
    });
    const nextMine: Set<Emoji> = reacting ? new Set([emoji]) : new Set();
    setMine(nextMine);
    saveMyReactions(roundId, target, nextMine);
    setPending((p) => new Set(p).add(emoji));
    setOpen(false);

    try {
      // Remove previous reaction first (if switching), then add new one
      if (reacting && prev_emoji) {
        await fetch(`/api/rounds/${roundId}/reactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji: prev_emoji, action: "remove", target }),
        });
      }
      const res = await fetch(`/api/rounds/${roundId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, action: reacting ? "add" : "remove", target }),
      });
      if (res.ok) {
        const data = await res.json() as { emoji: Emoji; count: number };
        setCounts((prev) => ({ ...prev, [data.emoji]: data.count }));
      } else {
        rollback();
      }
    } catch {
      rollback();
    } finally {
      setPending((p) => { const n = new Set(p); n.delete(emoji); return n; });
    }

    function rollback() {
      setCounts(initialCounts);
      setMine(mine);
      saveMyReactions(roundId, target, mine);
    }
  }, [mine, pending, roundId, target, initialCounts]);

  // Emojis that have at least one reaction OR the user has reacted to
  const activeEmojis = EMOJIS.filter((e) => (counts[e] ?? 0) > 0 || mine.has(e));

  return (
    <div ref={containerRef} className="relative flex items-center flex-wrap gap-1.5">
      {/* Picker trigger */}
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Add reaction"
          className={[
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all select-none",
            open
              ? "bg-slate-100 border-slate-300 text-slate-700"
              : "bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 hover:bg-slate-50",
          ].join(" ")}
        >
          <span className="text-base leading-none">👍</span>
          <span>+</span>
        </button>

        {/* Emoji picker popup */}
        {open && (
          <div className="absolute bottom-full left-0 mb-1.5 z-50 flex gap-1 p-1.5 bg-white border border-slate-200 rounded-xl shadow-lg">
            {EMOJIS.map((emoji) => {
              const active = mine.has(emoji);
              return (
                <div key={emoji} className="relative group">
                  <button
                    onClick={() => toggle(emoji)}
                    disabled={pending.has(emoji)}
                    aria-label={EMOJI_LABELS[emoji]}
                    aria-pressed={active}
                    className={[
                      "w-9 h-9 flex items-center justify-center rounded-lg text-xl transition-all",
                      "disabled:opacity-50 disabled:cursor-wait",
                      active
                        ? "bg-indigo-100 ring-2 ring-indigo-300"
                        : "hover:bg-slate-100",
                    ].join(" ")}
                  >
                    {emoji}
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 bg-slate-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {EMOJI_LABELS[emoji]}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active reaction pills */}
      {activeEmojis.map((emoji) => {
        const count = counts[emoji] ?? 0;
        const active = mine.has(emoji);
        return (
          <button
            key={emoji}
            onClick={() => toggle(emoji)}
            disabled={pending.has(emoji)}
            aria-label={`${emoji} ${count}`}
            aria-pressed={active}
            className={[
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border transition-all select-none",
              "disabled:opacity-50 disabled:cursor-wait",
              active
                ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
            ].join(" ")}
          >
            <span className="text-base leading-none">{emoji}</span>
            {count > 0 && (
              <span className={`tabular-nums text-xs font-medium ${active ? "text-indigo-600" : "text-slate-400"}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
