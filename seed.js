/**
 * Simple seed to create an admin and a teacher.
 * Usage: node migrations/seed.js
 */
const bcrypt = require('bcrypt');
const pool = require('../db');

async function seed() {
  try {
    const adminPass = await bcrypt.hash('admin123', 10);
    const teacherPass = await bcrypt.hash('teacher123', 10);

    // Insert admin if not exists
    await pool.query(
      "INSERT INTO users (id, name, email, password_hash, role) SELECT * FROM (SELECT 1 AS id, 'Admin' AS name, 'admin@demo' AS email, ? AS password_hash, 'admin' AS role) AS tmp WHERE NOT EXISTS (SELECT email FROM users WHERE email = 'admin@demo') LIMIT 1",
      [adminPass]
    );

    // Insert teacher if not exists
    await pool.query(
      "INSERT INTO users (id, name, email, password_hash, role) SELECT * FROM (SELECT 2 AS id, 'Teacher' AS name, 'teacher@demo' AS email, ? AS password_hash, 'teacher' AS role) AS tmp WHERE NOT EXISTS (SELECT email FROM users WHERE email = 'teacher@demo') LIMIT 1",
      [teacherPass]
    );

    console.log('Seed done. Admin: admin@demo / admin123  Teacher: teacher@demo / teacher123');
    process.exit(0);
  } catch (e) {
    console.error('Seed error', e);
    process.exit(1);
  }
}

seed();
