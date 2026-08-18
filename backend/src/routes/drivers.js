import { Router } from 'express';
import { query } from '../lib/db.js';
import { auth, allow } from '../middleware/auth.js';

const router = Router();

router.use(auth);


// تبدیل فرمت پلاک
function normalizePlate(value = '') {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}


// ===============================
// جستجوی سریع راننده / پلاک
// ===============================
router.get('/search', allow('manager','office','employee'), async (req,res)=>{

  const q = (req.query.q || '').trim();

  if(!q){
    return res.json([]);
  }


  const search = `%${q.toUpperCase()}%`;


  const { rows } = await query(
    `
    SELECT
      id,
      name,
      truck_number,
      normalized_plate
    FROM drivers
    WHERE archived_at IS NULL
    AND plate_status='active'
    AND (
      UPPER(name) LIKE $1
      OR normalized_plate LIKE $1
    )
    ORDER BY id DESC
    LIMIT 20
    `,
    [search]
  );


  res.json(rows);

});



// ===============================
// لیست راننده‌ها
// ===============================
router.get('/', allow('manager','office'), async (_req,res)=>{

  const { rows } = await query(
    `
    SELECT *
    FROM drivers
    WHERE archived_at IS NULL
    ORDER BY id DESC
    `
  );

  res.json(rows);

});



// ===============================
// ثبت راننده و پلاک جدید
// ===============================
router.post('/', allow('manager','office','employee'), async(req,res)=>{


  const {
    name,
    truckNumber,
    phone,
    language='fa'
  } = req.body || {};


  if(!name || !truckNumber){
    return res.status(400).json({
      error:'NAME_AND_PLATE_REQUIRED'
    });
  }


  const normalizedPlate = normalizePlate(truckNumber);



  const exists = await query(
    `
    SELECT id
    FROM drivers
    WHERE normalized_plate=$1
    AND archived_at IS NULL
    LIMIT 1
    `,
    [normalizedPlate]
  );


  if(exists.rows.length){
    return res.status(409).json({
      error:'PLATE_ALREADY_EXISTS'
    });
  }



  const { rows } = await query(
    `
    INSERT INTO drivers
    (
      name,
      truck_number,
      normalized_plate,
      phone,
      language,
      plate_status
    )
    VALUES
    ($1,$2,$3,$4,$5,'pending')
    RETURNING *
    `,
    [
      name,
      normalizedPlate,
      normalizedPlate,
      phone,
      language
    ]
  );


  res.status(201).json(rows[0]);

});



// ===============================
// تایید پلاک
// ===============================
router.patch('/:id/approve',
allow('manager','office'),
async(req,res)=>{


  const { rows } = await query(
    `
    UPDATE drivers
    SET
      plate_status='active',
      updated_at=NOW()
    WHERE id=$1
    RETURNING *
    `,
    [req.params.id]
  );


  res.json(rows[0]);

});




// ===============================
// رد پلاک
// ===============================
router.patch('/:id/reject',
allow('manager','office'),
async(req,res)=>{


  const { rows } = await query(
    `
    UPDATE drivers
    SET
      plate_status='rejected',
      updated_at=NOW()
    WHERE id=$1
    RETURNING *
    `,
    [req.params.id]
  );


  res.json(rows[0]);

});



// ===============================
// ویرایش راننده
// ===============================
router.patch('/:id',
allow('manager'),
async(req,res)=>{


  const {
    name,
    truckNumber,
    phone,
    language
  } = req.body || {};


  let normalizedPlate;


  if(truckNumber){
    normalizedPlate = normalizePlate(truckNumber);
  }



  const { rows } = await query(
    `
    UPDATE drivers
    SET
      name=COALESCE($1,name),
      truck_number=COALESCE($2,truck_number),
      normalized_plate=COALESCE($3,normalized_plate),
      phone=COALESCE($4,phone),
      language=COALESCE($5,language),
      updated_at=NOW()
    WHERE id=$6
    RETURNING *
    `,
    [
      name,
      normalizedPlate,
      normalizedPlate,
      phone,
      language,
      req.params.id
    ]
  );


  res.json(rows[0]);

});



// ===============================
// حذف نرم
// ===============================
router.delete('/:id',
allow('manager'),
async(req,res)=>{


  await query(
    `
    UPDATE drivers
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
