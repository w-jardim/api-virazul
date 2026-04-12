const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { db } = require('../src/config/env');

async function runMigrations() {
  const migrationsDir = path.resolve(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  // Use a dedicated connection with multipleStatements enabled to execute complex SQL files
  const connection = await mysql.createConnection({
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    database: db.database,
    multipleStatements: true,
  });

  try {
    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, 'utf8').trim();

      if (!sql) {
        continue;
      }

      console.log(`Running migration: ${file}`);
      await connection.query(sql);
    }
  } finally {
    await connection.end();
  }

  console.log('Migrations finished successfully.');
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}

module.exports = runMigrations;
