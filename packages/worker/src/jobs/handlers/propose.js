/**
 * Fill a cloud with candidate phrases.
 *
 * All four proposers write candidates into the cloud document, which is what
 * makes them show up in the panel for a human to promote or reject. Nothing
 * here enters the core set on its own — that is the whole point of the
 * candidate step.
 *
 * The first version of this handler recorded Google's completions to the
 * database and never touched the cloud, so the panel's propose button looked
 * like it did nothing at all.
 */
import {
  loadCloud,
  saveCloud,
  proposeFromPage,
  proposeFromCompetitors,
  proposeFromRelated,
  proposeFromSite,
  addCompletionsToCloud,
} from "@wordsmith/core/services/cloud.js";
import { extractQueryCompletions } from "@wordsmith/core/scrapers/googled.js";
import { observations, sites } from "@wordsmith/core/store/index.ts";

/**
 * @param {{cloud: string, from: "completions"|"page"|"competitors"|"related",
 *   seed?: string, url?: string, phrase?: string}} payload
 */
export async function proposeJob(payload, ctx) {
  const { cloud: name, from = "completions" } = payload;
  if (!name) throw new Error("propose job needs a cloud name");

  const cloud = await loadCloud(name);
  let result;

  switch (from) {
    case "completions": {
      const seed = payload.seed || cloud.target;
      if (!seed)
        throw new Error("propose from completions needs a seed phrase");
      ctx.progress(`Asking Google to complete "${seed}"`);

      // One scrape. This used to call the proposer and then fetch the same
      // completions again to record them, which meant two Google requests per
      // seed and twice the chance of being throttled.
      const groups = await extractQueryCompletions(seed, {
        cascade: Boolean(payload.cascade),
        delay: 1500,
        limit: payload.limit ?? 10,
      });

      // Always keep the observation: the completions Google offers drift, and
      // the history is the point of the explorer.
      const recorded = await observations.recordCompletions(
        ctx.runId,
        seed,
        groups,
        name,
      );

      // Adding every completion as a candidate is right when you asked for
      // candidates and wrong when you are exploring — fifty suggestions would
      // bury the queue they are supposed to feed.
      result =
        payload.addCandidates === false
          ? { proposed: 0, gathered: recorded, groups: groups.length }
          : { ...addCompletionsToCloud(cloud, groups), gathered: recorded };
      break;
    }

    case "site": {
      const url = payload.url || cloud.target;
      if (!url) throw new Error("propose from site needs a URL");

      const site = await sites.siteFor(url);

      result = await proposeFromSite(cloud, url, {
        maxPages: payload.maxPages ?? 40,
        minPages: payload.minPages ?? 2,
        limit: payload.limit ?? 60,
        onProgress: (done, total, pageUrl) =>
          ctx.progress(`Reading ${done}/${total}: ${pageUrl}`),
        // Keep every page's counts, not only the phrases that cleared the
        // bar. This is the record of what the site actually says right now,
        // which is a different question from what we have chosen to target.
        onPageTerms: (pageUrl, parsed) =>
          observations.recordPageTerms({
            runId: ctx.runId,
            siteId: site.id,
            url: pageUrl,
            words: parsed.words,
            pairs: parsed.pairs,
            triplets: parsed.triplets,
          }),
      });

      // Keep the page list: it is the site's own account of what it has, and
      // it is worth being able to see when that changed.
      if (result.pagesFound) {
        await observations.recordPages(
          ctx.runId,
          site.id,
          (result.pageUrls ?? []).map((u) => ({ url: u })),
        );
      }
      break;
    }

    case "page": {
      const url = payload.url || cloud.target;
      if (!url) throw new Error("propose from page needs a URL");
      ctx.progress(`Reading n-grams from ${url}`);
      result = await proposeFromPage(cloud, url, {
        minCount: payload.minCount ?? 3,
        limit: payload.limit ?? 25,
      });
      break;
    }

    case "competitors": {
      const phrase = payload.phrase;
      if (!phrase) throw new Error("propose from competitors needs a phrase");
      ctx.progress(`Reading the pages ranking for "${phrase}"`);
      result = await proposeFromCompetitors(cloud, phrase, {
        topN: payload.topN ?? 5,
      });
      break;
    }

    case "related": {
      const seed = payload.seed;
      if (!seed) throw new Error("propose from related needs a seed word");
      ctx.progress(`Looking up words related to "${seed}"`);
      result = await proposeFromRelated(cloud, seed, { rel: payload.rel });
      break;
    }

    default:
      throw new Error(`Unknown proposer "${from}"`);
  }

  await saveCloud(cloud);
  return { cloud: name, from, ...result };
}
