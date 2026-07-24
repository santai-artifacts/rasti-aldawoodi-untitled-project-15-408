import Database from "bun:sqlite";
import { mkdirSync } from "fs";

mkdirSync(`${import.meta.dir}/data`, { recursive: true });

const db = new Database(`${import.meta.dir}/data/app.db`);
db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const publicDir = `${import.meta.dir}/public`;

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
};

export default {
  port: process.env.PORT || 3000,
  async fetch(req: Request) {
    const url = new URL(req.url);

    // API routes
    if (url.pathname === "/api/scores") {
      if (req.method === "GET") {
        const scores = db
          .prepare(
            "SELECT name, score FROM scores ORDER BY score DESC LIMIT 10"
          )
          .all();
        return Response.json(scores);
      }

      if (req.method === "POST") {
        const body = await req.json() as { name?: string; score?: number };
        const name = String(body.name ?? "Anonymous").slice(0, 20).trim() || "Anonymous";
        const score = Math.floor(Number(body.score) || 0);
        if (score <= 0) return Response.json({ ok: true });
        db.prepare("INSERT INTO scores (name, score) VALUES (?, ?)").run(
          name,
          score
        );
        return Response.json({ ok: true });
      }
    }

    // Static file serving
    let pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = `${publicDir}${pathname}`;
    const file = Bun.file(filePath);
    if (await file.exists()) {
      const ext = pathname.slice(pathname.lastIndexOf("."));
      return new Response(file, {
        headers: { "Content-Type": MIME[ext] ?? "text/plain" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
