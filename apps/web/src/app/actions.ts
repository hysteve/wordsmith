"use server";

/**
 * Mutations.
 *
 * Two kinds, and the difference matters. Curation — promoting a term, rejecting
 * one — is instant and writes the cloud document. Measurement is minutes of
 * throttled browser work, so it is never awaited here: it goes on the queue and
 * the worker picks it up.
 *
 * A Server Action is a POST endpoint reachable by anyone who can reach the app,
 * so inputs are validated here rather than trusted because a form produced them.
 */
import { refresh } from "next/cache";
import { jobs } from "@wordsmith/core/store/index.ts";
import {
  loadCloud,
  saveCloud,
  promoteTerm,
  rejectTerm,
  setRole,
  addTerm,
  getTerms,
  STATUS,
} from "@wordsmith/core/services/cloud.js";

function requireString(value: unknown, field: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${field} is required`);
  return text;
}

/** Load, mutate, save — every curation action has this shape. */
async function withCloud<T>(name: string, fn: (cloud: any) => T): Promise<T> {
  const cloud = await loadCloud(name);
  const result = fn(cloud);
  await saveCloud(cloud);
  refresh();
  return result;
}

export async function promote(formData: FormData) {
  const name = requireString(formData.get("cloud"), "cloud");
  const phrase = requireString(formData.get("phrase"), "phrase");
  await withCloud(name, (cloud) => promoteTerm(cloud, phrase));
}

export async function reject(formData: FormData) {
  const name = requireString(formData.get("cloud"), "cloud");
  const phrase = requireString(formData.get("phrase"), "phrase");
  await withCloud(name, (cloud) => rejectTerm(cloud, phrase));
}

export async function changeRole(formData: FormData) {
  const name = requireString(formData.get("cloud"), "cloud");
  const phrase = requireString(formData.get("phrase"), "phrase");
  const role = String(formData.get("role") || "");

  // An empty role clears the override and returns the term to its derived one.
  await withCloud(name, (cloud) => setRole(cloud, phrase, role || null));
}

export async function addPhrase(formData: FormData) {
  const name = requireString(formData.get("cloud"), "cloud");
  const phrase = requireString(formData.get("phrase"), "phrase");
  const asCore = formData.get("core") === "on";

  await withCloud(name, (cloud) =>
    addTerm(cloud, phrase, {
      status: asCore ? STATUS.CORE : STATUS.CANDIDATE,
      tool: "manual",
      detail: "web",
    }),
  );
}

/* ------------------------------------------------------------------- queue */

/**
 * Measure the cloud's core terms.
 *
 * Enqueued rather than run: twenty terms at a five-second throttle is a couple
 * of minutes by design, and a request that waited for it would time out.
 */
export async function queueRankings(formData: FormData) {
  const name = requireString(formData.get("cloud"), "cloud");
  const cloud = await loadCloud(name);
  const phrases = getTerms(cloud, STATUS.CORE).map((t: any) => t.phrase);

  if (!phrases.length) return;
  await jobs.enqueue("rankings", { phrases, target: cloud.target });
  refresh();
}

export async function queueCoverage(formData: FormData) {
  const name = requireString(formData.get("cloud"), "cloud");
  const cloud = await loadCloud(name);
  const url = String(formData.get("url") || cloud.target || "");
  const phrases = getTerms(cloud, STATUS.CORE).map((t: any) => t.phrase);

  if (!url || !phrases.length) return;
  await jobs.enqueue("coverage", { url, phrases });
  refresh();
}

export async function queuePropose(formData: FormData) {
  const seed = requireString(formData.get("seed"), "seed");
  await jobs.enqueue("propose", {
    seed,
    cascade: formData.get("cascade") === "on",
  });
  refresh();
}

export async function queueAudit(formData: FormData) {
  const url = requireString(formData.get("url"), "url");
  await jobs.enqueue("audit", { url, skipLM: true });
  refresh();
}

export async function cancelJob(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id < 1) throw new Error("A job id is required");
  await jobs.cancelJob(id);
  refresh();
}
