import bcrypt from 'bcryptjs';
import { pool } from './lib/db.js';

const username = process.env.SEED_ADMIN_USERNAME || 'admin';
const password = process.env.SEED_ADMIN_PASSWORD || 'Vali@12345';

const hash = await bcrypt.hash(password, 12);

await pool.query(
  `
  INSERT INTO users
    (username, full_name, role, password_hash)
  VALUES
    ($1, $2, 'manager', $3)
  ON CONFLICT (username)
  DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    updated_at = NOW()
  `,
  [
    username.toLowerCase(),
    'VAHID VALI',
    hash
  ]
);

console.log(`Admin ready: ${username}`);

await pool.end();
