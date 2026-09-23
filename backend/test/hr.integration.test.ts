import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { ActiveDatasetStore, loadDatasetFromDirectory } from "../src/services/dataset-service.js";
import { getEmployeeRecommendations } from "../src/services/recommendation-service.js";

const dataDir = fileURLToPath(new URL("../../", import.meta.url));

describe("HR overview integration", () => {
  let app: ReturnType<typeof createApp>;
  let store: ActiveDatasetStore;
  beforeEach(async () => {
    store = new ActiveDatasetStore(await loadDatasetFromDirectory(resolve(dataDir)));
    app = createApp({
      port: 8000,
      corsOrigin: "http://localhost:5173",
      dataDir,
      openAiApiKey: undefined,
      openAiModel: "gpt-5-mini",
    }, store);
  });

  it("reports dataset counts, ordered gaps, participation and actual employees without recommendations", async () => {
    const { body } = await request(app).get("/api/hr/overview").expect(200);
    const dataset = store.get().dataset;
    expect(body.employee_count).toBe(dataset.employees.length);
    expect(body.completed_activity_count).toBe(dataset.activityHistory.filter((record) => record.status === "completed").length);
    expect(body.top_skill_gaps.length).toBeGreaterThan(0);
    expect(body.top_skill_gaps.map((gap: { employee_count: number }) => gap.employee_count))
      .toEqual(body.top_skill_gaps.map((gap: { employee_count: number }) => gap.employee_count).sort((a: number, b: number) => b - a));
    for (const event of body.participation_by_event) {
      for (const status of ["completed", "no_show", "dropped"]) {
        expect(event[status]).toBe(dataset.activityHistory.filter((record) => record.event_id === event.event_id && record.status === status).length);
      }
    }
    for (const employee of body.employees_without_step) {
      const recommendations = await request(app).get(`/api/employees/${employee.employee_id}/recommendations`).expect(200);
      expect(recommendations.body.recommendations).toEqual([]);
    }
    const firstGap = body.top_skill_gaps[0];
    let count = 0;
    for (const employee of dataset.employees) {
      const { body: profile } = await request(app).get(`/api/employees/${employee.employee_id}`).expect(200);
      if (profile.skills.some((skill: { skill_id: string; gap: number }) => skill.skill_id === firstGap.skill_id && skill.gap > 0)) count += 1;
    }
    expect(firstGap.employee_count).toBe(count);
  });

  it("reflects completion and imported employees immediately, and remains unchanged after invalid import", async () => {
    const before = await request(app).get("/api/hr/overview").expect(200);
    const employee = store.get().dataset.employees[0];
    const recommendations = await request(app).get(`/api/employees/${employee.employee_id}/recommendations`).expect(200);
    const eventId = recommendations.body.recommendations[0].event_id;
    await request(app).post(`/api/employees/${employee.employee_id}/complete`).send({ event_id: eventId }).expect(201);
    const completed = await request(app).get("/api/hr/overview").expect(200);
    expect(completed.body.completed_activity_count).toBe(before.body.completed_activity_count + 1);
    const importedEmployee = { ...employee, employee_id: "HR_IMPORTED", full_name: "HR Imported", skills: Object.fromEntries(store.get().dataset.skills.map((skill) => [skill.skill_id, 5])) };
    await request(app).post("/api/import").attach("files", Buffer.from(JSON.stringify({
      meta: { dataset: "Career Quest", version: "1.0", as_of_date: "2026-10-01" }, employees: [importedEmployee],
    })), "employees.json").expect(200);
    const imported = await request(app).get("/api/hr/overview").expect(200);
    expect(imported.body.employee_count).toBe(before.body.employee_count + 1);
    expect(imported.body.employees_without_step).toContainEqual({
      employee_id: "HR_IMPORTED", full_name: "HR Imported", role: employee.role, grade: employee.grade,
    });
    await request(app).post("/api/import").attach("files", Buffer.from("invalid"), "employees.json").expect(400);
    const afterFailure = await request(app).get("/api/hr/overview").expect(200);
    expect(afterFailure.body).toEqual(imported.body);
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

  it("serves deterministic recommendations and completes activities without an API key", async () => {
    const employeeId = store.get().dataset.employees[0].employee_id;
    const deterministic = getEmployeeRecommendations(store.get(), employeeId);
    expect(deterministic.recommendations.length).toBeGreaterThan(0);

    const recommendations = await request(app).get(`/api/employees/${employeeId}/recommendations`).expect(200);
    expect(recommendations.body).toEqual(deterministic);

    const completion = await request(app).post(`/api/employees/${employeeId}/complete`)
      .send({ event_id: deterministic.recommendations[0].event_id }).expect(201);
    const updated = getEmployeeRecommendations(store.get(), employeeId);
    expect(completion.body.recommendations).toEqual(updated.recommendations);
    expect(completion.body.profile.history).toContainEqual(expect.objectContaining({
      record_id: completion.body.record_id, status: "completed",
    }));
    const refreshed = await request(app).get(`/api/employees/${employeeId}/recommendations`).expect(200);
    expect(refreshed.body).toEqual(updated);
  });

});
