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

describe("search globale", () => {
  let agent: ReturnType<typeof request.agent>;
  let token: string;
  let workspaceId: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    agent = request.agent(app);
    const reg = await agent.post("/api/v1/auth/register").send({
      firstName: "Search",
      email: uniqueEmail("search"),
      password: "Password123!",
      profileType: "professional",
    });
    token = reg.body.data.accessToken as string;
    const ob = await agent.post("/api/v1/auth/onboarding").set(auth()).send({
      firstName: "Search", profileType: "professional", workspaceName: "Bureau", workspaceType: "work", language: "fr", timezone: "Europe/Paris",
    });
    workspaceId = ob.body.data.workspace._id as string;
    await agent.post("/api/v1/tasks").set(auth()).send({ workspaceId, title: "Rapport trimestriel unique" });
    await agent.post("/api/v1/projects").set(auth()).send({ workspaceId, name: "Projet trimestriel" });
  });

  it("rejette les requêtes trop courtes ou sans workspace", async () => {
    const short = await agent.get("/api/v1/search").set(auth()).query({ workspaceId, q: "a" });
    expect(short.status).toBe(200);
    expect(short.body.data.tasks).toHaveLength(0);
    const noWs = await agent.get("/api/v1/search").set(auth()).query({ q: "rapport" });
    expect(noWs.status).toBe(403);
  });

  it("retourne tâches + projets en un seul appel", async () => {
    const res = await agent.get("/api/v1/search").set(auth()).query({ workspaceId, q: "trimestriel" });
    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toHaveLength(1);
    expect(res.body.data.projects).toHaveLength(1);
    expect(res.body.data.tasks[0].description).toBeUndefined();
  });
});
