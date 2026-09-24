import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { connectTestDb, clearTestDb, closeTestDb, uniqueEmail } from "./helpers.js";

const app = createApp();

async function authedAgent(profileType = "professional") {
  const agent = request.agent(app);
  const email = uniqueEmail("ws");
  const reg = await agent.post("/api/v1/auth/register").send({
    firstName: "Ws",
    email,
    password: "Password123!",
    profileType,
  });
  return { agent, token: reg.body.data.accessToken as string };
}

beforeAll(async () => {
  await connectTestDb();
  await clearTestDb();
});
afterAll(async () => {
  await clearTestDb();
  await closeTestDb();
});

describe("workspaces : permissions", () => {
  it("refuse l'accès sans token", async () => {
    const res = await request(app).get("/api/v1/workspaces");
    expect(res.status).toBe(401);
  });

  it("rejette une création invalide", async () => {
    const { agent, token } = await authedAgent();
    const res = await agent.post("/api/v1/workspaces").set("Authorization", `Bearer ${token}`).send({ name: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("isole les espaces entre utilisateurs", async () => {
    const a = await authedAgent();
    const created = await a.agent.post("/api/v1/workspaces").set("Authorization", `Bearer ${a.token}`).send({ name: "Privé A", type: "personal" });
    expect(created.status).toBe(201);
    const wsId = created.body.data.workspace._id as string;

    const b = await authedAgent();
    const forbidden = await b.agent.get(`/api/v1/workspaces/${wsId}`).set("Authorization", `Bearer ${b.token}`);
    expect(forbidden.status).toBe(403);

    const patchForbidden = await b.agent.patch(`/api/v1/workspaces/${wsId}`).set("Authorization", `Bearer ${b.token}`).send({ name: "Hack" });
    expect(patchForbidden.status).toBe(403);

    const ok = await a.agent.get(`/api/v1/workspaces/${wsId}`).set("Authorization", `Bearer ${a.token}`);
    expect(ok.status).toBe(200);
  });
});
