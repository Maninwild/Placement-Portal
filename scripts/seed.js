'use strict';

const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');

function requiredSeedValue(name) {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith('replace_')) {
    throw new Error(`${name} must be set before running the seed script`);
  }
  return value;
}

async function seed() {
  const name = process.env.SEED_TEACHER_NAME?.trim() || 'Placement Coordinator';
  const email = requiredSeedValue('SEED_TEACHER_EMAIL').toLowerCase();
  const password = requiredSeedValue('SEED_TEACHER_PASSWORD');
  if (password.length < 12) throw new Error('SEED_TEACHER_PASSWORD must contain at least 12 characters');

  const passwordHash = await bcrypt.hash(password, 12);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO users (name, email, sap_id, password_hash, role)
       VALUES (?, ?, 'TEACHER001', ?, 'teacher')
       ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role = 'teacher'`,
      [name, email, passwordHash]
    );

    const [teachers] = await connection.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    const teacherId = teachers[0].id;
    const [existingTests] = await connection.query('SELECT id FROM tests LIMIT 1');

    if (existingTests.length === 0) {
      const [test] = await connection.query(
        `INSERT INTO tests (title, duration_minutes, total_marks, created_by)
         VALUES ('Placement Readiness Basics', 15, 3, ?)`,
        [teacherId]
      );
      const questions = [
        ['Which data structure follows FIFO order?', ['Stack', 'Queue', 'Tree', 'Graph'], 'Queue'],
        ['Which SQL command reads rows from a table?', ['SELECT', 'UPDATE', 'DELETE', 'DROP'], 'SELECT'],
        ['What does HTTP status 404 mean?', ['Created', 'Unauthorized', 'Not Found', 'Server Error'], 'Not Found']
      ];
      for (const [index, question] of questions.entries()) {
        await connection.query(
          `INSERT INTO questions
           (test_id, question_text, options_json, correct_answer, marks, position)
           VALUES (?, ?, ?, ?, 1, ?)`,
          [test.insertId, question[0], JSON.stringify(question[1]), question[2], index + 1]
        );
      }
    }

    await connection.commit();
    console.log(`Seed completed for teacher ${email}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error.message);
  process.exitCode = 1;
});
