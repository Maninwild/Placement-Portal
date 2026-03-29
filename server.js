const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const db = require('./db'); // mysql2/promise pool

const app = express();
const upload = multer();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const SECRET = 'replace_this_with_a_real_secret';

// Middleware for JWT
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing token' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ========== AUTH ROUTES ==========

// Signup
app.post('/api/signup', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!email || !password || !role) return res.status(400).json({ error: 'Missing fields' });
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length > 0) return res.status(400).json({ error: 'User already exists' });
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)',
      [name||'', email, hash, role]
    );
    const id = result.insertId;
    const token = jwt.sign({ id, email, role, name }, SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(400).json({ error: 'Invalid credentials' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// ========== TEACHER ROUTES ==========

// Add MCQ
app.post('/api/teacher/mcq', authMiddleware, async (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Forbidden' });
  const { title, question, options, answer, marks } = req.body;
  try {
    await db.query(
      'INSERT INTO mcqs (title,question,options_json,answer,marks,created_by) VALUES (?,?,?,?,?,?)',
      [title||'', question||'', JSON.stringify(options||[]), answer, marks||1, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Add coding challenge
app.post('/api/teacher/coding', authMiddleware, async (req,res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Forbidden' });
  const { title, description, template, tests } = req.body;
  try {
    await db.query(
      'INSERT INTO coding (title,description,template,tests_json,created_by) VALUES (?,?,?,?,?)',
      [title||'', description||'', template||'', JSON.stringify(tests||[]), req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// View results
app.get('/api/teacher/results', authMiddleware, async (req,res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Forbidden' });
  try {
    const [rows] = await db.query(
      'SELECT r.*, u.name as student_name FROM results r JOIN users u ON u.id = r.user_id ORDER BY r.timestamp DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// ========== STUDENT ROUTES ==========

// List available tests
app.get('/api/student/tests', authMiddleware, async (req,res) => {
  try {
    const [mcqs] = await db.query('SELECT id,title,marks FROM mcqs');
    const [codes] = await db.query('SELECT id,title FROM coding');
    res.json({ mcqs, coding: codes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Get MCQ
app.get('/api/mcq/:id', authMiddleware, async (req,res) => {
  const id = req.params.id;
  try {
    const [rows] = await db.query('SELECT * FROM mcqs WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const row = rows[0];
    row.options = JSON.parse(row.options_json);
    delete row.options_json;
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Submit MCQ
app.post('/api/student/mcq/:id/submit', authMiddleware, async (req,res) => {
  const id = req.params.id;
  const answers = req.body.answers;
  try {
    const [rows] = await db.query('SELECT * FROM mcqs WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const row = rows[0];
    const correct = row.answer;
    let score = 0;
    if (answers == correct) score = row.marks;
    await db.query(
      'INSERT INTO results (user_id,test_type,test_id,score) VALUES (?,?,?,?)',
      [req.user.id, 'mcq', id, score]
    );
    res.json({ score });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Get coding problem
app.get('/api/coding/:id', authMiddleware, async (req,res) => {
  const id = req.params.id;
  try {
    const [rows] = await db.query('SELECT * FROM coding WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const row = rows[0];
    row.tests = JSON.parse(row.tests_json || '[]');
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Coding evaluator (demo, not secure)
function evaluateJS(userCode, tests) {
  const wrapped = `(function(input){\n${userCode}\n})`;
  try {
    const userFn = eval(wrapped);
    const results = [];
    for (const t of tests) {
      const out = userFn(t.input);
      results.push({ input: t.input, expected: t.output, got: out });
    }
    return results;
  } catch (e) {
    return { error: ''+e };
  }
}

// Submit coding
app.post('/api/student/coding/:id/submit', authMiddleware, upload.none(), async (req,res) => {
  const id=req.params.id;
  const { code } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM coding WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const row = rows[0];
    const tests = JSON.parse(row.tests_json || '[]');
    const evalRes = evaluateJS(code, tests);
    let score = 0;
    if (evalRes.error) {
      await db.query('INSERT INTO results (user_id,test_type,test_id,score) VALUES (?,?,?,?)',
        [req.user.id, 'coding', id, 0]);
      return res.json({ ok: false, error: evalRes.error });
    } else {
      let passed = 0;
      for (const r of evalRes) {
        if (String(r.got) === String(r.expected)) passed++;
      }
      score = Math.round((passed / tests.length) * 100);
      await db.query('INSERT INTO results (user_id,test_type,test_id,score) VALUES (?,?,?,?)',
        [req.user.id, 'coding', id, score]);
      return res.json({ ok: true, score, details: evalRes });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// View own results
app.get('/api/student/results', authMiddleware, async (req,res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM results WHERE user_id = ? ORDER BY timestamp DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Serve index
app.get('/', (req,res) => {
  res.sendFile(path.join(__dirname,'public','index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Server started on', PORT));
