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

describe("auth", () => {
  const email = uniqueEmail("auth");

  it("register crée un compte sans exposer le hash", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      firstName: "Test",
      email,
      password: "Password123!",
      profileType: "student",
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(String(res.headers["set-cookie"] ?? "")).toContain("refreshToken");
  });

  it("register refuse un email déjà utilisé", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      firstName: "Test",
      email,
      password: "Password123!",
      profileType: "student",
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("login refuse un mauvais mot de passe", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ email, password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("login + me + refresh + logout (rotation du refresh token)", async () => {
    const agent = request.agent(app);
    const login = await agent.post("/api/v1/auth/login").send({ email, password: "Password123!" });
    expect(login.status).toBe(200);
    const token = login.body.data.accessToken as string;

    const me = await agent.get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(email.toLowerCase());

    const noAuth = await request(app).get("/api/v1/auth/me");
    expect(noAuth.status).toBe(401);

    const refreshed = await agent.post("/api/v1/auth/refresh");
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.accessToken).toBeTruthy();

    const logout = await agent.post("/api/v1/auth/logout");
    expect(logout.status).toBe(200);
  });

  it("onboarding crée le profil et le premier workspace", async () => {
    const agent = request.agent(app);
    const regEmail = uniqueEmail("onboard");
    const reg = await agent.post("/api/v1/auth/register").send({
      firstName: "Temp",
      email: regEmail,
      password: "Password123!",
      profileType: "entrepreneur",
    });
    const token = reg.body.data.accessToken as string;
    const res = await agent
      .post("/api/v1/auth/onboarding")
      .set("Authorization", `Bearer ${token}`)
      .send({ firstName: "Daniel", profileType: "entrepreneur", workspaceName: "Startup", workspaceType: "business", language: "fr", timezone: "Europe/Paris" });
    expect(res.status).toBe(200);
    expect(res.body.data.user.onboardingCompleted).toBe(true);
    expect(res.body.data.workspace.name).toBe("Startup");
  });
});
