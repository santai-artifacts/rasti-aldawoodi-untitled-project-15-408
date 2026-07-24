import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, 'public');
const dataDir  = join(__dirname, 'data');

mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, 'app.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    score      INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const getScores  = db.prepare('SELECT name, score FROM scores ORDER BY score DESC LIMIT 10');
const insertScore = db.prepare('INSERT INTO scores (name, score) VALUES (?, ?)');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (chunk: Buffer) => { buf += chunk.toString(); });
    req.on('end', () => resolve(buf));
    req.on('error', reject);
  });
}

function sendJSON(res: ServerResponse, data: unknown, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', `http://localhost`);

  try {
    if (url.pathname === '/api/scores') {
      if (req.method === 'GET') {
        return sendJSON(res, getScores.all());
      }
      if (req.method === 'POST') {
        const raw  = await readBody(req);
        const body = JSON.parse(raw) as { name?: unknown; score?: unknown };
        const name  = String(body.name ?? '').trim().slice(0, 20) || 'Anonymous';
        const score = Math.floor(Number(body.score) || 0);
        if (score > 0) insertScore.run(name, score);
        return sendJSON(res, { ok: true });
      }
    }

    // Serve static files
    const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    const safePath = pathname.replace(/\.\./g, '');
    const filePath = join(publicDir, safePath);
    const ext = extname(filePath);

    try {
      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'text/plain' });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end('Internal server error');
  }
});

const PORT = parseInt(process.env.PORT ?? '3000', 10);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Snake server running on http://0.0.0.0:${PORT}`);
});
