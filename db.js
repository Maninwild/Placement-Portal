const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',   // change to your DB host
  user: 'root',        // change to your DB user
  password: '',        // change to your DB password
  database: 'placement_portal', // ensure this DB exists
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
