import { Router } from 'express';
import { query } from '../lib/db.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.use(auth);


// ========================================
// ساخت خلاصه خالی
// ========================================
function emptySummary() {
  return {
    USD: {
      receipt: 0,
      payment: 0,
      expense: 0,
      debt: 0,
      balance: 0
    },
    TOMAN: {
      receipt: 0,
      payment: 0,
      expense: 0,
      debt: 0,
      balance: 0
    }
  };
}


// ========================================
// گزارش مالی
// GET /api/reports/financial
//
// Query:
// from=2026-08-01
// to=2026-08-31
// entityType=driver | company | all
// ========================================
router.get('/financial', async (req, res) => {

  const role = req.user.role;

  let {
    from,
    to,
    entityType = 'driver'
  } = req.query;


  // ----------------------------------------
  // کنترل نوع گزارش
  // ----------------------------------------
  if (!['driver', 'company', 'all'].includes(entityType)) {
    return res.status(400).json({
      error: 'INVALID_ENTITY_TYPE'
    });
  }


  // دفتردار فقط گزارش راننده‌ها
  if (
    role === 'office' &&
    entityType !== 'driver'
  ) {
    return res.status(403).json({
      error: 'REPORT_ACCESS_DENIED'
    });
  }


  // کارمند گزارش مالی ندارد
  if (role === 'employee') {
    return res.status(403).json({
      error: 'REPORT_ACCESS_DENIED'
    });
  }


  // ----------------------------------------
  // تاریخ‌ها
  // ----------------------------------------
  const fromDate = from
    ? `${from}T00:00:00`
    : null;

  const toDate = to
    ? `${to}T23:59:59`
    : null;


  // ========================================
  // تراکنش‌ها
  // ========================================
  const transactions = await query(
    `
    SELECT
      t.id,
      t.entity_type,
      t.entity_id,
      t.type,
      t.amount,
      t.currency,
      t.description,
      t.occurred_at,

      CASE
        WHEN t.entity_type='driver'
          THEN d.name
        WHEN t.entity_type='company'
          THEN c.name
        ELSE ''
      END AS entity_name,

      d.truck_number AS plate,

      u.full_name AS created_by_name

    FROM transactions t

    LEFT JOIN drivers d
      ON t.entity_type='driver'
      AND d.id=t.entity_id

    LEFT JOIN companies c
      ON t.entity_type='company'
      AND c.id=t.entity_id

    LEFT JOIN users u
      ON u.id=t.created_by

    WHERE t.archived_at IS NULL

    AND (
      $1::text='all'
      OR t.entity_type=$1
    )

    AND (
      $2::timestamptz IS NULL
      OR t.occurred_at >= $2
    )

    AND (
      $3::timestamptz IS NULL
      OR t.occurred_at <= $3
    )

    ORDER BY
      t.occurred_at DESC,
      t.id DESC
    `,
    [
      entityType,
      fromDate,
      toDate
    ]
  );


  // ========================================
  // هزینه‌های راننده
  // فقط اگر driver یا all باشد
  // ========================================
  let expenses = [];


  if (
    entityType === 'driver' ||
    entityType === 'all'
  ) {

    const expenseResult = await query(
      `
      SELECT
        e.id,
        e.amount,
        e.currency,
        e.title AS description,
        e.status,
        e.created_at AS occurred_at,

        d.id AS entity_id,
        d.name AS entity_name,
        d.truck_number AS plate,

        u.full_name AS created_by_name

      FROM expenses e

      LEFT JOIN drivers d
        ON d.id=e.driver_id

      LEFT JOIN users u
        ON u.id=e.created_by

      WHERE e.archived_at IS NULL

      AND e.status <> 'rejected'

      AND (
        $1::timestamptz IS NULL
        OR e.created_at >= $1
      )

      AND (
        $2::timestamptz IS NULL
        OR e.created_at <= $2
      )

      ORDER BY
        e.created_at DESC,
        e.id DESC
      `,
      [
        fromDate,
        toDate
      ]
    );

    expenses = expenseResult.rows;
  }


  // ========================================
  // خلاصه راننده‌ها
  // ========================================
  const driverSummary = emptySummary();


  for (const item of transactions.rows) {

    if (item.entity_type !== 'driver') {
      continue;
    }

    if (!driverSummary[item.currency]) {
      continue;
    }

    const amount = Number(
      item.amount || 0
    );


    if (item.type === 'receipt') {
      driverSummary[item.currency].receipt +=
        amount;
    }

    if (item.type === 'payment') {
      driverSummary[item.currency].payment +=
        amount;
    }

    if (item.type === 'debt') {
      driverSummary[item.currency].debt +=
        amount;
    }

  }


  for (const item of expenses) {

    if (!driverSummary[item.currency]) {
      continue;
    }

    driverSummary[item.currency].expense +=
      Number(item.amount || 0);

  }


  for (const currency of ['USD', 'TOMAN']) {

    driverSummary[currency].balance =
      driverSummary[currency].payment
      +
      driverSummary[currency].expense
      +
      driverSummary[currency].debt
      -
      driverSummary[currency].receipt;

  }


  // ========================================
  // خلاصه شرکت‌ها
  // ========================================
  const companySummary = emptySummary();


  for (const item of transactions.rows) {

    if (item.entity_type !== 'company') {
      continue;
    }

    if (!companySummary[item.currency]) {
      continue;
    }

    const amount = Number(
      item.amount || 0
    );


    if (item.type === 'receipt') {
      companySummary[item.currency].receipt +=
        amount;
    }

    if (item.type === 'payment') {
      companySummary[item.currency].payment +=
        amount;
    }

    if (item.type === 'debt') {
      companySummary[item.currency].debt +=
        amount;
    }

  }


  for (const currency of ['USD', 'TOMAN']) {

    companySummary[currency].balance =
      companySummary[currency].receipt
      -
      companySummary[currency].payment
      -
      companySummary[currency].debt;

  }


  // ========================================
  // ریز عملیات
  // ========================================
  const rows = [

    ...transactions.rows.map(item => ({
      id: `t-${item.id}`,
      source: 'transaction',
      entityType: item.entity_type,
      entityId: item.entity_id,
      entityName: item.entity_name,
      plate: item.plate,
      type: item.type,
      amount: Number(item.amount || 0),
      currency: item.currency,
      description: item.description,
      occurredAt: item.occurred_at,
      createdByName: item.created_by_name
    })),

    ...expenses.map(item => ({
      id: `e-${item.id}`,
      source: 'expense',
      entityType: 'driver',
      entityId: item.entity_id,
      entityName: item.entity_name,
      plate: item.plate,
      type: 'expense',
      amount: Number(item.amount || 0),
      currency: item.currency,
      description: item.description,
      occurredAt: item.occurred_at,
      createdByName: item.created_by_name
    }))

  ]
  .sort(
    (a, b) =>
      new Date(b.occurredAt).getTime()
      -
      new Date(a.occurredAt).getTime()
  );


  // ========================================
  // خروجی
  // ========================================
  res.json({

    filters: {
      from: from || null,
      to: to || null,
      entityType
    },

    driverSummary:
      entityType === 'company'
        ? null
        : driverSummary,

    companySummary:
      entityType === 'driver'
        ? null
        : companySummary,

    rows

  });

});


export default router;
