import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { ActiveDatasetStore, loadDatasetFromDirectory } from "../src/services/dataset-service.js";
import type { ActiveDataset } from "../src/domain/types.js";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const dataDirectory = resolve(testDirectory, "../..");

describe("GET /api/employees", () => {
  let app: ReturnType<typeof createApp>;
  let initialDataset: ActiveDataset;

  beforeAll(async () => {
    initialDataset = await loadDatasetFromDirectory(dataDirectory);
    app = createApp(
      {
        port: 8000,
        corsOrigin: "http://localhost:5173",
        dataDir: dataDirectory,
        openAiApiKey: undefined,
        openAiModel: "gpt-5-mini",
      },
      new ActiveDatasetStore(initialDataset),
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

  it("returns the contract recommendation shape for a real employee", async () => {
    const response = await request(app).get("/api/employees/E0001/recommendations").expect(200);

    expect(Object.keys(response.body).sort()).toEqual([
      "employee_id",
      "recommendations",
      "target_grade",
      "target_role",
    ]);
    expect(response.body).toMatchObject({
      employee_id: "E0001",
      target_role: "Backend Engineer",
      target_grade: "Middle",
    });
    for (const recommendation of response.body.recommendations) {
      expect(Object.keys(recommendation).sort()).toEqual([
        "can_complete", "duration_hours", "event_id", "explanation", "explanation_source", "factors", "format", "next_session", "rank", "recurring", "score", "title", "type",
      ]);
      expect(recommendation).toMatchObject({
        rank: expect.any(Number), event_id: expect.any(String), title: expect.any(String), type: expect.any(String),
        format: expect.any(String), duration_hours: expect.any(Number), score: expect.any(Number), explanation: expect.any(String),
        factors: { current_grade: expect.any(String), target_grade: expect.any(String), skill_impacts: expect.any(Array), completed_similar: expect.any(Number), missed_or_declined_similar: expect.any(Number) },
      });
      expect(recommendation.next_session === null || typeof recommendation.next_session === "string").toBe(true);
    }
  });

  it("returns a contract-compatible 404 for recommendation requests with unknown employees", async () => {
    const response = await request(app).get("/api/employees/E_UNKNOWN/recommendations").expect(404);

    expect(response.body).toEqual({
      error: { code: "EMPLOYEE_NOT_FOUND", message: "Employee E_UNKNOWN was not found." },
    });
  });

  it("completes an eligible recommendation and returns refreshed profile and recommendations", async () => {
    const beforeProfile = await request(app).get("/api/employees/E0001").expect(200);
    const beforeRecommendations = await request(app).get("/api/employees/E0001/recommendations").expect(200);
    const eventId = beforeRecommendations.body.recommendations[0].event_id;
    const impactedSkillId = beforeRecommendations.body.recommendations[0].factors.skill_impacts[0].skill_id;
    const beforeSkill = beforeProfile.body.skills.find((skill: { skill_id: string }) => skill.skill_id === impactedSkillId);

    const completion = await request(app)
      .post("/api/employees/E0001/complete")
      .send({ event_id: eventId })
      .expect(201);

    const afterSkill = completion.body.profile.skills.find((skill: { skill_id: string }) => skill.skill_id === impactedSkillId);
    expect(completion.body).toMatchObject({
      employee_id: "E0001",
      event_id: eventId,
      record_id: expect.stringMatching(/^R\d+$/),
      status: "completed",
      completed_on: "2026-10-01",
      skill_changes: expect.any(Array),
      profile: expect.any(Object),
      recommendations: expect.any(Array),
    });
    expect(afterSkill.current_level).toBeGreaterThan(beforeSkill.current_level);
    expect(completion.body.profile.history[0]).toMatchObject({ event_id: eventId, status: "completed" });
    expect(completion.body.recommendations.some((item: { event_id: string }) => item.event_id === eventId)).toBe(false);
  });

  it("returns contract errors for invalid, duplicate, and unknown completion requests", async () => {
    const invalid = await request(app).post("/api/employees/E0001/complete").send({}).expect(400);
    const unknownEmployee = await request(app).post("/api/employees/E_UNKNOWN/complete").send({ event_id: "EV_005" }).expect(404);
    const unknownEvent = await request(app).post("/api/employees/E0001/complete").send({ event_id: "EV_UNKNOWN" }).expect(404);
    const currentProfile = await request(app).get("/api/employees/E0001").expect(200);
    const completedEventId = currentProfile.body.history.find(
      (item: { status: string; date: string }) => item.status === "completed" && item.date === "2026-10-01",
    ).event_id;
    const duplicate = await request(app).post("/api/employees/E0001/complete").send({ event_id: completedEventId }).expect(409);

    expect(invalid.body.error.code).toBe("INVALID_REQUEST");
    expect(unknownEmployee.body.error.code).toBe("EMPLOYEE_NOT_FOUND");
    expect(unknownEvent.body.error.code).toBe("EVENT_NOT_FOUND");
    expect(duplicate.body.error.code).toBe("EVENT_ALREADY_COMPLETED");
  });

  it("imports an employee through multipart and serves normal employee endpoints", async () => {
    const sourceEmployee = initialDataset.indexes.employeesById.get("E0001");
    if (!sourceEmployee) throw new Error("Expected E0001 in starter data.");
    const employee = { ...sourceEmployee, employee_id: "JUDGE_HTTP_001", full_name: "Imported HTTP Employee" };
    const uploadDocument = JSON.stringify({
      meta: { dataset: "Career Quest", version: "1.0", as_of_date: "2026-10-01" },
      employees: [employee],
    });

    const imported = await request(app)
      .post("/api/import")
      .attach("files", Buffer.from(uploadDocument), "employees.json")
      .expect(200);
    const list = await request(app).get("/api/employees").expect(200);
    const profile = await request(app).get("/api/employees/JUDGE_HTTP_001").expect(200);
    const recommendations = await request(app).get("/api/employees/JUDGE_HTTP_001/recommendations").expect(200);

    expect(imported.body).toEqual({
      loaded: { employees: 1, events: 0, skills: 0, history: 0 },
      total: { employees: 201, events: 40, skills: 60, history: 2744 },
      imported_employee_ids: ["JUDGE_HTTP_001"],
    });
    expect(list.body.employees.some((item: { employee_id: string }) => item.employee_id === "JUDGE_HTTP_001")).toBe(true);
    expect(profile.body.employee_id).toBe("JUDGE_HTTP_001");
    expect(recommendations.body.employee_id).toBe("JUDGE_HTTP_001");
  });
});
