import { Router } from "express";
import { db, projectsTable, prototypesTable, commentsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  CreateProjectBody,
  GetProjectParams,
  DeleteProjectParams,
  CreatePrototypeBody,
  GetPrototypeParams,
  DeletePrototypeParams,
  GetCommentsParams,
  CreateCommentParams,
  CreateCommentBody,
  ToggleCommentResolvedParams,
  DeleteCommentParams,
} from "@workspace/api-zod";

const router = Router();

// ── Projects ──────────────────────────────────────────────────────────────────

router.post("/projects", async (req, res) => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [project] = await db
    .insert(projectsTable)
    .values({ name: parsed.data.name })
    .returning();
  res.status(201).json({
    id: project.id,
    name: project.name,
    createdAt: project.createdAt.toISOString(),
  });
});

router.get("/projects", async (req, res) => {
  const rows = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      createdAt: projectsTable.createdAt,
      fileCount: sql<number>`count(${prototypesTable.id})::int`,
    })
    .from(projectsTable)
    .leftJoin(prototypesTable, eq(prototypesTable.projectId, projectsTable.id))
    .groupBy(projectsTable.id)
    .orderBy(projectsTable.createdAt);
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      fileCount: r.fileCount,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

router.get("/projects/:id", async (req, res) => {
  const parsed = GetProjectParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, parsed.data.id))
    .limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const files = await db
    .select({
      id: prototypesTable.id,
      fileName: prototypesTable.fileName,
      projectName: prototypesTable.projectName,
      projectId: prototypesTable.projectId,
      createdAt: prototypesTable.createdAt,
    })
    .from(prototypesTable)
    .where(eq(prototypesTable.projectId, parsed.data.id))
    .orderBy(prototypesTable.createdAt);
  res.json({
    id: project.id,
    name: project.name,
    createdAt: project.createdAt.toISOString(),
    prototypes: files.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      projectName: f.projectName,
      projectId: f.projectId ?? "",
      createdAt: f.createdAt.toISOString(),
    })),
  });
});

router.delete("/projects/:id", async (req, res) => {
  const parsed = DeleteProjectParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const [deleted] = await db
    .delete(projectsTable)
    .where(eq(projectsTable.id, parsed.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json({ success: true });
});

// ── Prototypes ────────────────────────────────────────────────────────────────

router.post("/prototypes", async (req, res) => {
  const parsed = CreatePrototypeBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ issues: parsed.error.issues, body: Object.keys(req.body ?? {}) }, "createPrototype validation failed");
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }
  const { htmlContent, fileName, projectId } = parsed.data;
  // Resolve project name for denormalised field
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .limit(1);
  const projectName = project?.name ?? "";

  const [prototype] = await db
    .insert(prototypesTable)
    .values({ htmlContent, fileName, projectId, projectName })
    .returning();
  res.status(201).json({
    id: prototype.id,
    htmlContent: prototype.htmlContent,
    fileName: prototype.fileName,
    projectName: prototype.projectName,
    projectId: prototype.projectId ?? "",
    createdAt: prototype.createdAt.toISOString(),
  });
});

router.get("/prototypes", async (req, res) => {
  const rows = await db
    .select({
      id: prototypesTable.id,
      fileName: prototypesTable.fileName,
      projectName: prototypesTable.projectName,
      projectId: prototypesTable.projectId,
      createdAt: prototypesTable.createdAt,
    })
    .from(prototypesTable)
    .orderBy(prototypesTable.createdAt)
    .limit(50);
  res.json(
    rows.map((p) => ({
      id: p.id,
      fileName: p.fileName,
      projectName: p.projectName,
      projectId: p.projectId ?? "",
      createdAt: p.createdAt.toISOString(),
    }))
  );
});

router.get("/prototypes/:id", async (req, res) => {
  const parsed = GetPrototypeParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const [prototype] = await db
    .select()
    .from(prototypesTable)
    .where(eq(prototypesTable.id, parsed.data.id))
    .limit(1);
  if (!prototype) {
    res.status(404).json({ error: "Prototype not found" });
    return;
  }
  res.json({
    id: prototype.id,
    htmlContent: prototype.htmlContent,
    fileName: prototype.fileName,
    projectName: prototype.projectName,
    projectId: prototype.projectId ?? "",
    createdAt: prototype.createdAt.toISOString(),
  });
});

router.delete("/prototypes/:id", async (req, res) => {
  const parsed = DeletePrototypeParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const [deleted] = await db
    .delete(prototypesTable)
    .where(eq(prototypesTable.id, parsed.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Prototype not found" });
    return;
  }
  res.json({ success: true });
});

// ── Comments ──────────────────────────────────────────────────────────────────

router.get("/prototypes/:id/comments", async (req, res) => {
  const parsed = GetCommentsParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const comments = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.prototypeId, parsed.data.id))
    .orderBy(commentsTable.createdAt);
  res.json(
    comments.map((c) => ({
      id: c.id,
      prototypeId: c.prototypeId,
      x: c.x,
      y: c.y,
      text: c.text,
      resolved: c.resolved,
      createdAt: c.createdAt.toISOString(),
    }))
  );
});

router.post("/prototypes/:id/comments", async (req, res) => {
  const paramsParsed = CreateCommentParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const bodyParsed = CreateCommentBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { x, y, text } = bodyParsed.data;
  const [comment] = await db
    .insert(commentsTable)
    .values({ prototypeId: paramsParsed.data.id, x, y, text })
    .returning();
  res.status(201).json({
    id: comment.id,
    prototypeId: comment.prototypeId,
    x: comment.x,
    y: comment.y,
    text: comment.text,
    resolved: comment.resolved,
    createdAt: comment.createdAt.toISOString(),
  });
});

router.patch("/comments/:id/resolve", async (req, res) => {
  const parsed = ToggleCommentResolvedParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const [existing] = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.id, parsed.data.id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }
  const [comment] = await db
    .update(commentsTable)
    .set({ resolved: !existing.resolved })
    .where(eq(commentsTable.id, parsed.data.id))
    .returning();
  res.json({
    id: comment.id,
    prototypeId: comment.prototypeId,
    x: comment.x,
    y: comment.y,
    text: comment.text,
    resolved: comment.resolved,
    createdAt: comment.createdAt.toISOString(),
  });
});

router.delete("/comments/:id", async (req, res) => {
  const parsed = DeleteCommentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const [deleted] = await db
    .delete(commentsTable)
    .where(eq(commentsTable.id, parsed.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }
  res.json({ success: true });
});

export default router;
