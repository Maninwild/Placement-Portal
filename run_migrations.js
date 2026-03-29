/**
 * Simple migration runner: loads SQL file and executes it.
 * Usage: node migrations/run_migrations.js
 */
const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function run() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, '001_schema.sql'), 'utf8');
    const stmts = sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
    for (const s of stmts) {
      await pool.query(s);
    }
    console.log('Migrations applied');
    process.exit(0);
  } catch (e) {
    console.error('Migration error', e);
    process.exit(1);
  }
}

run();
