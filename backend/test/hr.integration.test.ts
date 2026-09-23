import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { ActiveDatasetStore, loadDatasetFromDirectory } from "../src/services/dataset-service.js";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const dataDirectory = resolve(testDirectory, "../..");

describe("GET /api/hr/overview", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    const dataset = await loadDatasetFromDirectory(dataDirectory);
    app = createApp(
      { port: 8000, corsOrigin: "http://localhost:5173", dataDir: dataDirectory },
      new ActiveDatasetStore(dataset),
    );
  });

  it("returns the exact contract response shape", async () => {
    const response = await request(app).get("/api/hr/overview").expect(200);

    expect(Object.keys(response.body).sort()).toEqual([
      "completed_activity_count",
      "employee_count",
      "employees_without_step",
      "participation_by_event",
      "top_skill_gaps",
    ]);
    expect(response.body).toMatchObject({
      employee_count: expect.any(Number),
      completed_activity_count: expect.any(Number),
      top_skill_gaps: expect.any(Array),
      participation_by_event: expect.any(Array),
      employees_without_step: expect.any(Array),
    });
    expect(response.body.top_skill_gaps[0]).toEqual({
      skill_id: expect.any(String),
      name: expect.any(String),
      employee_count: expect.any(Number),
    });
    expect(response.body.participation_by_event[0]).toEqual({
      event_id: expect.any(String),
      title: expect.any(String),
      completed: expect.any(Number),
      no_show: expect.any(Number),
      dropped: expect.any(Number),
    });
    for (const employee of response.body.employees_without_step) {
      expect(employee).toEqual({
        employee_id: expect.any(String),
        full_name: expect.any(String),
        role: expect.any(String),
        grade: expect.any(String),
      });
    }
  });
});
