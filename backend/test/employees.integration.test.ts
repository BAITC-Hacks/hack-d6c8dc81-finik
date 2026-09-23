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
});
