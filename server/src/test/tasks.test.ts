import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { connectTestDb, clearTestDb, closeTestDb, uniqueEmail } from "./helpers.js";

const app = createApp();

beforeAll(async () => {
  await connectTestDb();
  await clearTestDb();
});
afterAll(async () => {
  await clearTestDb();
  await closeTestDb();
});

describe("tasks : CRUD, statut, filtres", () => {
  let agent: ReturnType<typeof request.agent>;
  let token: string;
  let workspaceId: string;
  let projectId: string;

  beforeAll(async () => {
    agent = request.agent(app);
    const reg = await agent.post("/api/v1/auth/register").send({
      firstName: "Task",
      email: uniqueEmail("task"),
      password: "Password123!",
      profileType: "student",
    });
    token = reg.body.data.accessToken as string;
    const auth = { Authorization: `Bearer ${token}` };
    const ob = await agent.post("/api/v1/auth/onboarding").set(auth).send({
      firstName: "Task", profileType: "student", workspaceName: "Cours", workspaceType: "school", language: "fr", timezone: "Europe/Paris",
    });
    workspaceId = ob.body.data.workspace._id as string;
    const pr = await agent.post("/api/v1/projects").set(auth).send({ workspaceId, name: "Maths", color: "#1d4ed8" });
    projectId = pr.body.data.project._id as string;
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it("rejette une tâche sans titre", async () => {
    const res = await agent.post("/api/v1/tasks").set(auth()).send({ workspaceId, title: "" });
    expect(res.status).toBe(400);
  });

  it("CRUD complet + changement de statut (kanban)", async () => {
    const created = await agent.post("/api/v1/tasks").set(auth()).send({
      workspaceId, projectId, title: "Réviser le chapitre 4", priority: "high",
      dueDate: new Date().toISOString(), tags: ["maths"],
    });
    expect(created.status).toBe(201);
    const id = created.body.data.task._id as string;

    const second = await agent.post("/api/v1/tasks").set(auth()).send({ workspaceId, projectId, title: "Exercice 5", status: "completed" });
    expect(second.status).toBe(201);

    const filtered = await agent.get("/api/v1/tasks").set(auth()).query({ workspaceId, status: "todo" });
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.some((t: { _id: string }) => t._id === id)).toBe(true);

    const moved = await agent.patch(`/api/v1/tasks/${id}/move`).set(auth()).send({ status: "in_progress", position: 0 });
    expect(moved.status).toBe(200);
    expect(moved.body.data.task.status).toBe("in_progress");

    const toggled = await agent.patch(`/api/v1/tasks/${id}/complete`).set(auth()).send({});
    expect(toggled.body.data.task.status).toBe("completed");

    const project = await agent.get(`/api/v1/projects/${projectId}`).set(auth());
    expect(project.body.data.project.progress).toBe(100);

    const deleted = await agent.delete(`/api/v1/tasks/${id}`).set(auth());
    expect(deleted.status).toBe(200);
    const gone = await agent.get(`/api/v1/tasks/${id}`).set(auth());
    expect(gone.status).toBe(404);
  });
});
