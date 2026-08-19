import { Router } from 'express';
import { query } from '../lib/db.js';
import { auth, allow } from '../middleware/auth.js';

const router = Router();

router.use(auth);


// ==========================
// لیست هزینه‌ها
// ==========================
router.get('/', allow('manager','office'), async (_req,res)=>{

  const { rows } = await query(`
    SELECT
      e.*,
      d.name AS driver_name,
      d.truck_number AS plate,
      u.full_name AS created_by_name,
      a.full_name AS approved_by_name
    FROM expenses e
    LEFT JOIN drivers d ON d.id=e.driver_id
    LEFT JOIN users u ON u.id=e.created_by
    LEFT JOIN users a ON a.id=e.approved_by
    WHERE e.archived_at IS NULL
    ORDER BY e.created_at DESC
  `);


  res.json(rows);

});




// ==========================
// ثبت هزینه
// ==========================
router.post('/', allow('manager','office','employee'), async(req,res)=>{


  const {
    driverId,
    amount,
    currency,
    description=''
  } = req.body || {};



  if(!amount || !currency){

    return res.status(400).json({
      error:'AMOUNT_AND_CURRENCY_REQUIRED'
    });

  }



  if(!['USD','TOMAN'].includes(currency)){

    return res.status(400).json({
      error:'INVALID_CURRENCY'
    });

  }



  if(!driverId){

    return res.status(400).json({
      error:'DRIVER_REQUIRED'
    });

  }




  const driverResult = await query(
    `
    SELECT id
    FROM drivers
    WHERE id=$1
    AND archived_at IS NULL
    LIMIT 1
    `,
    [driverId]
  );



  if(!driverResult.rows.length){

    return res.status(404).json({
      error:'DRIVER_NOT_FOUND'
    });

  }




  const { rows } = await query(
    `
    INSERT INTO expenses
    (
      driver_id,
      title,
      amount,
      currency,
      note,
      created_by,
      status
    )
    VALUES
    ($1,$2,$3,$4,$5,$6,'pending')
    RETURNING *
    `,
    [
      driverId,
      description,
      amount,
      currency,
      description,
      req.user.id
    ]
  );



  res.status(201).json(rows[0]);

});





// ==========================
// تایید یا رد هزینه
// ==========================
router.post('/:id/decision',
allow('manager','office'),
async(req,res)=>{


  const {
    decision
  } = req.body || {};



  if(!['approved','rejected'].includes(decision)){

    return res.status(400).json({
      error:'INVALID_DECISION'
    });

  }



  const { rows } = await query(
    `
    UPDATE expenses
    SET
      status=$1,
      approved_by=$2,
      approved_at=NOW(),
      updated_at=NOW()
    WHERE id=$3
    RETURNING *
    `,
    [
      decision,
      req.user.id,
      req.params.id
    ]
  );



  res.json(rows[0]);

});




// ==========================
// ویرایش هزینه
// ==========================
router.patch('/:id',
allow('manager'),
async(req,res)=>{


  const {
    amount,
    currency,
    description
  } = req.body || {};



  const { rows } = await query(
    `
    UPDATE expenses
    SET
      amount=COALESCE($1,amount),
      currency=COALESCE($2,currency),
      title=COALESCE($3,title),
      note=COALESCE($3,note),
      updated_at=NOW()
    WHERE id=$4
    RETURNING *
    `,
    [
      amount,
      currency,
      description,
      req.params.id
    ]
  );



  res.json(rows[0]);

});




// ==========================
// حذف نرم
// ==========================
router.delete('/:id',
allow('manager'),
async(req,res)=>{


  await query(
    `
    UPDATE expenses
    SET
      archived_at=NOW(),
      updated_at=NOW()
    WHERE id=$1
    `,
    [req.params.id]
  );



  res.status(204).end();

});



export default router;
