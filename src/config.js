'use strict';

require('dotenv').config();

function integerFromEnv(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function requireJwtSecret(value) {
  if (!value || value.length < 32 || value.startsWith('replace_')) {
    throw new Error('JWT_SECRET must be set to a random value of at least 32 characters');
  }
  return value;
}

const config = Object.freeze({
  port: integerFromEnv(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: requireJwtSecret(process.env.JWT_SECRET),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigins: (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  db: Object.freeze({
    host: process.env.DB_HOST || 'localhost',
    port: integerFromEnv(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'placement_app',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'placement_portal'
  })
});

module.exports = { config };
