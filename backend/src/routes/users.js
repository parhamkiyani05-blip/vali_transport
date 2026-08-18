import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../lib/db.js';
import { auth, allow } from '../middleware/auth.js';

const router = Router();
router.use(auth, allow('manager'));

router.get('/', async (_req,res) => {
  const { rows } = await query(`SELECT id,username,full_name,role,active,created_at FROM users WHERE archived_at IS NULL ORDER BY id`);
  res.json(rows);
});

router.post('/', async (req,res) => {
  const { username, fullName, role, password } = req.body || {};
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await query(`INSERT INTO users(username,full_name,role,password_hash) VALUES($1,$2,$3,$4) RETURNING id,username,full_name,role,active`, [username.trim().toLowerCase(),fullName,role,hash]);
  res.status(201).json(rows[0]);
});

router.patch('/:id', async (req,res) => {
  const { username, fullName, role, active, password } = req.body || {};
  const hash = password ? await bcrypt.hash(password,12) : null;
  const { rows } = await query(`UPDATE users SET username=COALESCE($1,username), full_name=COALESCE($2,full_name), role=COALESCE($3,role), active=COALESCE($4,active), password_hash=COALESCE($5,password_hash), updated_at=NOW() WHERE id=$6 RETURNING id,username,full_name,role,active`, [username?.trim().toLowerCase() || null,fullName,role,typeof active==='boolean'?active:null,hash,req.params.id]);
  res.json(rows[0]);
});

router.delete('/:id', async (req,res) => {
  if (String(req.user.id) === String(req.params.id)) return res.status(400).json({error:'CANNOT_ARCHIVE_SELF'});
  await query(`UPDATE users SET archived_at=NOW(),active=false,updated_at=NOW() WHERE id=$1`, [req.params.id]);
  res.status(204).end();
});

export default router;
