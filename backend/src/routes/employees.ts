import { Router } from "express";

import type { ActiveDatasetStore } from "../services/dataset-service.js";

export function createEmployeeRouter(datasetStore: ActiveDatasetStore): Router {
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

  return router;
}
