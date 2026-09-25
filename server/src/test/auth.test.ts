import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { connectTestDb, clearTestDb, closeTestDb, uniqueEmail } from "./helpers.js";
import { mailOutbox } from "../modules/mail/mailer.js";

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

describe("sécurité du compte : vérification email + mots de passe", () => {
  it("quand la vérification est coupée : inscription directe, sans code", async () => {
    const prev = process.env.REQUIRE_EMAIL_VERIFICATION;
    delete process.env.REQUIRE_EMAIL_VERIFICATION;
    try {
      const agent = request.agent(app);
      const before = mailOutbox.length;
      const reg = await agent.post("/api/v1/auth/register").send({
        firstName: "NoCheck", email: uniqueEmail("nocheck"), password: "Password123!", profileType: "student",
      });
      expect(reg.status).toBe(201);
      expect(reg.body.data.requiresVerification).toBe(false);
      expect(mailOutbox.length).toBe(before);
      const token = reg.body.data.accessToken as string;
      const list = await agent.get("/api/v1/workspaces").set("Authorization", `Bearer ${token}`);
      expect(list.status).toBe(200);
    } finally {
      if (prev === undefined) delete process.env.REQUIRE_EMAIL_VERIFICATION;
      else process.env.REQUIRE_EMAIL_VERIFICATION = prev;
    }
  });

  it("bloque les données tant que l'email n'est pas vérifié", async () => {
    const agent = request.agent(app);
    const reg = await agent.post("/api/v1/auth/register").send({
      firstName: "NoVerify", email: uniqueEmail("noverify"), password: "Password123!", profileType: "student",
    });
    expect(reg.body.data.requiresVerification).toBe(true);
    const token = reg.body.data.accessToken as string;
    const blocked = await agent.get("/api/v1/workspaces").set("Authorization", `Bearer ${token}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("vérifie l'email avec le code reçu puis débloque", async () => {
    const agent = request.agent(app);
    const email = uniqueEmail("verify");
    await agent.post("/api/v1/auth/register").send({
      firstName: "Verify", email, password: "Password123!", profileType: "student",
    });
    const code = /(\d{6})/.exec(mailOutbox[mailOutbox.length - 1]?.html ?? "")?.[1] ?? "";
    expect(code).toHaveLength(6);
    const bad = await agent.post("/api/v1/auth/verify-email").send({ email, code: "000000" });
    expect(bad.status).toBe(401);
    const good = await agent.post("/api/v1/auth/verify-email").send({ email, code });
    expect(good.status).toBe(200);
    const token = good.body.data.accessToken as string;
    const list = await agent.get("/api/v1/workspaces").set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
  });

  it("change le mot de passe et invalide l'ancien", async () => {
    const agent = request.agent(app);
    const email = uniqueEmail("chpwd");
    const reg = await agent.post("/api/v1/auth/register").send({
      firstName: "Chpwd", email, password: "Password123!", profileType: "professional",
    });
    const token = reg.body.data.accessToken as string;
    const wrong = await agent.patch("/api/v1/auth/password").set("Authorization", `Bearer ${token}`).send({ currentPassword: "nope", newPassword: "NewPassword123!" });
    expect(wrong.status).toBe(401);
    const ok = await agent.patch("/api/v1/auth/password").set("Authorization", `Bearer ${token}`).send({ currentPassword: "Password123!", newPassword: "NewPassword123!" });
    expect(ok.status).toBe(200);
    const oldLogin = await request(app).post("/api/v1/auth/login").send({ email, password: "Password123!" });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post("/api/v1/auth/login").send({ email, password: "NewPassword123!" });
    expect(newLogin.status).toBe(200);
  });

  it("oubli + réinitialisation via lien à usage unique", async () => {
    const agent = request.agent(app);
    const email = uniqueEmail("forgot");
    await agent.post("/api/v1/auth/register").send({
      firstName: "Forgot", email, password: "Password123!", profileType: "professional",
    });
    const ghost = await request(app).post("/api/v1/auth/forgot-password").send({ email: uniqueEmail("ghost") });
    expect(ghost.status).toBe(200);
    const sent = await request(app).post("/api/v1/auth/forgot-password").send({ email });
    expect(sent.status).toBe(200);
    const html = mailOutbox[mailOutbox.length - 1]?.html ?? "";
    const token = /token=([a-f0-9]{64})/.exec(html)?.[1] ?? "";
    expect(token).toHaveLength(64);
    const badLink = await request(app).post("/api/v1/auth/reset-password").send({ email, token: "0".repeat(64), newPassword: "Reset12345!" });
    expect(badLink.status).toBe(403);
    const good = await request(app).post("/api/v1/auth/reset-password").send({ email, token, newPassword: "Reset12345!" });
    expect(good.status).toBe(200);
    const reuse = await request(app).post("/api/v1/auth/reset-password").send({ email, token, newPassword: "Reset12345!" });
    expect(reuse.status).toBe(403);
    const login = await request(app).post("/api/v1/auth/login").send({ email, password: "Reset12345!" });
    expect(login.status).toBe(200);
  });
});
