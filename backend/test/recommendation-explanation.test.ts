import { fileURLToPath } from "node:url";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ActiveDataset } from "../src/domain/types.js";
import { createApp } from "../src/app.js";
import { ActiveDatasetStore, loadDatasetFromDirectory } from "../src/services/dataset-service.js";
import { getEmployeeRecommendations, getEmployeeRecommendationsWithExplanations } from "../src/services/recommendation-service.js";
import {
  createOpenAiRecommendationExplanationProvider, getValidatedExplanations,
  EXPLANATION_TIMEOUT_MS, EXPLANATION_CACHE_TTL_MS, EXPLANATION_CACHE_LIMIT,
  type RecommendationExplanationProvider, type RecommendationExplanationRequest,
} from "../src/services/recommendation-explanation-provider.js";

const dataDir = fileURLToPath(new URL("../../", import.meta.url));
let baseDataset: ActiveDataset;
let facts: RecommendationExplanationRequest;
const approved = (input: RecommendationExplanationRequest) => ({ explanations: input.recommendations.map((item) => ({
  event_id: item.event_id, fact_ids: [`impact:${Math.max(0, item.skill_impacts.findIndex((impact) => impact.critical))}`],
})) });
const providerFor = (generateExplanations: RecommendationExplanationProvider["generateExplanations"]): RecommendationExplanationProvider => ({ model: "test-model", generateExplanations });
const config = { port: 8000, corsOrigin: "http://localhost:5173", dataDir, openAiApiKey: undefined, openAiModel: "gpt-5-mini" };
afterEach(() => vi.useRealTimers());

beforeAll(async () => {
  baseDataset = await loadDatasetFromDirectory(dataDir);
  await getEmployeeRecommendationsWithExplanations(baseDataset, "E0001", providerFor(async (input) => {
    facts = structuredClone(input);
    return approved(input);
  }));
});

