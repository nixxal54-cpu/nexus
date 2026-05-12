import { Express } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { GoogleGenAI } from "@google/genai";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "nexus-super-secret-key";

function getAI() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
}

function cosineSimilarity(A: number[], B: number[]) {
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < A.length; i++) {
    dotProduct += A[i] * B[i];
    normA += A[i] * A[i];
    normB += B[i] * B[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

const authenticate = (req: any, res: any, next: any) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

export function setupApiRoutes(app: Express) {

  // ── AUTH ─────────────────────────────────────────────────────────────────

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password || !name)
        return res.status(400).json({ error: "All fields required" });
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return res.status(400).json({ error: "Email already registered" });
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({ data: { email, passwordHash: hashedPassword, name } });
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
      res.cookie("token", token, { httpOnly: true });
      res.json({ id: user.id, name: user.name, email: user.email });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return res.status(400).json({ error: "User not found" });
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) return res.status(400).json({ error: "Invalid password" });
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
      res.cookie("token", token, { httpOnly: true });
      res.json({ id: user.id, name: user.name, email: user.email });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
  });

  app.get("/api/auth/me", authenticate, async (req: any, res: any) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json({ id: user.id, name: user.name, email: user.email });
  });

  // ── MEMORIES ─────────────────────────────────────────────────────────────

  app.post("/api/memories", authenticate, async (req: any, res: any) => {
    try {
      const { content, type } = req.body;
      if (!content?.trim()) return res.status(400).json({ error: "Content required" });

      const ai = getAI();

      // 1. Embed — FIXED model name
      const embedResponse = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: content,
      });
      const newEmbedding: number[] = embedResponse.embeddings[0].values;

      // 2. Find similar past memories
      const userMemories = await prisma.memory.findMany({ where: { userId: req.userId } });
      const scored = userMemories
        .map((m: any) => ({ ...m, score: cosineSimilarity(newEmbedding, JSON.parse(m.embedding)) }))
        .sort((a: any, b: any) => b.score - a.score);
      const topMemories = scored.slice(0, 5);
      const topMemoriesText = topMemories
        .map((m: any) => `[${new Date(m.createdAt).toLocaleDateString()}] ${m.content}`)
        .join("\n");

      // 3. AI processing — FIXED model name, FIXED require() → import at top
      const prompt = `You are Nexus, the user's AI second brain.
New memory: ${content}

Related past memories:
${topMemoriesText || "None yet."}

Tasks:
1. Write a 1-sentence summary of this new memory.
2. Extract 3-5 short tags.
3. Detect mood: focused, anxious, excited, sad, motivated, confused, or neutral.
4. If any related memory is meaningfully connected, write a 1-sentence connection insight. Otherwise return empty string.
5. Detect memory type if not given: JOURNAL, GOAL, IDEA, TASK, EMOTION, LEARNING, HABIT.

Return valid JSON only — no markdown backticks:
{"summary":"...","tags":["..."],"mood":"...","connectionInsight":"...","detectedType":"..."}`;

      const geminiRes = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });

      let data: any = {};
      try {
        data = JSON.parse(geminiRes.text.trim());
      } catch {
        data = { summary: content.slice(0, 100), tags: [], mood: "neutral", connectionInsight: "", detectedType: "JOURNAL" };
      }

      const finalType = type || data.detectedType || "JOURNAL";
      const linkedIds = topMemories.filter((m: any) => m.score > 0.75).map((m: any) => m.id);

      const memory = await prisma.memory.create({
        data: {
          userId: req.userId,
          content,
          summary: data.summary || "",
          embedding: JSON.stringify(newEmbedding),
          tags: JSON.stringify(data.tags || []),
          mood: data.mood || "neutral",
          type: finalType,
          linkedIds: JSON.stringify(linkedIds),
        },
      });

      let insight = null;
      if (data.connectionInsight && data.connectionInsight.length > 10) {
        insight = await prisma.insight.create({
          data: {
            userId: req.userId,
            content: data.connectionInsight,
            type: "connection",
            memoryIds: JSON.stringify([memory.id, ...topMemories.slice(0, 2).map((m: any) => m.id)]),
          },
        });
      }

      res.json({ ...memory, tags: data.tags || [], linkedIds, embedding: undefined, insight });
    } catch (error: any) {
      console.error("POST /api/memories:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/memories", authenticate, async (req: any, res: any) => {
    try {
      const { type } = req.query;
      const memories = await prisma.memory.findMany({
        where: { userId: req.userId, ...(type ? { type: String(type) } : {}) },
        orderBy: { createdAt: "desc" },
      });
      res.json(memories.map((m: any) => ({
        ...m, tags: JSON.parse(m.tags), linkedIds: JSON.parse(m.linkedIds), embedding: undefined,
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ADDED: semantic search — was completely missing
  app.get("/api/memories/search", authenticate, async (req: any, res: any) => {
    try {
      const { q } = req.query;
      if (!q) return res.json([]);
      const ai = getAI();
      const embedResponse = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: String(q),
      });
      const queryEmbedding: number[] = embedResponse.embeddings[0].values;
      const userMemories = await prisma.memory.findMany({ where: { userId: req.userId } });
      const results = userMemories
        .map((m: any) => ({ ...m, score: cosineSimilarity(queryEmbedding, JSON.parse(m.embedding)) }))
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 10);
      res.json(results.map((m: any) => ({
        ...m, tags: JSON.parse(m.tags), linkedIds: JSON.parse(m.linkedIds), embedding: undefined,
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/memories/:id", authenticate, async (req: any, res: any) => {
    try {
      const memory = await prisma.memory.findUnique({ where: { id: req.params.id } });
      if (!memory) return res.status(404).json({ error: "Memory not found" });
      if (memory.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
      await prisma.memory.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── INSIGHTS ─────────────────────────────────────────────────────────────

  app.get("/api/insights", authenticate, async (req: any, res: any) => {
    try {
      const insights = await prisma.insight.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: "desc" },
      });
      res.json(insights.map((i: any) => ({ ...i, memoryIds: JSON.parse(i.memoryIds) })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ADDED: mark insight as seen — was missing, unseen badge couldn't work
  app.patch("/api/insights/:id/seen", authenticate, async (req: any, res: any) => {
    try {
      const insight = await prisma.insight.findUnique({ where: { id: req.params.id } });
      if (!insight || insight.userId !== req.userId) return res.status(404).json({ error: "Not found" });
      const updated = await prisma.insight.update({
        where: { id: req.params.id },
        data: { seenAt: new Date() },
      });
      res.json({ ...updated, memoryIds: JSON.parse(updated.memoryIds) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── STATS ─────────────────────────────────────────────────────────────────

  app.get("/api/stats", authenticate, async (req: any, res: any) => {
    try {
      const count = await prisma.memory.count({ where: { userId: req.userId } });
      const insightCount = await prisma.insight.count({ where: { userId: req.userId } });
      const unseenInsights = await prisma.insight.count({ where: { userId: req.userId, seenAt: null } });

      const memoryDates = await prisma.memory.findMany({
        where: { userId: req.userId },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
      });

      let streak = 0;
      if (memoryDates.length > 0) {
        let currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);
        let lastDate = new Date(memoryDates[0].createdAt);
        lastDate.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 1) {
          streak = 1;
          let checkDate = new Date(lastDate);
          for (let i = 1; i < memoryDates.length; i++) {
            const d = new Date(memoryDates[i].createdAt);
            d.setHours(0, 0, 0, 0);
            if (d.getTime() === checkDate.getTime()) continue;
            const expectedPrev = new Date(checkDate);
            expectedPrev.setDate(expectedPrev.getDate() - 1);
            if (d.getTime() === expectedPrev.getTime()) { streak++; checkDate = expectedPrev; }
            else break;
          }
        }
      }

      res.json({ memoryCount: count, streak, insightCount, unseenInsights });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── BRIEFING ─────────────────────────────────────────────────────────────

  app.get("/api/briefing/today", authenticate, async (req: any, res: any) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let briefing = await prisma.briefing.findFirst({
        where: { userId: req.userId, date: { gte: today } },
      });

      if (!briefing) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentMemories = await prisma.memory.findMany({
          where: { userId: req.userId, createdAt: { gte: sevenDaysAgo } },
          orderBy: { createdAt: "desc" },
        });
        const recentInsights = await prisma.insight.findMany({
          where: { userId: req.userId, createdAt: { gte: sevenDaysAgo } },
        });
        const user = await prisma.user.findUnique({ where: { id: req.userId } });

        // Don't generate briefing if no memories yet
        if (recentMemories.length === 0) return res.json(null);

        const ai = getAI();
        const prompt = `Generate a personalized morning briefing for ${user?.name}.

Recent memories (last 7 days):
${recentMemories.map((m: any) => `[${new Date(m.createdAt).toLocaleDateString()}] (${m.type}) ${m.content}`).join("\n")}

Recent insights:
${recentInsights.map((i: any) => i.content).join("\n") || "None yet."}

Today: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

Write the briefing in markdown with these sections:
1. Personal good morning greeting referencing something specific from recent memories
2. **Today's Focus** — 3 priorities based on their patterns and goals
3. **Pattern Noticed** — 1 observation about this week
4. **Honest Take** — 1 direct challenging observation
5. **Closer** — 1 motivational sentence tied to their specific journey

Tone: brilliant, honest friend. Direct and personal, never generic.`;

        // FIXED: correct model name
        const geminiRes = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: prompt,
        });
        briefing = await prisma.briefing.create({
          data: { userId: req.userId, content: geminiRes.text, date: new Date() },
        });
      }

      res.json(briefing);
    } catch (error: any) {
      console.error("GET /api/briefing/today:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── CHAT ─────────────────────────────────────────────────────────────────

  app.get("/api/chat/threads", authenticate, async (req: any, res: any) => {
    try {
      const threads = await prisma.thread.findMany({
        where: { userId: req.userId },
        orderBy: { updatedAt: "desc" },
      });
      res.json(threads.map((t: any) => ({ ...t, messages: JSON.parse(t.messages) })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ADDED: GET single thread — was missing, chat page was fetching all threads just to find one
  app.get("/api/chat/threads/:id", authenticate, async (req: any, res: any) => {
    try {
      const thread = await prisma.thread.findUnique({ where: { id: req.params.id } });
      if (!thread || thread.userId !== req.userId) return res.status(404).json({ error: "Not found" });
      res.json({ ...thread, messages: JSON.parse(thread.messages) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/chat/threads", authenticate, async (req: any, res: any) => {
    try {
      const thread = await prisma.thread.create({
        data: { userId: req.userId, title: "New Conversation", messages: JSON.stringify([]) },
      });
      res.json({ ...thread, messages: [] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/chat/threads/:id/message", authenticate, async (req: any, res: any) => {
    try {
      const { message } = req.body;
      if (!message?.trim()) return res.status(400).json({ error: "Message required" });

      const thread = await prisma.thread.findUnique({ where: { id: req.params.id } });
      if (!thread || thread.userId !== req.userId) return res.status(404).json({ error: "Not found" });

      const ai = getAI();

      // RAG: embed + retrieve relevant memories
      const embedResponse = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: message,
      });
      const queryEmbedding: number[] = embedResponse.embeddings[0].values;
      const userMemories = await prisma.memory.findMany({ where: { userId: req.userId } });
      const scored = userMemories
        .map((m: any) => ({ ...m, score: cosineSimilarity(queryEmbedding, JSON.parse(m.embedding)) }))
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 10);

      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      const messages = JSON.parse(thread.messages);
      messages.push({ role: "user", content: message });

      const systemPrompt = `You are Nexus, ${user?.name}'s personal AI second brain. You have deep knowledge of their memories, thoughts, goals, and patterns. Speak to them personally — never generically.

Their most relevant memories:
${scored.map((m: any) => `[${new Date(m.createdAt).toLocaleDateString()}] (${m.type}, ${m.mood}) ${m.content}`).join("\n") || "No memories yet."}

Rules: reference specific memories when relevant. Be honest and direct. You are their second brain, not a generic chatbot.`;

      // FIXED: correct model name
      const genRes = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "model", parts: [{ text: "Understood. Ready." }] },
          ...messages.map((m: any) => ({
            role: m.role === "model" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
        ],
      });

      const aiMessage = { role: "model", content: genRes.text, memoryIds: scored.map((m: any) => m.id) };
      messages.push(aiMessage);

      let title = thread.title;
      if (messages.length === 2) {
        try {
          const titleRes = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: `Generate a 3-4 word title for a conversation starting with: "${message}". Return only the title, no quotes.`,
          });
          title = titleRes.text.replace(/['"]/g, "").trim();
        } catch {}
      }

      await prisma.thread.update({
        where: { id: thread.id },
        data: { messages: JSON.stringify(messages), title, updatedAt: new Date() },
      });

      res.json(aiMessage);
    } catch (err: any) {
      console.error("POST /api/chat/threads/:id/message:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GOALS ─────────────────────────────────────────────────────────────────

  // ADDED: goal status update — button on Goals page was completely dead
  app.patch("/api/goals/:id/status", authenticate, async (req: any, res: any) => {
    try {
      const { status } = req.body; // "ACTIVE" | "COMPLETED" | "ABANDONED"
      const memory = await prisma.memory.findUnique({ where: { id: req.params.id } });
      if (!memory || memory.userId !== req.userId) return res.status(404).json({ error: "Not found" });
      if (memory.type !== "GOAL") return res.status(400).json({ error: "Not a goal" });
      const baseSum = (memory.summary || "").replace(/^STATUS:[^|]+\|/, "");
      const updated = await prisma.memory.update({
        where: { id: req.params.id },
        data: { summary: `STATUS:${status}|${baseSum}` },
      });
      res.json({ ...updated, tags: JSON.parse(updated.tags), linkedIds: JSON.parse(updated.linkedIds), embedding: undefined });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
