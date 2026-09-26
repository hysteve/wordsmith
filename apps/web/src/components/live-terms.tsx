/**
 * What the site actually says right now.
 *
 * This is the *live* half of the keyword picture and it answers a different
 * question from the target list. A phrase can be all over the site without
 * being targeted, or be targeted and appear nowhere — the gap between the two
 * is the work, so the two are shown side by side rather than merged.
 */
import { Td, Th } from "@/components/ui";
import { AddFromLiveButton } from "@/components/term-actions";

export type LiveTerm = {
  term: string;
  n: number;
  total: number;
  pages: number;
};

export function LiveTerms({
  cloud,
  terms,
  tracked,
}: {
  cloud: string;
  terms: LiveTerm[];
  /** Phrases already in the cloud, in any state. */
  tracked: Map<string, string>;
}) {
  if (terms.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-ink-faint">
        The site has not been scanned yet. Run &ldquo;Read site&rdquo; above and
        this fills with what your pages actually say.
      </p>
    );
  }

  return (
    <div className="max-h-[28rem] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface-sunk">
          <tr>
            <Th>Phrase</Th>
            <Th className="w-20 text-right">Times</Th>
            <Th className="w-20 text-right">Pages</Th>
            <Th className="w-28 text-right">Targeted</Th>
          </tr>
        </thead>
        <tbody>
          {terms.map((t) => {
            const status = tracked.get(t.term);
            return (
              <tr key={`${t.term}-${t.n}`}>
                <Td>{t.term}</Td>
                <Td className="nums text-right">{t.total}</Td>
                <Td className="nums text-right text-ink-soft">{t.pages}</Td>
                <Td className="text-right">
                  {status === "core" ? (
                    <span className="text-xs text-measured">target</span>
                  ) : status === "candidate" ? (
                    <span className="text-xs text-proxy">candidate</span>
                  ) : status === "rejected" ? (
                    <span className="text-xs text-ink-faint">rejected</span>
                  ) : (
                    // Said on the site but never considered. This is the
                    // interesting column: it is free signal you already own.
                    <AddFromLiveButton cloud={cloud} phrase={t.term} />
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
