import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import type { ActiveDataset } from "../src/domain/types.js";
import { createApp } from "../src/app.js";
import { ActiveDatasetStore, loadDatasetFromDirectory } from "../src/services/dataset-service.js";
import {
  getEmployeeRecommendations,
  getEmployeeRecommendationsWithExplanations,
} from "../src/services/recommendation-service.js";
import {
  createOpenAiRecommendationExplanationProvider,
  type RecommendationExplanationProvider,
  type RecommendationExplanationRequest,
} from "../src/services/recommendation-explanation-provider.js";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const dataDirectory = resolve(testDirectory, "../..");
let baseDataset: ActiveDataset;

function withoutExplanations(response: ReturnType<typeof getEmployeeRecommendations>) {
  return {
    ...response,
    recommendations: response.recommendations.map(({ explanation: _explanation, ...recommendation }) => recommendation),
  };
}

function providerFor(
  generateExplanations: (input: RecommendationExplanationRequest) => Promise<unknown>,
): RecommendationExplanationProvider {
  return { generateExplanations };
}

describe("optional recommendation explanations", () => {
  beforeAll(async () => {
    baseDataset = await loadDatasetFromDirectory(dataDirectory);
  });

  it("uses deterministic explanations when no API key/provider is available", async () => {
    const deterministic = getEmployeeRecommendations(baseDataset, "E0001");
    const provider = createOpenAiRecommendationExplanationProvider({ apiKey: undefined, model: undefined });

    const response = await getEmployeeRecommendationsWithExplanations(baseDataset, "E0001", provider);

    expect(provider).toBeUndefined();
    expect(response).toEqual(deterministic);
  });

  it("replaces only explanations from one successful provider request", async () => {
    const deterministic = getEmployeeRecommendations(baseDataset, "E0001");
    let calls = 0;
    let capturedInput: RecommendationExplanationRequest | undefined;
    const provider = providerFor(async (input) => {
      calls += 1;
      capturedInput = input;
      return {
        explanations: input.recommendations.map((recommendation) => ({
          event_id: recommendation.event_id,
          explanation: `AI explanation for ${recommendation.event_id}.`,
        })),
      };
    });

    const response = await getEmployeeRecommendationsWithExplanations(baseDataset, "E0001", provider);

    expect(calls).toBe(1);
    expect(capturedInput).toMatchObject({
      employee: {
        current_role: "Backend Engineer",
        current_grade: "Junior",
        target_role: "Backend Engineer",
        target_grade: "Middle",
      },
    });
    expect(capturedInput?.recommendations).toContainEqual(expect.objectContaining({
      event_id: deterministic.recommendations[0].event_id,
      activity_title: deterministic.recommendations[0].title,
      activity_type: deterministic.recommendations[0].type,
    }));
    expect(withoutExplanations(response)).toEqual(withoutExplanations(deterministic));
    expect(response.recommendations.map((item) => item.explanation)).toEqual(
      deterministic.recommendations.map((item) => `AI explanation for ${item.event_id}.`),
    );
  });

  it("falls back deterministically when the provider fails or returns malformed output", async () => {
    const deterministic = getEmployeeRecommendations(baseDataset, "E0001");
    const failingProvider = providerFor(async () => { throw new Error("Provider unavailable"); });
    const malformedProvider = providerFor(async () => ({ explanations: [{ event_id: 123, explanation: "Invalid" }] }));

    expect(await getEmployeeRecommendationsWithExplanations(baseDataset, "E0001", failingProvider)).toEqual(deterministic);
    expect(await getEmployeeRecommendationsWithExplanations(baseDataset, "E0001", malformedProvider)).toEqual(deterministic);
  });

  it("keeps fallback wording for events missing from a partial provider response", async () => {
    const deterministic = getEmployeeRecommendations(baseDataset, "E0001");
    const provider = providerFor(async (input) => ({
      explanations: [{ event_id: input.recommendations[0].event_id, explanation: "AI explanation for the first event." }],
    }));

    const response = await getEmployeeRecommendationsWithExplanations(baseDataset, "E0001", provider);

    expect(response.recommendations[0].explanation).toBe("AI explanation for the first event.");
    expect(response.recommendations.slice(1).map((item) => item.explanation)).toEqual(
      deterministic.recommendations.slice(1).map((item) => item.explanation),
    );
  });

  it("never invokes the provider for the HR overview", async () => {
    let calls = 0;
    const provider = providerFor(async () => {
      calls += 1;
      return { explanations: [] };
    });
    const app = createApp(
      {
        port: 8000,
        corsOrigin: "http://localhost:5173",
        dataDir: dataDirectory,
        openAiApiKey: "test-key",
        openAiModel: "gpt-5-mini",
      },
      new ActiveDatasetStore(baseDataset),
      provider,
    );

    await request(app).get("/api/hr/overview").expect(200);

    expect(calls).toBe(0);
  });
});
