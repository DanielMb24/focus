import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { connectTestDb, clearTestDb, closeTestDb, registerVerifiedUser } from "./helpers.js";

const app = createApp();

beforeAll(async () => {
  await connectTestDb();
  await clearTestDb();
});
afterAll(async () => {
  await clearTestDb();
  await closeTestDb();
});

describe("files : dossiers, upload, liens, corbeille", () => {
  let agent: ReturnType<typeof request.agent>;
  let token: string;
  let workspaceId: string;
  let folderId: string;
  let fileId: string;
  let taskId: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    agent = request.agent(app);
    const verified = await registerVerifiedUser(agent, "professional", "Files");
    token = verified.token;
    const ob = await agent.post("/api/v1/auth/onboarding").set(auth()).send({
      firstName: "Files", profileType: "professional", workspaceName: "Bureau", workspaceType: "work", language: "fr", timezone: "Europe/Paris",
    });
    workspaceId = ob.body.data.workspace._id as string;
    const t = await agent.post("/api/v1/tasks").set(auth()).send({ workspaceId, title: "Préparer rapport" });
    taskId = t.body.data.task._id as string;
  });

  it("CRUD dossier + sous-dossier + fil d'Ariane", async () => {
    const root = await agent.post("/api/v1/folders").set(auth()).send({ workspaceId, name: "Travail" });
    expect(root.status).toBe(201);
    folderId = root.body.data.folder._id as string;
    const sub = await agent.post("/api/v1/folders").set(auth()).send({ workspaceId, name: "Rapports", parentId: folderId });
    expect(sub.status).toBe(201);
    const detail = await agent.get(`/api/v1/folders/${sub.body.data.folder._id}`).set(auth());
    expect(detail.body.data.breadcrumb).toHaveLength(1);
    expect(detail.body.data.breadcrumb[0].name).toBe("Travail");
    const renamed = await agent.patch(`/api/v1/folders/${folderId}`).set(auth()).send({ isFavorite: true });
    expect(renamed.body.data.folder.isFavorite).toBe(true);
  });

  it("refuse un type non supporté et un contenu incohérent", async () => {
    const bad = await agent.post("/api/v1/files").set(auth())
      .field("workspaceId", workspaceId)
      .attach("files", Buffer.from("MZ fake"), "virus.exe");
    expect(bad.status).toBe(400);
  });

  it("upload réel + métadonnées + quota", async () => {
    const up = await agent.post("/api/v1/files").set(auth())
      .field("workspaceId", workspaceId)
      .field("folderId", folderId)
      .attach("files", Buffer.from("Bonjour monde", "utf-8"), "bonjour.txt");
    expect(up.status).toBe(201);
    fileId = up.body.data.files[0]._id as string;
    expect(up.body.data.files[0].storageProvider).toBe("local");
    expect(up.body.data.files[0].mimeType).toBe("text/plain");
    const quota = await agent.get("/api/v1/files/quota").set(auth()).query({ workspaceId });
    expect(quota.body.data.quota.used).toBeGreaterThan(0);
    expect(quota.body.data.quota.count).toBe(1);
  });

  it("téléchargement + aperçu authentifiés, 401 sans token", async () => {
    const dl = await agent.get(`/api/v1/files/${fileId}/download`).set(auth());
    expect(dl.status).toBe(200);
    expect(dl.headers["content-disposition"]).toContain("attachment");
    const anon = await request(app).get(`/api/v1/files/${fileId}/download`);
    expect(anon.status).toBe(401);
    const pv = await agent.get(`/api/v1/files/${fileId}/preview`).set(auth());
    expect(pv.status).toBe(200);
    expect(pv.headers["content-disposition"]).toContain("inline");
  });

  it("liaison fichier ↔ tâche + by-entity", async () => {
    const link = await agent.post(`/api/v1/files/${fileId}/link`).set(auth()).send({ entityType: "task", entityId: taskId });
    expect(link.status).toBe(201);
    const byEntity = await agent.get("/api/v1/files/by-entity").set(auth()).query({ workspaceId, entityType: "task", entityId: taskId });
    expect(byEntity.body.data.files).toHaveLength(1);
    const unlink = await agent.delete(`/api/v1/files/${fileId}/link/${link.body.data.link._id}`).set(auth());
    expect(unlink.status).toBe(200);
    const empty = await agent.get("/api/v1/files/by-entity").set(auth()).query({ workspaceId, entityType: "task", entityId: taskId });
    expect(empty.body.data.files).toHaveLength(0);
  });

  it("copie fichier + dossier récursif", async () => {
    const copy = await agent.post(`/api/v1/files/${fileId}/copy`).set(auth()).send({});
    expect(copy.status).toBe(201);
    expect(copy.body.data.file.name).toContain("Copie de");
    expect(copy.body.data.file.storageKey).not.toBe(fileId);
    const folderCopy = await agent.post(`/api/v1/folders/${folderId}/copy`).set(auth()).send({ name: "Travail (copie)" });
    expect(folderCopy.status).toBe(201);
    const inCopy = await agent.get("/api/v1/files").set(auth()).query({ workspaceId, folderId: folderCopy.body.data.folder._id });
    expect(inCopy.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("corbeille : soft delete → restauration → suppression définitive", async () => {
    const trash = await agent.delete(`/api/v1/files/${fileId}`).set(auth());
    expect(trash.status).toBe(200);
    const list = await agent.get("/api/v1/files").set(auth()).query({ workspaceId });
    expect(list.body.data.some((f: { _id: string }) => f._id === fileId)).toBe(false);
    const trashed = await agent.get("/api/v1/files").set(auth()).query({ workspaceId, trashed: "true" });
    expect(trashed.body.data.some((f: { _id: string }) => f._id === fileId)).toBe(true);
    const restore = await agent.post(`/api/v1/files/${fileId}/restore`).set(auth());
    expect(restore.body.data.file.status).toBe("ready");
    const perm = await agent.delete(`/api/v1/files/${fileId}/permanent`).set(auth());
    expect(perm.status).toBe(200);
    const gone = await agent.get(`/api/v1/files/${fileId}`).set(auth());
    expect(gone.status).toBe(404);
  });

  it("corbeille dossier récursive", async () => {
    const trash = await agent.delete(`/api/v1/folders/${folderId}`).set(auth());
    expect(trash.status).toBe(200);
    const restore = await agent.post(`/api/v1/folders/${folderId}/restore`).set(auth());
    expect(restore.status).toBe(200);
    const perm = await agent.delete(`/api/v1/folders/${folderId}/permanent`).set(auth());
    expect(perm.status).toBe(200);
  });
});
