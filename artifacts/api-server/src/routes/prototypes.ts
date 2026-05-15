import { Router } from "express";
import { db, prototypesTable, commentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreatePrototypeBody,
  GetPrototypeParams,
  GetCommentsParams,
  CreateCommentParams,
  CreateCommentBody,
  ResolveCommentParams,
} from "@workspace/api-zod";

const router = Router();

router.post("/prototypes", async (req, res) => {
  const parsed = CreatePrototypeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { htmlContent, fileName } = parsed.data;
  const [prototype] = await db
    .insert(prototypesTable)
    .values({ htmlContent, fileName })
    .returning();
  res.status(201).json({
    id: prototype.id,
    htmlContent: prototype.htmlContent,
    fileName: prototype.fileName,
    createdAt: prototype.createdAt.toISOString(),
  });
});

router.get("/prototypes", async (req, res) => {
  const prototypes = await db
    .select({
      id: prototypesTable.id,
      fileName: prototypesTable.fileName,
      createdAt: prototypesTable.createdAt,
    })
    .from(prototypesTable)
    .orderBy(prototypesTable.createdAt)
    .limit(20);
  res.json(
    prototypes.map((p) => ({
      id: p.id,
      fileName: p.fileName,
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
    createdAt: prototype.createdAt.toISOString(),
  });
});

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
  const parsed = ResolveCommentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const [comment] = await db
    .update(commentsTable)
    .set({ resolved: true })
    .where(eq(commentsTable.id, parsed.data.id))
    .returning();
  if (!comment) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }
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

export default router;
