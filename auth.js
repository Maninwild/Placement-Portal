const jwt = require('jsonwebtoken');
const pool = require('./db');
const bcrypt = require('bcrypt');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

async function registerUser({ name, email, password, role='student', sap_id, mobile, age, gender }) {
  const hashed = await bcrypt.hash(password, 10);
  const [res] = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, sap_id, mobile, age, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, email, hashed, role, sap_id || null, mobile || null, age || null, gender || null]
  );
  return res.insertId;
}

async function authenticate(emailOrSap, password) {
  const [rows] = await pool.query(
    `SELECT * FROM users WHERE email = ? OR sap_id = ? LIMIT 1`, [emailOrSap, emailOrSap]
  );
  const user = rows[0];
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '8h' });
  return { token, user: { id: user.id, name: user.name, role: user.role, email: user.email } };
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization?.split(' ')[1];
  if (!auth) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(auth, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).send({ error: 'not authenticated' });
    if (req.user.role !== role && req.user.role !== 'admin') return res.status(403).send({ error: 'forbidden' });
    next();
  };
}

module.exports = { registerUser, authenticate, requireAuth, requireRole };
