import cors from "cors";
import express, { type ErrorRequestHandler } from "express";

import { HttpError } from "./domain/errors.js";
import { createEmployeeRouter } from "./routes/employees.js";
import { createHrRouter } from "./routes/hr.js";
import { createImportRouter } from "./routes/imports.js";
import type { AppConfig } from "./config/env.js";
import type { ActiveDatasetStore } from "./services/dataset-service.js";
import {
  createOpenAiRecommendationExplanationProvider,
  type RecommendationExplanationProvider,
} from "./services/recommendation-explanation-provider.js";

export function createApp(
  config: AppConfig,
  datasetStore: ActiveDatasetStore,
  explanationProvider: RecommendationExplanationProvider | undefined = createOpenAiRecommendationExplanationProvider({
    apiKey: config.openAiApiKey,
    model: config.openAiModel,
  }),
) {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());
  app.use("/api", createEmployeeRouter(datasetStore, explanationProvider));
  app.use("/api", createHrRouter(datasetStore));
  app.use("/api", createImportRouter(datasetStore));

  app.use((_request, _response, next) => {
    next(new HttpError(404, "NOT_FOUND", "The requested API resource was not found."));
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof HttpError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }

    if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json({
        error: { code: "INVALID_JSON", message: "Request body must contain valid JSON." },
      });
      return;
    }

    console.error(error);
    response.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "An unexpected server error occurred." },
    });
  };
  app.use(errorHandler);

  return app;
}
