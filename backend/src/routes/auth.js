import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../lib/db.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'MISSING_CREDENTIALS' });
  const { rows } = await query(
    `SELECT id, username, full_name, role, password_hash, active FROM users WHERE username=$1 LIMIT 1`,
    [username.trim().toLowerCase()]
  );
  const user = rows[0];
  if (!user || !user.active || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  }
  const token = jwt.sign({ id: user.id, role: user.role, name: user.full_name }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role } });
});

router.get('/me', auth, async (req, res) => {
  const { rows } = await query('SELECT id, username, full_name, role, active FROM users WHERE id=$1', [req.user.id]);
  res.json(rows[0] || null);
});

export default router;
