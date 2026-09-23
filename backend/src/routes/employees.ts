import { Router } from "express";

import { HttpError } from "../domain/errors.js";
import { getEmployeeProfile } from "../services/profile-service.js";
import { completeActivity } from "../services/completion-service.js";
import {
  getEmployeeRecommendationsWithExplanations,
} from "../services/recommendation-service.js";
import type { RecommendationExplanationProvider } from "../services/recommendation-explanation-provider.js";
import type { ActiveDatasetStore } from "../services/dataset-service.js";

export function createEmployeeRouter(
  datasetStore: ActiveDatasetStore,
  explanationProvider: RecommendationExplanationProvider | undefined,
): Router {
  const router = Router();

  router.get("/employees", (_request, response) => {
    const employees = datasetStore.get().dataset.employees.map((employee) => ({
      employee_id: employee.employee_id,
      full_name: employee.full_name,
      role: employee.role,
      grade: employee.grade,
      department: employee.department,
    }));

    response.status(200).json({ employees, total: employees.length });
  });

  router.get("/employees/:employeeId", (request, response, next) => {
    try {
      response.status(200).json(getEmployeeProfile(datasetStore.get(), request.params.employeeId));
    } catch (error) {
      next(error);
    }
  });

  router.get("/employees/:employeeId/recommendations", async (request, response, next) => {
    try {
      response.status(200).json(await getEmployeeRecommendationsWithExplanations(
        datasetStore.get(),
        request.params.employeeId,
        explanationProvider,
      ));
    } catch (error) {
      next(error);
    }
  });

  router.post("/employees/:employeeId/complete", (request, response, next) => {
    if (!isCompletionRequest(request.body)) {
      next(new HttpError(400, "INVALID_REQUEST", "Request body must contain a non-empty event_id string."));
      return;
    }
    try {
      response.status(201).json(completeActivity(datasetStore, request.params.employeeId, request.body.event_id, request.body.session_date));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function isCompletionRequest(body: unknown): body is { event_id: string; session_date?: string } {
  return typeof body === "object" && body !== null && "event_id" in body &&
    typeof body.event_id === "string" && body.event_id.trim() !== "" &&
    (!("session_date" in body) || typeof body.session_date === "string");
}
