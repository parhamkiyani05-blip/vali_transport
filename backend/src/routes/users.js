import { Router } from 'express';
import bcrypt from 'bcryptjs';

import { query } from '../lib/db.js';
import {
  auth,
  allow
} from '../middleware/auth.js';


const router = Router();


// فقط مدیر
router.use(
  auth,
  allow('manager')
);


// ========================================
// دریافت کاربران
// ========================================

router.get('/', async (_req, res) => {

  const { rows } = await query(`
    SELECT
      id,
      username,
      full_name,
      role,
      active,
      created_at
    FROM users
    WHERE archived_at IS NULL
    ORDER BY id
  `);

  res.json(rows);

});


// ========================================
// ایجاد کاربر
// ========================================

router.post('/', async (req, res) => {

  try {

    const {
      username,
      fullName,
      role,
      password
    } = req.body || {};


    if (
      !username?.trim() ||
      !fullName?.trim() ||
      !role ||
      !password
    ) {
      return res.status(400).json({
        error: 'MISSING_FIELDS'
      });
    }


    const normalizedUsername =
      username
        .trim()
        .toLowerCase();


    const existing = await query(
      `
        SELECT id
        FROM users
        WHERE username = $1
        LIMIT 1
      `,
      [normalizedUsername]
    );


    if (existing.rows.length) {
      return res.status(409).json({
        error: 'USERNAME_EXISTS'
      });
    }


    const hash =
      await bcrypt.hash(
        password,
        12
      );


    const { rows } = await query(
      `
        INSERT INTO users(
          username,
          full_name,
          role,
          password_hash
        )
        VALUES(
          $1,
          $2,
          $3,
          $4
        )
        RETURNING
          id,
          username,
          full_name,
          role,
          active
      `,
      [
        normalizedUsername,
        fullName.trim(),
        role,
        hash
      ]
    );


    res
      .status(201)
      .json(rows[0]);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: 'CREATE_USER_FAILED'
    });

  }

});


// ========================================
// ویرایش کاربر
// username / password / name / role / active
// فقط مدیر
// ========================================

router.patch('/:id', async (req, res) => {

  try {

    const {
      username,
      fullName,
      role,
      active,
      password
    } = req.body || {};


    let normalizedUsername = null;


    if (
      typeof username === 'string'
    ) {

      normalizedUsername =
        username
          .trim()
          .toLowerCase();


      if (!normalizedUsername) {
        return res.status(400).json({
          error: 'INVALID_USERNAME'
        });
      }


      const existing =
        await query(
          `
            SELECT id
            FROM users
            WHERE
              username = $1
              AND id <> $2
            LIMIT 1
          `,
          [
            normalizedUsername,
            req.params.id
          ]
        );


      if (existing.rows.length) {
        return res.status(409).json({
          error: 'USERNAME_EXISTS'
        });
      }

    }


    let passwordHash = null;


    if (
      typeof password === 'string' &&
      password.trim()
    ) {

      passwordHash =
        await bcrypt.hash(
          password,
          12
        );

    }


    const { rows } =
      await query(
        `
          UPDATE users
          SET
            username =
              COALESCE(
                $1,
                username
              ),

            full_name =
              COALESCE(
                $2,
                full_name
              ),

            role =
              COALESCE(
                $3,
                role
              ),

            active =
              COALESCE(
                $4,
                active
              ),

            password_hash =
              COALESCE(
                $5,
                password_hash
              ),

            updated_at = NOW()

          WHERE id = $6

          RETURNING
            id,
            username,
            full_name,
            role,
            active
        `,
        [
          normalizedUsername,

          typeof fullName === 'string'
            ? fullName.trim() || null
            : null,

          role || null,

          typeof active === 'boolean'
            ? active
            : null,

          passwordHash,

          req.params.id
        ]
      );


    if (!rows.length) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND'
      });
    }


    res.json(rows[0]);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: 'UPDATE_USER_FAILED'
    });

  }

});


// ========================================
// آرشیو کاربر
// ========================================

router.delete('/:id', async (req, res) => {

  if (
    String(req.user.id) ===
    String(req.params.id)
  ) {
    return res.status(400).json({
      error: 'CANNOT_ARCHIVE_SELF'
    });
  }


  await query(
    `
      UPDATE users
      SET
        archived_at = NOW(),
        active = false,
        updated_at = NOW()
      WHERE id = $1
    `,
    [req.params.id]
  );


  res
    .status(204)
    .end();

});


export default router;
