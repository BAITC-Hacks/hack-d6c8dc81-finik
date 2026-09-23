import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { ActiveDatasetStore, loadDatasetFromDirectory } from "../src/services/dataset-service.js";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const dataDirectory = resolve(testDirectory, "../..");

describe("GET /api/employees", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    const activeDataset = await loadDatasetFromDirectory(dataDirectory);
    app = createApp(
      { port: 8000, corsOrigin: "http://localhost:5173", dataDir: dataDirectory },
      new ActiveDatasetStore(activeDataset),
    );
  });

  it("returns the contract employee selector shape from active dataset data", async () => {
    const response = await request(app).get("/api/employees").expect(200);

    expect(response.body.total).toBe(200);
    expect(response.body.employees).toHaveLength(200);
    expect(response.body.employees[0]).toEqual({
      employee_id: "E0001",
      full_name: "Marat Yessenov",
      role: "Backend Engineer",
      grade: "Junior",
      department: "Backend Development",
    });
  });

  it("uses the contract-compatible error envelope for unknown routes", async () => {
    const response = await request(app).get("/api/unknown").expect(404);

    expect(response.body).toEqual({
      error: { code: "NOT_FOUND", message: "The requested API resource was not found." },
    });
  });

  it("returns the exact profile response shape for a real employee", async () => {
    const response = await request(app).get("/api/employees/E0001").expect(200);

    expect(Object.keys(response.body).sort()).toEqual([
      "employee_id",
      "full_name",
      "grade",
      "history",
      "readiness",
      "role",
      "skills",
      "target_grade",
      "target_role",
      "tenure_months",
    ]);
    expect(response.body).toMatchObject({
      employee_id: "E0001",
      full_name: "Marat Yessenov",
      role: "Backend Engineer",
      grade: "Junior",
      target_role: "Backend Engineer",
      target_grade: "Middle",
    });
    expect(response.body.skills[0]).toEqual({
      skill_id: expect.any(String),
      name: expect.any(String),
      current_level: expect.any(Number),
      required_level: expect.any(Number),
      gap: expect.any(Number),
      critical: expect.any(Boolean),
    });
    expect(response.body.history[0]).toEqual({
      record_id: expect.any(String),
      event_id: expect.any(String),
      event_title: expect.any(String),
      date: expect.any(String),
      status: expect.any(String),
    });
    expect(response.body.readiness).toEqual({
      requirements_met: expect.any(Number),
      requirements_total: expect.any(Number),
      critical_requirements_met: expect.any(Number),
      critical_requirements_total: expect.any(Number),
    });
  });

  it("returns a contract-compatible 404 for an unknown employee", async () => {
    const response = await request(app).get("/api/employees/E_UNKNOWN").expect(404);

    expect(response.body).toEqual({
      error: { code: "EMPLOYEE_NOT_FOUND", message: "Employee E_UNKNOWN was not found." },
    });
  });
});
