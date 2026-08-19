import { Router } from 'express';
import { query } from '../lib/db.js';
import { auth, allow } from '../middleware/auth.js';

const router = Router();

router.use(auth);


// نرمال کردن پلاک
function normalizePlate(value = '') {
  return value
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}


// ==========================
// جستجوی راننده / پلاک
// ==========================
router.get('/search', allow('manager','office','employee'), async (req,res)=>{

  const q = (req.query.q || '').trim();

  if(!q){
    return res.json([]);
  }


  const search = `%${normalizePlate(q)}%`;


  const { rows } = await query(
    `
    SELECT
      id,
      name,
      truck_number,
      phone,
      language
    FROM drivers
    WHERE archived_at IS NULL
    AND (
      UPPER(REPLACE(truck_number,' ','')) LIKE $1
      OR UPPER(name) LIKE $2
    )
    ORDER BY id DESC
    LIMIT 20
    `,
    [
      search,
      `%${q}%`
    ]
  );


  res.json(rows);

});



// ==========================
// لیست راننده‌ها
// ==========================
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



// ==========================
// ثبت راننده
// ==========================
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



  const plate = normalizePlate(truckNumber);



  // جلوگیری از پلاک تکراری
  const exists = await query(
    `
    SELECT id
    FROM drivers
    WHERE UPPER(REPLACE(truck_number,' ',''))
    =$1
    AND archived_at IS NULL
    LIMIT 1
    `,
    [plate]
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
      language
    )
    VALUES
    ($1,$2,$3,$4,$5)
    RETURNING *
    `,
    [
      name,
      plate,
      plate,
      phone,
      language
    ]
  );


  res.status(201).json(rows[0]);

});




// ==========================
// ویرایش راننده
// ==========================
router.patch('/:id',
allow('manager'),
async(req,res)=>{


  const {
    name,
    truckNumber,
    phone,
    language
  } = req.body || {};



  let plate;



  if(truckNumber){
    plate = normalizePlate(truckNumber);
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
      plate,
      plate,
      phone,
      language,
      req.params.id
    ]
  );


  res.json(rows[0]);

});




// ==========================
// آرشیو راننده
// ==========================
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
