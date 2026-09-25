/**
 * Google Places API (New) client — ratings and reviews for any business,
 * without needing the owner's OAuth consent.
 *
 * Replaces the Google Business Profile (My Business v4) approach, whose
 * reviews endpoint only works for locations you own or manage.
 *
 * ## Two calls, very different costs
 *
 * 1. `resolvePlaceId()` — Text Search asking for ONLY `places.id`, which
 *    triggers the "Text Search Essentials (IDs Only)" SKU (635D-A9DD-C520):
 *    unlimited and free. Requesting any display field moves it to a paid SKU.
 *
 * 2. `fetchPlaceReviews()` — Place Details including `reviews`/`rating`/
 *    `userRatingCount`, which triggers "Place Details Enterprise + Atmosphere":
 *    $25.00 per 1,000 requests, only 1,000 free events per month.
 *
 * So: resolve and store the place ID for free, and pay only when review data
 * is actually needed.
 *
 * ## Storage rules (Places API policies)
 *
 * Only the place ID may be stored indefinitely. Ratings, review text, author
 * data and names must be fetched live and must NOT be warehoused, so this
 * module tags every response with `storable` / `cacheable` and a `fetchedAt`
 * rather than leaving the caller to guess. A historical rating trend cannot
 * legitimately be built from this source.
 *
 * ## Attribution
 *
 * Displaying a review requires crediting its author (avatar, name, profile
 * link — avatar at minimum) and giving users a way to open the review on
 * Google Maps. Those fields are passed through untouched under
 * `authorAttribution` and `googleMapsUri`; do not drop them downstream.
 *
 * @see https://developers.google.com/maps/documentation/places/web-service/policies
 */

import dotenv from "dotenv";

dotenv.config();

const PLACES_BASE = "https://places.googleapis.com/v1";

// Place Details Enterprise + Atmosphere, 0–100k tier.
const DETAILS_USD_PER_1K = 25.0;

/** Fields that keep Text Search on the free IDs-only SKU. */
const SEARCH_FIELDS_FREE = "places.id";

/** Review + rating fields. Any one of these triggers Enterprise + Atmosphere. */
const DETAILS_FIELDS = "id,rating,userRatingCount,googleMapsUri,reviews";

function apiKey() {
  return process.env.GOOGLE_MAPS_API_KEY || null;
}

export function placesApiAvailable() {
  return !!apiKey();
}

/**
 * Per-process tally so a run can report what it spent. Reset with
 * `resetUsage()` if a caller wants per-audit numbers.
 */
let usage = { idOnlySearches: 0, detailCalls: 0 };

export function getUsage() {
  return {
    ...usage,
    estimatedUsd: Number(
      ((usage.detailCalls / 1000) * DETAILS_USD_PER_1K).toFixed(4),
    ),
    note: "ID-only searches are billed at $0 (unlimited free SKU).",
  };
}

export function resetUsage() {
  usage = { idOnlySearches: 0, detailCalls: 0 };
}

async function placesRequest(url, { method = "GET", body, fieldMask }) {
  const key = apiKey();
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not set");
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": fieldMask,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* fall through to the error below */
  }
  if (!res.ok) {
    const detail = json?.error?.message || text.slice(0, 300) || res.statusText;
    throw new Error(`Places API ${res.status}: ${detail}`);
  }
  return json || {};
}

/**
 * Find a place ID from free-text details scraped off the site.
 *
 * Costs nothing as long as only `places.id` is requested. The trade-off is
 * that there is no display name to sanity-check the match against, so pass
 * the most specific query you have (name + street address, or name + phone).
 * Set `includeDisplayFields` to get a verifiable name/address back, at the
 * cost of moving to a paid Text Search SKU.
 */
export async function resolvePlaceId(
  query,
  { includeDisplayFields = false } = {},
) {
  const textQuery = String(query || "").trim();
  if (!textQuery) return { status: "no_query", placeId: null };

  const fieldMask = includeDisplayFields
    ? "places.id,places.displayName,places.formattedAddress"
    : SEARCH_FIELDS_FREE;

  const data = await placesRequest(`${PLACES_BASE}/places:searchText`, {
    method: "POST",
    body: { textQuery, maxResultCount: 1 },
    fieldMask,
  });
  usage.idOnlySearches += 1;

  const first = data.places?.[0];
  if (!first?.id) {
    return { status: "not_found", placeId: null, query: textQuery };
  }
  return {
    status: "ok",
    placeId: first.id,
    query: textQuery,
    // Present only when includeDisplayFields was requested (paid SKU).
    displayName: first.displayName?.text || null,
    formattedAddress: first.formattedAddress || null,
    billedSku: includeDisplayFields
      ? "Text Search Essentials (paid)"
      : "Text Search Essentials IDs Only (free)",
  };
}

/**
 * Fetch live rating and reviews for a place ID.
 *
 * Google returns at most 5 reviews, sorted by relevance, with no pagination —
 * there is no public API for a full review history.
 */
export async function fetchPlaceReviews(placeId) {
  if (!placeId) return { status: "no_place_id" };

  const data = await placesRequest(
    `${PLACES_BASE}/places/${encodeURIComponent(placeId)}`,
    { fieldMask: DETAILS_FIELDS },
  );
  usage.detailCalls += 1;

  const reviews = (data.reviews || []).map((r) => ({
    rating: r.rating ?? null,
    text: r.text?.text || null,
    originalText: r.originalText?.text || null,
    languageCode: r.text?.languageCode || null,
    publishTime: r.publishTime || null,
    relativePublishTimeDescription: r.relativePublishTimeDescription || null,
    visitDate: r.visitDate || null,
    // Required for attribution — do not strip these downstream.
    authorAttribution: {
      displayName: r.authorAttribution?.displayName || null,
      photoUri: r.authorAttribution?.photoUri || null,
      uri: r.authorAttribution?.uri || null,
    },
    googleMapsUri: r.googleMapsUri || null,
    flagContentUri: r.flagContentUri || null,
  }));

  return {
    status: "ok",
    placeId: data.id || placeId,
    rating: data.rating ?? null,
    userRatingCount: data.userRatingCount ?? null,
    googleMapsUri: data.googleMapsUri || null,
    reviews,
    reviewsReturned: reviews.length,
    reviewsTruncated: true,
    reviewLimitNote:
      "Places API returns at most 5 reviews sorted by relevance; full history is not available.",
    fetchedAt: new Date().toISOString(),
    // Explicit contract for anything that persists this payload.
    storable: ["placeId"],
    cacheable: false,
    storagePolicy:
      "Only placeId may be stored indefinitely. Rating, review text and author data must be fetched live and must not be warehoused.",
    attributionRequired: {
      author: "Show each review author's avatar, name and profile link.",
      link: "Link to the review on Google Maps via googleMapsUri.",
    },
    billedSku: "Place Details Enterprise + Atmosphere",
    estimatedUsd: Number((DETAILS_USD_PER_1K / 1000).toFixed(4)),
  };
}

/**
 * Resolve then fetch in one step. Pass a known `placeId` to skip the (free)
 * resolution step entirely.
 */
export async function getGoogleReviews({ placeId, query } = {}) {
  let resolved = null;
  if (!placeId) {
    resolved = await resolvePlaceId(query);
    if (resolved.status !== "ok") {
      return {
        status: resolved.status,
        query: resolved.query || query || null,
      };
    }
    placeId = resolved.placeId;
  }
  const details = await fetchPlaceReviews(placeId);
  return resolved ? { ...details, resolvedFrom: resolved } : details;
}
