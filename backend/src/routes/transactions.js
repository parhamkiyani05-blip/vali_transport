import { Router } from 'express';
import { query } from '../lib/db.js';
import { auth, allow } from '../middleware/auth.js';

const router = Router();
router.use(auth, allow('manager','office'));

router.get('/', async (req, res) => {
  const { entityType, entityId } = req.query;
  const { rows } = await query(`SELECT t.*,u.full_name AS created_by_name FROM transactions t LEFT JOIN users u ON u.id=t.created_by WHERE t.archived_at IS NULL AND ($1::text IS NULL OR t.entity_type=$1) AND ($2::bigint IS NULL OR t.entity_id=$2) ORDER BY t.occurred_at DESC,t.id DESC`, [entityType || null, entityId || null]);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { entityType, entityId, type, amount, currency, description='', occurredAt } = req.body || {};
  if (!['driver','company'].includes(entityType) || !['payment','receipt','debt'].includes(type) || !['USD','TOMAN'].includes(currency)) return res.status(400).json({error:'INVALID_TRANSACTION'});
  if (entityType === 'company' && req.user.role !== 'manager') return res.status(403).json({error:'COMPANY_ACCOUNTS_MANAGER_ONLY'});
  const { rows } = await query(`INSERT INTO transactions(entity_type,entity_id,type,amount,currency,description,occurred_at,created_by) VALUES($1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz,NOW()),$8) RETURNING *`, [entityType,entityId,type,amount,currency,description,occurredAt || null,req.user.id]);
  res.status(201).json(rows[0]);
});

router.patch('/:id', allow('manager'), async (req, res) => {
  const { type, amount, currency, description, occurredAt } = req.body || {};
  const { rows } = await query(`UPDATE transactions SET type=COALESCE($1,type), amount=COALESCE($2,amount), currency=COALESCE($3,currency), description=COALESCE($4,description), occurred_at=COALESCE($5::timestamptz,occurred_at), updated_at=NOW() WHERE id=$6 RETURNING *`, [type,amount,currency,description,occurredAt || null,req.params.id]);
  res.json(rows[0]);
});

router.delete('/:id', allow('manager'), async (req, res) => {
  await query(`UPDATE transactions SET archived_at=NOW(), updated_at=NOW() WHERE id=$1`, [req.params.id]);
  res.status(204).end();
});

export default router;
