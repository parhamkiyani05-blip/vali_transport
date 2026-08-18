import { Router } from 'express';
import { query } from '../lib/db.js';
import { auth, allow } from '../middleware/auth.js';

const router = Router();
router.use(auth);

router.get('/', allow('manager','office'), async (_req, res) => {
  const { rows } = await query(`SELECT * FROM drivers WHERE archived_at IS NULL ORDER BY id DESC`);
  res.json(rows);
});

router.post('/', allow('manager','office'), async (req, res) => {
  const { name, truckNumber, phone, language='fa' } = req.body || {};
  const { rows } = await query(
    `INSERT INTO drivers(name, truck_number, phone, language) VALUES($1,$2,$3,$4) RETURNING *`,
    [name, truckNumber, phone, language]
  );
  res.status(201).json(rows[0]);
});

router.patch('/:id', allow('manager'), async (req, res) => {
  const { name, truckNumber, phone, language } = req.body || {};
  const { rows } = await query(
    `UPDATE drivers SET name=COALESCE($1,name), truck_number=COALESCE($2,truck_number), phone=COALESCE($3,phone), language=COALESCE($4,language), updated_at=NOW() WHERE id=$5 RETURNING *`,
    [name, truckNumber, phone, language, req.params.id]
  );
  res.json(rows[0]);
});

router.delete('/:id', allow('manager'), async (req, res) => {
  await query(`UPDATE drivers SET archived_at=NOW() WHERE id=$1`, [req.params.id]);
  res.status(204).end();
});

export default router;
