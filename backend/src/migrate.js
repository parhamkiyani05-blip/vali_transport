import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './lib/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlDir = path.join(__dirname, '../sql');

const files = (await fs.readdir(sqlDir))
  .filter(file => file.endsWith('.sql'))
  .sort();

for (const file of files) {
  console.log(`Running migration: ${file}`);

  const sql = await fs.readFile(
    path.join(sqlDir, file),
    'utf8'
  );

  await pool.query(sql);
}

console.log('Migration complete.');

await pool.end();
