const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { db } = require('../src/config/env');

async function ensureMigrationsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedMigrations(connection) {
  const [rows] = await connection.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((r) => r.filename));
}

async function recordMigration(connection, filename) {
  await connection.query(
    'INSERT IGNORE INTO schema_migrations (filename) VALUES (?)',
    [filename]
  );
}

async function tableExists(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS cnt
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name   = ?`,
    [tableName]
  );
  return rows[0].cnt > 0;
}

// Extract leading integer from filename (handles "022b_..." → 22, "033_..." → 33)
function migrationNumber(filename) {
  return parseInt(filename, 10);
}

async function runMigrations() {
  const migrationsDir = path.resolve(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const connection = await mysql.createConnection({
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    database: db.database,
    multipleStatements: true,
  });

  try {
    await ensureMigrationsTable(connection);

    const applied = await getAppliedMigrations(connection);

    // First run on an existing database: backfill history for pre-tracking migrations.
    // We detect "existing DB" by checking for the `payments` table (created by 028).
    // All migrations numbered ≤ 032 are considered already applied; newer ones run normally.
    if (applied.size === 0 && (await tableExists(connection, 'payments'))) {
      console.log('Existing database detected. Backfilling migration history for 001–032...');
      for (const file of files) {
        if (migrationNumber(file) <= 32) {
          await recordMigration(connection, file);
          applied.add(file);
          console.log(`  Backfilled: ${file}`);
        }
      }
    }

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`Skipping (already applied): ${file}`);
        continue;
      }

      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, 'utf8').trim();

      if (!sql) continue;

      console.log(`Running migration: ${file}`);
      await connection.query(sql);
      await recordMigration(connection, file);
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
