import { Router } from 'express';
import { query } from '../lib/db.js';
import { auth, allow } from '../middleware/auth.js';

const router = Router();

router.use(auth, allow('manager'));


// ==========================
// لیست شرکت‌ها
// ==========================
router.get('/', async (_req, res) => {

  const { rows } = await query(`
    SELECT *
    FROM companies
    WHERE archived_at IS NULL
    ORDER BY id DESC
  `);

  res.json(rows);

});


// ==========================
// حساب کامل شرکت
// ==========================
router.get('/:id/account', async (req, res) => {

  const companyId = req.params.id;

  const company = await query(
    `
    SELECT
      id,
      name,
      phone,
      language,
      note
    FROM companies
    WHERE id=$1
    AND archived_at IS NULL
    LIMIT 1
    `,
    [companyId]
  );

  if (!company.rows.length) {
    return res.status(404).json({
      error: 'COMPANY_NOT_FOUND'
    });
  }

  const transactions = await query(
    `
    SELECT
      t.id,
      t.type,
      t.amount,
      t.currency,
      t.description,
      t.occurred_at,
      t.created_at,
      u.full_name AS created_by_name
    FROM transactions t
    LEFT JOIN users u
      ON u.id=t.created_by
    WHERE t.entity_type='company'
    AND t.entity_id=$1
    AND t.archived_at IS NULL
    ORDER BY t.occurred_at DESC, t.id DESC
    `,
    [companyId]
  );

  res.json({
    company: company.rows[0],
    transactions: transactions.rows
  });

});


// ==========================
// ثبت شرکت
// ==========================
router.post('/', async (req, res) => {

  const {
    name,
    phone = '',
    language = 'fa',
    note = ''
  } = req.body || {};

  if (!name?.trim()) {
    return res.status(400).json({
      error: 'COMPANY_NAME_REQUIRED'
    });
  }

  if (!['fa', 'tr'].includes(language)) {
    return res.status(400).json({
      error: 'INVALID_LANGUAGE'
    });
  }

  const { rows } = await query(
    `
    INSERT INTO companies
    (
      name,
      phone,
      language,
      note
    )
    VALUES($1,$2,$3,$4)
    RETURNING *
    `,
    [
      name.trim(),
      phone,
      language,
      note
    ]
  );

  res.status(201).json(rows[0]);

});


// ==========================
// ویرایش شرکت
// ==========================
router.patch('/:id', async (req, res) => {

  const {
    name,
    phone,
    language,
    note
  } = req.body || {};

  if (language && !['fa', 'tr'].includes(language)) {
    return res.status(400).json({
      error: 'INVALID_LANGUAGE'
    });
  }

  const { rows } = await query(
    `
    UPDATE companies
    SET
      name=COALESCE($1,name),
      phone=COALESCE($2,phone),
      language=COALESCE($3,language),
      note=COALESCE($4,note),
      updated_at=NOW()
    WHERE id=$5
    AND archived_at IS NULL
    RETURNING *
    `,
    [
      name?.trim() || null,
      phone,
      language,
      note,
      req.params.id
    ]
  );

  if (!rows.length) {
    return res.status(404).json({
      error: 'COMPANY_NOT_FOUND'
    });
  }

  res.json(rows[0]);

});


// ==========================
// آرشیو شرکت
// ==========================
router.delete('/:id', async (req, res) => {

  const { rows } = await query(
    `
    UPDATE companies
    SET
      archived_at=NOW(),
      updated_at=NOW()
    WHERE id=$1
    AND archived_at IS NULL
    RETURNING id
    `,
    [req.params.id]
  );

  if (!rows.length) {
    return res.status(404).json({
      error: 'COMPANY_NOT_FOUND'
    });
  }

  res.status(204).end();

});


export default router;
