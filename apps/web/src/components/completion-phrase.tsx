"use client";

import { useState } from "react";
import { addPhrase } from "@/app/actions";

/**
 * A completion, with its words selectable.
 *
 * Google hands back whole utterances — "kava bar near me open late" — and the
 * part worth owning is usually inside one, not the whole string. So every word
 * is a target: click one to start a selection, click another to extend it, and
 * the contiguous span becomes the phrase. Content words are shown solid and
 * stopwords muted, because the eye should land on the part that carries the
 * meaning.
 *
 * Selection is contiguous by design. A phrase is a run of adjacent words; "kava
 * ... late" is not a thing anybody searches for.
 */
export function CompletionPhrase({
  cloud,
  phrase,
  stopWords,
  tracked,
}: {
  cloud: string;
  phrase: string;
  stopWords: string[];
  /** Status of this exact phrase if the cloud already knows it. */
  tracked?: string;
}) {
  const words = phrase.split(/\s+/).filter(Boolean);
  const stop = new Set(stopWords);

  const [anchor, setAnchor] = useState<number | null>(null);
  const [head, setHead] = useState<number | null>(null);

  const from = anchor === null ? null : Math.min(anchor, head ?? anchor);
  const to = anchor === null ? null : Math.max(anchor, head ?? anchor);
  const selected =
    from === null || to === null ? "" : words.slice(from, to + 1).join(" ");

  function onWord(i: number) {
    if (anchor === null) {
      setAnchor(i);
      setHead(i);
    } else if (i === anchor && i === head) {
      setAnchor(null); // clicking the single selected word clears it
      setHead(null);
    } else {
      setHead(i);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 py-0.5">
      <span className="flex flex-wrap gap-x-1">
        {words.map((word, i) => {
          const inSpan = from !== null && to !== null && i >= from && i <= to;
          const isStop = stop.has(word.toLowerCase());
          return (
            <button
              key={`${word}-${i}`}
              type="button"
              onClick={() => onWord(i)}
              className={`rounded px-1 text-sm transition-colors ${
                inSpan
                  ? "bg-proxy/25 text-ink"
                  : isStop
                    ? "text-ink-faint hover:bg-line-soft"
                    : "text-ink hover:bg-line-soft"
              }`}
              title={
                isStop
                  ? "Common word"
                  : "Click to select, click another to extend"
              }
            >
              {word}
            </button>
          );
        })}
      </span>

      {selected && selected !== phrase ? (
        <span className="flex items-center gap-1">
          <AddButton
            cloud={cloud}
            phrase={selected}
            core={false}
            label={`+ “${selected}”`}
          />
        </span>
      ) : null}

      {tracked ? (
        <span
          className={`ml-auto text-xs ${
            tracked === "core"
              ? "text-measured"
              : tracked === "rejected"
                ? "text-ink-faint"
                : "text-proxy"
          }`}
        >
          {tracked === "core" ? "target" : tracked}
        </span>
      ) : (
        <span className="ml-auto flex gap-1">
          <AddButton
            cloud={cloud}
            phrase={phrase}
            core={false}
            label="candidate"
          />
          <AddButton cloud={cloud} phrase={phrase} core label="target" />
        </span>
      )}
    </div>
  );
}

function AddButton({
  cloud,
  phrase,
  core,
  label,
}: {
  cloud: string;
  phrase: string;
  core: boolean;
  label: string;
}) {
  return (
    <form action={addPhrase} className="inline">
      <input type="hidden" name="cloud" value={cloud} />
      <input type="hidden" name="phrase" value={phrase} />
      {core ? <input type="hidden" name="core" value="on" /> : null}
      <button
        type="submit"
        className={`rounded border px-1.5 py-0.5 text-xs whitespace-nowrap ${
          core
            ? "border-measured/40 text-measured hover:bg-measured/10"
            : "border-line text-ink-soft hover:border-ink-faint hover:text-ink"
        }`}
        title={
          core
            ? "Track this and measure its ranking"
            : "Add to candidates for a decision later"
        }
      >
        {label}
      </button>
    </form>
  );
}
