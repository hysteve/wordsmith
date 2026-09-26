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
  proposeFromCompletions,
  proposeFromPage,
  proposeFromCompetitors,
  proposeFromRelated,
} from "@wordsmith/core/services/cloud.js";
import { extractQueryCompletions } from "@wordsmith/core/scrapers/googled.js";
import { observations } from "@wordsmith/core/store/index.ts";

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

      result = await proposeFromCompletions(cloud, seed, {
        cascade: Boolean(payload.cascade),
        limit: payload.limit ?? 10,
      });

      // Keep the raw completions too. Their order is a popularity proxy and
      // is worth having over time, separately from the curation decision.
      const groups = await extractQueryCompletions(seed, {
        cascade: Boolean(payload.cascade),
        delay: 1500,
        limit: payload.limit ?? 10,
      }).catch(() => []);
      if (groups.length) {
        await observations.recordCompletions(ctx.runId, seed, groups);
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
