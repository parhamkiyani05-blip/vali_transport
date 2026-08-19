// ==========================
// حساب راننده
// ==========================
router.get('/:id/account',
allow('manager','office'),
async(req,res)=>{

  const driverId = req.params.id;


  const driver = await query(
    `
    SELECT
      id,
      name,
      truck_number,
      phone
    FROM drivers
    WHERE id=$1
    AND archived_at IS NULL
    `,
    [driverId]
  );


  if(!driver.rows.length){
    return res.status(404).json({
      error:'DRIVER_NOT_FOUND'
    });
  }



  const transactions = await query(
    `
    SELECT
      id,
      type,
      amount,
      currency,
      description,
      occurred_at
    FROM transactions
    WHERE entity_type='driver'
    AND entity_id=$1
    AND archived_at IS NULL
    ORDER BY occurred_at DESC,id DESC
    `,
    [driverId]
  );



  const expenses = await query(
    `
    SELECT
      id,
      amount,
      currency,
      title AS description,
      created_at AS occurred_at
    FROM expenses
    WHERE driver_id=$1
    AND archived_at IS NULL
    ORDER BY created_at DESC,id DESC
    `,
    [driverId]
  );



  res.json({
    driver: driver.rows[0],
    transactions: transactions.rows,
    expenses: expenses.rows
  });


});
