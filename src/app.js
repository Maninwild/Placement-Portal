'use strict';

const path = require('path');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const helmet = require('helmet');
const { createAuth } = require('./auth');
const {
  ValidationError,
  gradeSubmission,
  parseOptions,
  validateLogin,
  validateRegistration,
  validateTestPayload
} = require('./domain');

const publicDirectory = path.join(__dirname, '..', 'public');

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function createApp({ pool, config }) {
  const app = express();
  const { authenticateToken, requireRole, signToken } = createAuth(config);

  app.disable('x-powered-by');
  app.use(helmet());
  if (config.corsOrigins.length > 0) {
    app.use(cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
        return callback(new ValidationError('Origin is not allowed'));
      }
    }));
  }
  app.use(express.json({ limit: '64kb' }));
  app.use(express.static(publicDirectory));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Try again later.' }
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/ready', asyncRoute(async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ready' });
  }));

  app.post('/api/auth/register', authLimiter, asyncRoute(async (req, res) => {
    const input = validateRegistration(req.body);
    const passwordHash = await bcrypt.hash(input.password, 12);

    try {
      const [result] = await pool.query(
        `INSERT INTO users (name, email, sap_id, password_hash, role)
         VALUES (?, ?, ?, ?, 'student')`,
        [input.name, input.email, input.sapId, passwordHash]
      );
      const user = { id: result.insertId, name: input.name, email: input.email, sapId: input.sapId, role: 'student' };
      res.status(201).json({ token: signToken(user), user });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Email or SAP ID is already registered' });
      }
      throw error;
    }
  }));

  app.post('/api/auth/login', authLimiter, asyncRoute(async (req, res) => {
    const input = validateLogin(req.body);
    const identifier = input.identifier.trim();
    const [rows] = await pool.query(
      `SELECT id, name, email, sap_id, password_hash, role
       FROM users WHERE email = ? OR sap_id = ? LIMIT 1`,
      [identifier.toLowerCase(), identifier.toUpperCase()]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const publicUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      sapId: user.sap_id,
      role: user.role
    };
    res.json({ token: signToken(publicUser), user: publicUser });
  }));

  app.get('/api/me', authenticateToken, asyncRoute(async (req, res) => {
    const [rows] = await pool.query(
      'SELECT id, name, email, sap_id AS sapId, role FROM users WHERE id = ? LIMIT 1',
      [req.user.sub]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: rows[0] });
  }));

  app.get(
    '/api/student/tests',
    authenticateToken,
    requireRole('student'),
    asyncRoute(async (_req, res) => {
      const [rows] = await pool.query(
        `SELECT id, title, duration_minutes AS durationMinutes, total_marks AS totalMarks,
                created_at AS createdAt
         FROM tests WHERE is_active = TRUE ORDER BY created_at DESC`
      );
      res.json({ tests: rows });
    })
  );

  app.get(
    '/api/student/tests/:id',
    authenticateToken,
    requireRole('student'),
    asyncRoute(async (req, res) => {
      const [tests] = await pool.query(
        `SELECT id, title, duration_minutes AS durationMinutes, total_marks AS totalMarks
         FROM tests WHERE id = ? AND is_active = TRUE LIMIT 1`,
        [req.params.id]
      );
      if (!tests[0]) return res.status(404).json({ error: 'Test not found' });

      const [questions] = await pool.query(
        `SELECT id, question_text AS questionText, options_json AS options, marks
         FROM questions WHERE test_id = ? ORDER BY position ASC, id ASC`,
        [req.params.id]
      );
      const safeQuestions = questions.map((question) => ({
        ...question,
        options: parseOptions(question.options)
      }));
      return res.json({ test: { ...tests[0], questions: safeQuestions } });
    })
  );

  app.post(
    '/api/student/tests/:id/submit',
    authenticateToken,
    requireRole('student'),
    asyncRoute(async (req, res) => {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [tests] = await connection.query(
          'SELECT id FROM tests WHERE id = ? AND is_active = TRUE FOR UPDATE',
          [req.params.id]
        );
        if (!tests[0]) {
          await connection.rollback();
          return res.status(404).json({ error: 'Test not found' });
        }

        const [questions] = await connection.query(
          'SELECT id, correct_answer, marks FROM questions WHERE test_id = ? ORDER BY position ASC, id ASC',
          [req.params.id]
        );
        if (questions.length === 0) {
          await connection.rollback();
          return res.status(409).json({ error: 'This test has no questions' });
        }

        const result = gradeSubmission(questions, req.body.answers);
        await connection.query(
          `INSERT INTO submissions (test_id, user_id, score, total_marks, answers_json)
           VALUES (?, ?, ?, ?, ?)`,
          [req.params.id, req.user.sub, result.score, result.totalMarks, JSON.stringify(req.body.answers)]
        );
        await connection.commit();
        return res.status(201).json(result);
      } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ error: 'You have already submitted this test' });
        }
        throw error;
      } finally {
        connection.release();
      }
    })
  );

  app.get(
    '/api/student/results',
    authenticateToken,
    requireRole('student'),
    asyncRoute(async (req, res) => {
      const [rows] = await pool.query(
        `SELECT s.id, t.title, s.score, s.total_marks AS totalMarks,
                s.submitted_at AS submittedAt
         FROM submissions s
         JOIN tests t ON t.id = s.test_id
         WHERE s.user_id = ? ORDER BY s.submitted_at DESC`,
        [req.user.sub]
      );
      res.json({ results: rows });
    })
  );

  app.post(
    '/api/teacher/tests',
    authenticateToken,
    requireRole('teacher', 'admin'),
    asyncRoute(async (req, res) => {
      const input = validateTestPayload(req.body);
      const totalMarks = input.questions.reduce((sum, question) => sum + question.marks, 0);
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [testResult] = await connection.query(
          `INSERT INTO tests (title, duration_minutes, total_marks, created_by)
           VALUES (?, ?, ?, ?)`,
          [input.title, input.durationMinutes, totalMarks, req.user.sub]
        );

        for (const [index, question] of input.questions.entries()) {
          await connection.query(
            `INSERT INTO questions
             (test_id, question_text, options_json, correct_answer, marks, position)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              testResult.insertId,
              question.questionText,
              JSON.stringify(question.options),
              question.correctAnswer,
              question.marks,
              index + 1
            ]
          );
        }
        await connection.commit();
        return res.status(201).json({ id: testResult.insertId, title: input.title, totalMarks });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    })
  );

  app.get(
    '/api/teacher/results',
    authenticateToken,
    requireRole('teacher', 'admin'),
    asyncRoute(async (req, res) => {
      const query = String(req.query.query || '').trim().slice(0, 100);
      const like = `%${query}%`;
      const [rows] = await pool.query(
        `SELECT s.id, u.name AS studentName, u.email, u.sap_id AS sapId,
                t.title, s.score, s.total_marks AS totalMarks,
                s.submitted_at AS submittedAt
         FROM submissions s
         JOIN users u ON u.id = s.user_id
         JOIN tests t ON t.id = s.test_id
         WHERE (? = '' OR u.name LIKE ? OR u.email LIKE ? OR u.sap_id LIKE ?)
         ORDER BY s.submitted_at DESC LIMIT 250`,
        [query, like, like, like]
      );
      res.json({ results: rows });
    })
  );

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found' });
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof ValidationError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: 'Unexpected server error' });
  });

  return app;
}

module.exports = { createApp };
