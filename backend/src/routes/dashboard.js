import { Router } from 'express';
import { query } from '../lib/db.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.use(auth);


// ========================================
// ساخت قالب خالی حساب
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
// داشبورد اصلی
// ========================================
router.get('/', async (req, res) => {

  const role = req.user.role;


  // ========================================
  // کاربر عادی
  // فقط عملیات خودش
  // ========================================
  if (role === 'employee') {

    const myExpenses = await query(
      `
      SELECT
        e.id,
        e.title AS description,
        e.amount,
        e.currency,
        e.status,
        e.created_at AS occurred_at,

        d.name AS driver_name,
        d.truck_number AS plate

      FROM expenses e

      LEFT JOIN drivers d
        ON d.id=e.driver_id

      WHERE e.created_by=$1
      AND e.archived_at IS NULL

      ORDER BY e.created_at DESC, e.id DESC

      LIMIT 10
      `,
      [req.user.id]
    );


    return res.json({

      role: 'employee',

      driverToday: null,

      companyToday: null,

      recent: myExpenses.rows.map(item => ({
        ...item,
        type: 'expense',
        source: 'expense'
      })),

      drivers: []

    });

  }



  // ========================================
  // خلاصه امروز راننده‌ها
  // ========================================

  const driverTransactionTotals = await query(
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

    AND entity_type='driver'

    AND occurred_at >= CURRENT_DATE

    AND occurred_at <
        CURRENT_DATE + INTERVAL '1 day'

    GROUP BY currency
    `
  );


  const driverExpenseTotals = await query(
    `
    SELECT
      currency,

      COALESCE(
        SUM(amount),
        0
      ) AS expense

    FROM expenses

    WHERE archived_at IS NULL

    AND status <> 'rejected'

    AND created_at >= CURRENT_DATE

    AND created_at <
        CURRENT_DATE + INTERVAL '1 day'

    GROUP BY currency
    `
  );


  const driverToday = emptySummary();


  for (const row of driverTransactionTotals.rows) {

    if (!driverToday[row.currency]) continue;

    driverToday[row.currency].receipt =
      Number(row.receipt || 0);

    driverToday[row.currency].payment =
      Number(row.payment || 0);

    driverToday[row.currency].debt =
      Number(row.debt || 0);
  }


  for (const row of driverExpenseTotals.rows) {

    if (!driverToday[row.currency]) continue;

    driverToday[row.currency].expense =
      Number(row.expense || 0);
  }


  // مطابق منطق حساب راننده:
  // پرداخت + هزینه + بدهی - دریافت
  for (const currency of ['USD', 'TOMAN']) {

    driverToday[currency].balance =
      driverToday[currency].payment
      +
      driverToday[currency].expense
      +
      driverToday[currency].debt
      -
      driverToday[currency].receipt;

  }



  // ========================================
  // خلاصه امروز شرکت‌ها
  // فقط برای مدیر
  // ========================================

  let companyToday = null;


  if (role === 'manager') {

    companyToday = emptySummary();


    const companyTransactionTotals = await query(
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

      AND entity_type='company'

      AND occurred_at >= CURRENT_DATE

      AND occurred_at <
          CURRENT_DATE + INTERVAL '1 day'

      GROUP BY currency
      `
    );


    for (const row of companyTransactionTotals.rows) {

      if (!companyToday[row.currency]) continue;

      companyToday[row.currency].receipt =
        Number(row.receipt || 0);

      companyToday[row.currency].payment =
        Number(row.payment || 0);

      companyToday[row.currency].debt =
        Number(row.debt || 0);

    }


    // مطابق منطق حساب شرکت:
    // دریافت - پرداخت - بدهی
    for (const currency of ['USD', 'TOMAN']) {

      companyToday[currency].balance =
        companyToday[currency].receipt
        -
        companyToday[currency].payment
        -
        companyToday[currency].debt;

    }

  }



  // ========================================
  // آخرین تراکنش‌ها
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
      $1::text='manager'
      OR t.entity_type='driver'
    )

    ORDER BY
      t.occurred_at DESC,
      t.id DESC

    LIMIT 20
    `,
    [role]
  );



  // ========================================
  // آخرین هزینه‌های راننده‌ها
  // ========================================

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

    ORDER BY
      e.created_at DESC,
      e.id DESC

    LIMIT 20
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
    (a, b) =>
      new Date(b.occurred_at).getTime()
      -
      new Date(a.occurred_at).getTime()
  )

  .slice(0, 20);



  // ========================================
  // خلاصه حساب راننده‌ها
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



  // ========================================
  // خروجی نهایی
  // ========================================

  res.json({

    role,

    driverToday,

    companyToday,

    recent,

    drivers: drivers.rows

  });

});


export default router;
