import { Router } from "express";
import { db, projectsTable, prototypesTable, commentsTable, usersTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { generateThumbnail } from "../lib/thumbnail";
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
  UpdateCommentBody,
  UpdateCommentParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// ── Projects ──────────────────────────────────────────────────────────────────

router.post("/projects", requireAuth, async (req, res) => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const ownerId = req.session.userId as string;
  const [project] = await db
    .insert(projectsTable)
    .values({ name: parsed.data.name, ownerId })
    .returning();
  res.status(201).json({
    id: project.id,
    name: project.name,
    createdAt: project.createdAt.toISOString(),
  });
});

router.get("/projects", requireAuth, async (req, res) => {
  const ownerId = req.session.userId as string;
  const rows = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      createdAt: projectsTable.createdAt,
      fileCount: sql<number>`count(${prototypesTable.id})::int`,
    })
    .from(projectsTable)
    .leftJoin(prototypesTable, eq(prototypesTable.projectId, projectsTable.id))
    .where(eq(projectsTable.ownerId, ownerId))
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

router.get("/projects/:id", requireAuth, async (req, res) => {
  const parsed = GetProjectParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const ownerId = req.session.userId as string;
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, parsed.data.id), eq(projectsTable.ownerId, ownerId)))
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
      thumbnail: prototypesTable.thumbnail,
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
      thumbnail: f.thumbnail ?? null,
      createdAt: f.createdAt.toISOString(),
    })),
  });
});

router.delete("/projects/:id", requireAuth, async (req, res) => {
  const parsed = DeleteProjectParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const ownerId = req.session.userId as string;
  const [deleted] = await db
    .delete(projectsTable)
    .where(and(eq(projectsTable.id, parsed.data.id), eq(projectsTable.ownerId, ownerId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json({ success: true });
});

// ── Prototypes ────────────────────────────────────────────────────────────────

router.post("/prototypes", requireAuth, async (req, res) => {
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

  // Fire-and-forget thumbnail generation — does not block the response
  const prototypeId = prototype.id;
  void (async () => {
    try {
      const thumbnail = await generateThumbnail(htmlContent);
      if (thumbnail) {
        await db
          .update(prototypesTable)
          .set({ thumbnail })
          .where(eq(prototypesTable.id, prototypeId));
      } else {
        req.log.warn({ prototypeId }, "thumbnail generation returned null — no browser available or render failed");
      }
    } catch (err) {
      req.log.warn({ prototypeId, err }, "thumbnail generation threw an error");
    }
  })();

  res.status(201).json({
    id: prototype.id,
    htmlContent: prototype.htmlContent,
    fileName: prototype.fileName,
    projectName: prototype.projectName,
    projectId: prototype.projectId ?? "",
    thumbnail: prototype.thumbnail ?? null,
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
      thumbnail: prototypesTable.thumbnail,
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
      thumbnail: p.thumbnail ?? null,
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
    thumbnail: prototype.thumbnail ?? null,
    createdAt: prototype.createdAt.toISOString(),
  });
});

router.delete("/prototypes/:id", requireAuth, async (req, res) => {
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
      authorEmail: c.authorEmail ?? null,
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

  // Resolve author email from session if logged in
  let authorEmail: string | null = null;
  const userId = req.session?.userId as string | undefined;
  if (userId) {
    const [user] = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    authorEmail = user?.email ?? null;
  }

  const [comment] = await db
    .insert(commentsTable)
    .values({ prototypeId: paramsParsed.data.id, x, y, text, authorEmail })
    .returning();
  res.status(201).json({
    id: comment.id,
    prototypeId: comment.prototypeId,
    x: comment.x,
    y: comment.y,
    text: comment.text,
    resolved: comment.resolved,
    authorEmail: comment.authorEmail ?? null,
    createdAt: comment.createdAt.toISOString(),
  });
});

router.patch("/comments/:id/resolve", requireAuth, async (req, res) => {
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
    authorEmail: comment.authorEmail ?? null,
    createdAt: comment.createdAt.toISOString(),
  });
});

router.patch("/comments/:id", requireAuth, async (req, res) => {
  const parsed = UpdateCommentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const bodyParsed = UpdateCommentBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body" });
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
    .set({ text: bodyParsed.data.text })
    .where(eq(commentsTable.id, parsed.data.id))
    .returning();
  res.json({
    id: comment.id,
    prototypeId: comment.prototypeId,
    x: comment.x,
    y: comment.y,
    text: comment.text,
    resolved: comment.resolved,
    authorEmail: comment.authorEmail ?? null,
    createdAt: comment.createdAt.toISOString(),
  });
});

router.delete("/comments/:id", requireAuth, async (req, res) => {
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