describe("verified optional AI explanations", () => {
  it("uses rules without a key", async () => {
    for (const apiKey of [undefined, "", "   "]) {
      const provider = createOpenAiRecommendationExplanationProvider({ apiKey, model: undefined });
      expect(provider).toBeUndefined();
      expect(await getEmployeeRecommendationsWithExplanations(baseDataset, "E0001", provider)).toEqual(getEmployeeRecommendations(baseDataset, "E0001"));
    }
  });

  it("renders approved claims with accurate source metadata, preserving every calculation", async () => {
    const deterministic = getEmployeeRecommendations(baseDataset, "E0001");
    const response = await getEmployeeRecommendationsWithExplanations(baseDataset, "E0001", providerFor(async (input) => approved(input)));
    response.recommendations.forEach((item, index) => {
      expect(item.explanation_source).toBe("ai");
      expect(item.explanation).toContain("This activity can raise it to");
      expect({ ...item, explanation: deterministic.recommendations[index].explanation, explanation_source: "rules" }).toEqual(deterministic.recommendations[index]);
    });
    const payload = JSON.stringify(facts);
    expect(payload).not.toContain("employee_id");
    expect(payload).not.toContain(baseDataset.dataset.employees[0].full_name);
    expect(payload).not.toContain("record_id");
  });

  it.each([
    ["malformed", () => null],
    ["invented level", (input: RecommendationExplanationRequest) => ({ explanations: input.recommendations.map((item) => ({ event_id: item.event_id, explanation: "Your level is 999." })) })],
    ["guaranteed promotion", (input: RecommendationExplanationRequest) => ({ explanations: input.recommendations.map((item) => ({ event_id: item.event_id, fact_ids: ["impact:0"], explanation: "You are guaranteed promotion." })) })],
    ["wrong ID", (input: RecommendationExplanationRequest) => { const output = approved(input); output.explanations[0].event_id = "UNKNOWN"; return output; }],
    ["duplicate ID", (input: RecommendationExplanationRequest) => { const output = approved(input); output.explanations[1] = output.explanations[0]; return output; }],
    ["partial", (input: RecommendationExplanationRequest) => ({ explanations: approved(input).explanations.slice(0, 1) })],
    ["invented fact", (input: RecommendationExplanationRequest) => { const output = approved(input); output.explanations[0].fact_ids = ["impact:999"]; return output; }],
    ["duplicate fact", (input: RecommendationExplanationRequest) => { const output = approved(input); output.explanations[0].fact_ids.push(output.explanations[0].fact_ids[0]); return output; }],
    ["too many facts", (input: RecommendationExplanationRequest) => { const output = approved(input); output.explanations[0].fact_ids = Array(20).fill("impact:0"); return output; }],
  ])("falls back for %s output", async (_label, output) => {
    expect(await getEmployeeRecommendationsWithExplanations(baseDataset, "E0001", providerFor(async (input) => output(input))))
      .toEqual(getEmployeeRecommendations(baseDataset, "E0001"));
  });

  it("rejects excessively long rendered claims", async () => {
    const input = structuredClone(facts);
    input.employee.target_role = "x".repeat(1000);
    expect((await getValidatedExplanations(providerFor(async (input) => approved(input)), input)).size).toBe(0);
  });

  it("bounds even an unresponsive provider, aborts it, and never caches a late response", async () => {
    vi.useFakeTimers();
    let finish!: (value: unknown) => void;
    let signal: AbortSignal | undefined;
    const generate = vi.fn((_input: RecommendationExplanationRequest, supplied?: AbortSignal) => {
      signal = supplied;
      return new Promise((resolve) => { finish = resolve; });
    });
    const provider = providerFor(generate);
    const response = getValidatedExplanations(provider, facts);
    await vi.advanceTimersByTimeAsync(EXPLANATION_TIMEOUT_MS + 1);
    expect((await response).size).toBe(0);
    expect(signal?.aborted).toBe(true);
    finish(approved(facts));
    generate.mockImplementation(async (input) => approved(input));
    expect((await getValidatedExplanations(provider, facts)).size).toBe(facts.recommendations.length);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent requests and caches only validated successes until expiration", async () => {
    vi.useFakeTimers();
    const generate = vi.fn(async (input: RecommendationExplanationRequest) => approved(input));
    const provider = providerFor(generate);
    const results = await Promise.all([getValidatedExplanations(provider, facts), getValidatedExplanations(provider, facts)]);
    expect(results[0]).toEqual(results[1]);
    results[0].clear(); // Clients cannot mutate cached values.
    expect((await getValidatedExplanations(provider, facts)).size).toBe(facts.recommendations.length);
    expect(generate).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(EXPLANATION_CACHE_TTL_MS + 1);
    await getValidatedExplanations(provider, facts);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("invalidates on changes to skills, history, target, activity details, and model", async () => {
    const generate = vi.fn(async (input: RecommendationExplanationRequest) => approved(input));
    const provider = { model: "one", generateExplanations: generate };
    await getValidatedExplanations(provider, facts);
    for (const change of [
      (input: RecommendationExplanationRequest) => { input.recommendations[0].skill_impacts[0].current_level += 1; },
      (input: RecommendationExplanationRequest) => { input.recommendations[0].completed_similar += 1; },
      (input: RecommendationExplanationRequest) => { input.employee.target_grade = "Lead"; },
      (input: RecommendationExplanationRequest) => { input.recommendations[0].activity_title += " updated"; },
      (input: RecommendationExplanationRequest) => { input.recommendations[0].duration_hours += 1; },
    ]) {
      const input = structuredClone(facts); change(input);
      await getValidatedExplanations(provider, input);
    }
    provider.model = "two";
    await getValidatedExplanations(provider, facts);
    expect(generate).toHaveBeenCalledTimes(7);
  });

  it("evicts old entries at the cache size limit", async () => {
    const generate = vi.fn(async (input: RecommendationExplanationRequest) => approved(input));
    const provider = providerFor(generate);
    for (let i = 0; i <= EXPLANATION_CACHE_LIMIT; i++) {
      const input = structuredClone(facts); input.employee.target_role = `Role ${i}`;
      await getValidatedExplanations(provider, input);
    }
    const input = structuredClone(facts); input.employee.target_role = "Role 0";
    await getValidatedExplanations(provider, input);
    expect(generate).toHaveBeenCalledTimes(EXPLANATION_CACHE_LIMIT + 2);
  });

  it("does not cache failures or call AI for empty recommendations, HR, or completion", async () => {
    const generate = vi.fn(async () => { throw new Error("Provider unavailable"); });
    const provider = providerFor(generate);
    await getValidatedExplanations(provider, { ...facts, recommendations: [] });
    expect(generate).not.toHaveBeenCalled();
    const store = new ActiveDatasetStore(baseDataset);
    const app = createApp(config, store, provider);
    await request(app).get("/api/hr/overview").expect(200);
    const deterministic = getEmployeeRecommendations(store.get(), "E0001");
    const completion = await request(app).post("/api/employees/E0001/complete").send({ event_id: deterministic.recommendations.find((item) => item.can_complete)!.event_id }).expect(201);
    expect(generate).not.toHaveBeenCalled();
    expect(completion.body.recommendations.every((item: { explanation_source: string }) => item.explanation_source === "rules")).toBe(true);
    const after = getEmployeeRecommendations(store.get(), "E0001");
    for (let i = 0; i < 2; i++) {
      const result = await request(app).get("/api/employees/E0001/recommendations").expect(200);
      expect(result.body).toEqual(after);
    }
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
