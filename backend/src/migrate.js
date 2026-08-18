import fs from 'fs/promises';
import { pool } from './lib/db.js';
const sql = await fs.readFile(new URL('../sql/001_init.sql', import.meta.url), 'utf8');
await pool.query(sql);
console.log('Migration complete.');
await pool.end();
