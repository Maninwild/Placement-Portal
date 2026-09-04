'use strict';

const { createApp } = require('./src/app');
const { config } = require('./src/config');
const { pool } = require('./src/db');

const app = createApp({ pool, config });

const server = app.listen(config.port, () => {
  console.log(`Placement Portal running at http://localhost:${config.port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
