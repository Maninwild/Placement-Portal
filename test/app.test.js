'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');

function startTestServer(pool = { query: async () => [[]] }) {
  const app = createApp({
    pool,
    config: {
      corsOrigins: [],
      jwtSecret: 'test-secret-that-is-longer-than-thirty-two-characters',
      jwtExpiresIn: '5m'
    }
  });
  const server = app.listen(0);
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

test('health endpoint responds without a database connection', async (context) => {
  const server = startTestServer();
  context.after(server.close);
  const response = await fetch(`${server.baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('protected student route rejects anonymous requests', async (context) => {
  const server = startTestServer();
  context.after(server.close);
  const response = await fetch(`${server.baseUrl}/api/student/tests`);
  assert.equal(response.status, 401);
});

test('public registration cannot create an elevated account', async (context) => {
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      return [{ insertId: 42 }];
    }
  };
  const server = startTestServer(pool);
  context.after(server.close);

  const response = await fetch(`${server.baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Student One',
      email: 'student@example.com',
      sapId: 'STUDENT001',
      password: 'strong-passphrase',
      role: 'admin'
    })
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.user.role, 'student');
  assert.match(queries[0].sql, /'student'/);
});
