import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { pinoHttp } from 'pino-http';
import { z } from 'zod';
import { pool } from './db.js';
import { requireAuth, signToken, type AuthRequest } from './auth.js';
import { config } from './config.js';
export const app = express();
app.disable('x-powered-by');
app.use(pinoHttp());
app.use(cors({ origin: config.CLIENT_ORIGIN }));
app.use(express.json({ limit: '100kb' }));
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      database: 'ok',
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'unavailable' });
  }
});
const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
const registerSchema = credentials.extend({ name: z.string().min(2).max(100) });
app.post('/api/auth/register', async (req, res, next) => {
  try {
    const d = registerSchema.parse(req.body);
    const hash = await bcrypt.hash(d.password, 12);
    const q = await pool.query(
      'INSERT INTO users(name,email,password_hash) VALUES($1,lower($2),$3) RETURNING id,name,email',
      [d.name, d.email, hash],
    );
    res.status(201).json({ user: q.rows[0], token: signToken(q.rows[0].id) });
  } catch (e) {
    next(e);
  }
});
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const d = credentials.parse(req.body);
    const q = await pool.query(
      'SELECT id,name,email,password_hash FROM users WHERE email=lower($1)',
      [d.email],
    );
    const u = q.rows[0];
    if (!u || !(await bcrypt.compare(d.password, u.password_hash)))
      return res.status(401).json({ error: 'Invalid email or password' });
    delete u.password_hash;
    res.json({ user: u, token: signToken(u.id) });
  } catch (e) {
    next(e);
  }
});
app.use('/api', requireAuth);
app.get('/api/projects', async (req: AuthRequest, res, next) => {
  try {
    const q = await pool.query(
      `SELECT p.*,count(t.id)::int task_count,count(t.id) FILTER(WHERE t.status='done')::int done_count FROM projects p LEFT JOIN tasks t ON t.project_id=p.id WHERE p.owner_id=$1 GROUP BY p.id ORDER BY p.created_at DESC`,
      [req.userId],
    );
    res.json(q.rows);
  } catch (e) {
    next(e);
  }
});
app.post('/api/projects', async (req: AuthRequest, res, next) => {
  try {
    const d = z
      .object({
        name: z.string().min(1).max(120),
        description: z.string().max(1000).default(''),
      })
      .parse(req.body);
    const q = await pool.query(
      'INSERT INTO projects(owner_id,name,description) VALUES($1,$2,$3) RETURNING *',
      [req.userId, d.name, d.description],
    );
    res.status(201).json(q.rows[0]);
  } catch (e) {
    next(e);
  }
});
app.delete('/api/projects/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = z.guid().parse(req.params.id);
    const q = await pool.query(
      'DELETE FROM projects WHERE id=$1 AND owner_id=$2',
      [id, req.userId],
    );
    if (!q.rowCount)
      return res.status(404).json({ error: 'Project not found' });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
app.get('/api/projects/:id/tasks', async (req: AuthRequest, res, next) => {
  try {
    const q = await pool.query(
      'SELECT t.* FROM tasks t JOIN projects p ON p.id=t.project_id WHERE p.id=$1 AND p.owner_id=$2 ORDER BY t.created_at DESC',
      [req.params.id, req.userId],
    );
    res.json(q.rows);
  } catch (e) {
    next(e);
  }
});
const taskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  status: z.enum(['todo', 'in_progress', 'done']).default('todo'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.string().nullable().optional(),
});
app.post('/api/projects/:id/tasks', async (req: AuthRequest, res, next) => {
  try {
    const d = taskSchema.parse(req.body);
    const q = await pool.query(
      `INSERT INTO tasks(project_id,title,description,status,priority,due_date) SELECT id,$3,$4,$5,$6,$7 FROM projects WHERE id=$1 AND owner_id=$2 RETURNING *`,
      [
        req.params.id,
        req.userId,
        d.title,
        d.description,
        d.status,
        d.priority,
        d.dueDate ?? null,
      ],
    );
    if (!q.rowCount)
      return res.status(404).json({ error: 'Project not found' });
    res.status(201).json(q.rows[0]);
  } catch (e) {
    next(e);
  }
});
const taskUpdateSchema = taskSchema.extend({
  description: z.string().max(2000),
  status: z.enum(['todo', 'in_progress', 'done']),
  priority: z.enum(['low', 'medium', 'high']),
}).partial();
app.patch('/api/tasks/:id', async (req: AuthRequest, res, next) => {
  try {
    const d = taskUpdateSchema.parse(req.body);
    const current = await pool.query(
      'SELECT t.* FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.id=$1 AND p.owner_id=$2',
      [req.params.id, req.userId],
    );
    if (!current.rowCount)
      return res.status(404).json({ error: 'Task not found' });
    const v = {
      ...current.rows[0],
      ...d,
      due_date: d.dueDate ?? current.rows[0].due_date,
    };
    const q = await pool.query(
      'UPDATE tasks SET title=$2,description=$3,status=$4,priority=$5,due_date=$6,updated_at=now() WHERE id=$1 RETURNING *',
      [req.params.id, v.title, v.description, v.status, v.priority, v.due_date],
    );
    res.json(q.rows[0]);
  } catch (e) {
    next(e);
  }
});
app.delete('/api/tasks/:id', async (req: AuthRequest, res, next) => {
  try {
    const q = await pool.query(
      'DELETE FROM tasks t USING projects p WHERE t.id=$1 AND t.project_id=p.id AND p.owner_id=$2',
      [req.params.id, req.userId],
    );
    if (!q.rowCount) return res.status(404).json({ error: 'Task not found' });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
app.get('/api/dashboard', async (req: AuthRequest, res, next) => {
  try {
    const q = await pool.query(
      `SELECT count(DISTINCT p.id)::int projects,count(t.id)::int tasks,count(t.id) FILTER(WHERE t.status='todo')::int todo,count(t.id) FILTER(WHERE t.status='in_progress')::int in_progress,count(t.id) FILTER(WHERE t.status='done')::int done FROM projects p LEFT JOIN tasks t ON t.project_id=p.id WHERE p.owner_id=$1`,
      [req.userId],
    );
    res.json(q.rows[0]);
  } catch (e) {
    next(e);
  }
});
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    void _next;
    if (err instanceof z.ZodError)
      return res
        .status(400)
        .json({ error: 'Validation failed', details: err.issues });
    if ((err as { code?: string }).code === '23505')
      return res.status(409).json({ error: 'Email already registered' });
    res.status(500).json({ error: 'Internal server error' });
  },
);
