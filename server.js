import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { nanoid } from "nanoid";
import path from "node:path";
import { mkdir } from "node:fs/promises";

const app = express();
const PORT = Number(process.env.PORT || 8080);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const DB_PATH = process.env.DB_PATH || path.join(process.env.HOME || process.cwd(), "data", "db.json");

await mkdir(path.dirname(DB_PATH), { recursive: true });

const adapter = new JSONFile(DB_PATH);
const db = new Low(adapter, { users: [] });

await db.read();
db.data ||= { users: [] };
await db.write();

app.use(express.json({ limit: "1mb" }));
app.use(express.static("."));

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
  };
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/signup", async (req, res) => {
  await db.read();
  const name = String(req.body.name || "").trim();
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (!name || !username || password.length < 6) {
    res.status(400).json({ error: "Invalid signup data" });
    return;
  }

  if (db.data.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    res.status(409).json({ error: "Username is already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: nanoid(),
    name,
    username,
    passwordHash,
    activePlan: null,
    archives: [],
  };

  db.data.users.push(user);
  await db.write();

  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "14d" });
  res.status(201).json({ token, user: sanitizeUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  await db.read();
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const user = db.data.users.find((u) => u.username === username);

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "14d" });
  res.json({ token, user: sanitizeUser(user) });
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  await db.read();
  const user = db.data.users.find((u) => u.id === req.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user: sanitizeUser(user) });
});

app.get("/api/plan", authMiddleware, async (req, res) => {
  await db.read();
  const user = db.data.users.find((u) => u.id === req.userId);
  res.json({ activePlan: user?.activePlan || null });
});

app.put("/api/plan", authMiddleware, async (req, res) => {
  await db.read();
  const user = db.data.users.find((u) => u.id === req.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  user.activePlan = req.body.activePlan ?? null;
  user.archives = Array.isArray(req.body.archives) ? req.body.archives : user.archives;
  await db.write();

  res.json({ ok: true });
});

app.get("/api/archives", authMiddleware, async (req, res) => {
  await db.read();
  const user = db.data.users.find((u) => u.id === req.userId);
  res.json({ archives: user?.archives || [] });
});

app.get("*", (req, res) => {
  res.sendFile("index.html", { root: process.cwd() });
});

app.listen(PORT, () => {
  console.log(`No Fail listening on ${PORT}`);
  console.log(`Using DB_PATH=${DB_PATH}`);
});
