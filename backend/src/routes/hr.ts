import { Router } from "express";

import { getHrOverview } from "../services/hr-service.js";
import type { ActiveDatasetStore } from "../services/dataset-service.js";

export function createHrRouter(datasetStore: ActiveDatasetStore): Router {
  const router = Router();

  router.get("/hr/overview", (_request, response) => {
    response.status(200).json(getHrOverview(datasetStore.get()));
  });

  return router;
}
