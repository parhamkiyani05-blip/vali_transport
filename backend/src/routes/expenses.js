import { Router } from 'express';
import { query } from '../lib/db.js';
import { auth, allow } from '../middleware/auth.js';

const router = Router();
router.use(auth);

router.get('/', allow('manager','office'), async (_req, res) => {
  const { rows } = await query(`SELECT e.*,u.full_name AS created_by_name,a.full_name AS approved_by_name FROM expenses e LEFT JOIN users u ON u.id=e.created_by LEFT JOIN users a ON a.id=e.approved_by WHERE e.archived_at IS NULL ORDER BY e.created_at DESC`);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { title, amount, currency, note='' } = req.body || {};
  if (!['USD','TOMAN'].includes(currency)) return res.status(400).json({error:'INVALID_CURRENCY'});
  const { rows } = await query(`INSERT INTO expenses(title,amount,currency,note,created_by,status) VALUES($1,$2,$3,$4,$5,'pending') RETURNING *`, [title,amount,currency,note,req.user.id]);
  res.status(201).json(rows[0]);
});

router.post('/:id/decision', allow('manager','office'), async (req, res) => {
  const { decision } = req.body || {};
  if (!['approved','rejected'].includes(decision)) return res.status(400).json({error:'INVALID_DECISION'});
  const { rows } = await query(`UPDATE expenses SET status=$1, approved_by=$2, approved_at=NOW(), updated_at=NOW() WHERE id=$3 RETURNING *`, [decision,req.user.id,req.params.id]);
  res.json(rows[0]);
});

router.patch('/:id', allow('manager'), async (req, res) => {
  const { title, amount, currency, note, status } = req.body || {};
  const { rows } = await query(`UPDATE expenses SET title=COALESCE($1,title), amount=COALESCE($2,amount), currency=COALESCE($3,currency), note=COALESCE($4,note), status=COALESCE($5,status), updated_at=NOW() WHERE id=$6 RETURNING *`, [title,amount,currency,note,status,req.params.id]);
  res.json(rows[0]);
});

router.delete('/:id', allow('manager'), async (req, res) => {
  await query(`UPDATE expenses SET archived_at=NOW(), updated_at=NOW() WHERE id=$1`, [req.params.id]);
  res.status(204).end();
});

export default router;
