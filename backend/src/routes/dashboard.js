import { Router } from 'express';
import { query } from '../lib/db.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.use(auth);


// ========================================
// داشبورد اصلی
// ========================================
router.get('/', async (req, res) => {

  const role = req.user.role;

  // ----------------------------------------
  // کاربر عادی: بدون نمایش حساب مالی شرکت
  // ----------------------------------------
  if (role === 'employee') {

    const myExpenses = await query(
      `
      SELECT
        e.id,
        e.title AS description,
        e.amount,
        e.currency,
        e.status,
        e.created_at,
        d.name AS driver_name,
        d.truck_number AS plate
      FROM expenses e
      LEFT JOIN drivers d
        ON d.id=e.driver_id
      WHERE e.created_by=$1
      AND e.archived_at IS NULL
      ORDER BY e.created_at DESC
      LIMIT 10
      `,
      [req.user.id]
    );

    return res.json({
      role: 'employee',

      today: null,

      recent: myExpenses.rows.map(item => ({
        ...item,
        type: 'expense',
        source: 'expense'
      })),

      drivers: []
    });
  }


  // ========================================
  // مدیر / دفتردار
  // ========================================

  const includeCompanies = role === 'manager';


  // ----------------------------------------
  // جمع تراکنش‌های امروز
  // ----------------------------------------
  const transactionTotals = await query(
    `
    SELECT
      currency,

      COALESCE(
        SUM(
          CASE
            WHEN type='receipt'
            THEN amount
            ELSE 0
          END
        ),
        0
      ) AS receipt,

      COALESCE(
        SUM(
          CASE
            WHEN type='payment'
            THEN amount
            ELSE 0
          END
        ),
        0
      ) AS payment,

      COALESCE(
        SUM(
          CASE
            WHEN type='debt'
            THEN amount
            ELSE 0
          END
        ),
        0
      ) AS debt

    FROM transactions

    WHERE archived_at IS NULL

    AND occurred_at >= CURRENT_DATE
    AND occurred_at < CURRENT_DATE + INTERVAL '1 day'

    AND (
      $1::boolean = TRUE
      OR entity_type='driver'
    )

    GROUP BY currency
    `,
    [includeCompanies]
  );


  // ----------------------------------------
  // هزینه‌های امروز
  // ----------------------------------------
  const expenseTotals = await query(
    `
    SELECT
      currency,
      COALESCE(SUM(amount),0) AS expense
    FROM expenses

    WHERE archived_at IS NULL

    AND created_at >= CURRENT_DATE
    AND created_at < CURRENT_DATE + INTERVAL '1 day'

    AND status <> 'rejected'

    GROUP BY currency
    `
  );


  // ----------------------------------------
  // ساخت خلاصه دلار / تومان
  // ----------------------------------------
  const today = {

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


  for (const row of transactionTotals.rows) {

    if (!today[row.currency]) continue;

    today[row.currency].receipt =
      Number(row.receipt || 0);

    today[row.currency].payment =
      Number(row.payment || 0);

    today[row.currency].debt =
      Number(row.debt || 0);
  }


  for (const row of expenseTotals.rows) {

    if (!today[row.currency]) continue;

    today[row.currency].expense =
      Number(row.expense || 0);
  }


  for (const currency of ['USD','TOMAN']) {

    today[currency].balance =
      today[currency].receipt
      -
      today[currency].payment
      -
      today[currency].expense;
  }


  // ========================================
  // آخرین عملیات مالی
  // ========================================
  const recentTransactions = await query(
    `
    SELECT
      t.id,
      t.type,
      t.amount,
      t.currency,
      t.description,
      t.occurred_at,

      t.entity_type,

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
      $1::boolean = TRUE
      OR t.entity_type='driver'
    )

    ORDER BY t.occurred_at DESC, t.id DESC

    LIMIT 15
    `,
    [includeCompanies]
  );


  const recentExpenses = await query(
    `
    SELECT
      e.id,
      'expense' AS type,
      e.amount,
      e.currency,
      e.title AS description,
      e.created_at AS occurred_at,

      'driver' AS entity_type,

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

    ORDER BY e.created_at DESC, e.id DESC

    LIMIT 15
    `
  );


  const recent = [

    ...recentTransactions.rows.map(item => ({
      ...item,
      source: 'transaction'
    })),

    ...recentExpenses.rows.map(item => ({
      ...item,
      source: 'expense'
    }))

  ]
  .sort(
    (a,b) =>
      new Date(b.occurred_at).getTime()
      -
      new Date(a.occurred_at).getTime()
  )
  .slice(0,15);


  // ========================================
  // وضعیت حساب راننده‌ها
  // ========================================
  const drivers = await query(
    `
    SELECT
      d.id,
      d.name,
      d.truck_number,

      COALESCE(
        SUM(
          CASE
            WHEN t.currency='USD'
            AND t.type='payment'
            THEN t.amount
            ELSE 0
          END
        ),
        0
      ) AS payment_usd,

      COALESCE(
        SUM(
          CASE
            WHEN t.currency='USD'
            AND t.type='receipt'
            THEN t.amount
            ELSE 0
          END
        ),
        0
      ) AS receipt_usd,

      COALESCE(
        SUM(
          CASE
            WHEN t.currency='TOMAN'
            AND t.type='payment'
            THEN t.amount
            ELSE 0
          END
        ),
        0
      ) AS payment_toman,

      COALESCE(
        SUM(
          CASE
            WHEN t.currency='TOMAN'
            AND t.type='receipt'
            THEN t.amount
            ELSE 0
          END
        ),
        0
      ) AS receipt_toman

    FROM drivers d

    LEFT JOIN transactions t
      ON t.entity_type='driver'
      AND t.entity_id=d.id
      AND t.archived_at IS NULL

    WHERE d.archived_at IS NULL

    GROUP BY
      d.id,
      d.name,
      d.truck_number

    ORDER BY d.id DESC

    LIMIT 20
    `
  );


  res.json({

    role,

    today,

    recent,

    drivers: drivers.rows

  });

});


export default router;
