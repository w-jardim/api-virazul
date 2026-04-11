const mysql = require('mysql2/promise');

function getTestDbConfig() {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || 'viraazul_test',
    user: process.env.DB_USER || 'viraazul_user',
    password: process.env.DB_PASSWORD || 'virazul_pass',
  };
}

function getAdminDbConfig() {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_ADMIN_USER || process.env.DB_USER || 'viraazul_user',
    password: process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD || 'virazul_pass',
  };
}

async function tryCreateConnection(config) {
  try {
    return await mysql.createConnection(config);
  } catch (error) {
    return null;
  }
}

async function ensureDedicatedUserAndGrants(connection, database, user, password) {
  const escUser = connection.escape(user);
  const escPassword = connection.escape(password);
  const escDb = `\`${String(database).replace(/`/g, '``')}\``;

  await connection.query(`CREATE USER IF NOT EXISTS ${escUser}@'%' IDENTIFIED BY ${escPassword}`);
  await connection.query(
    `CREATE USER IF NOT EXISTS ${escUser}@'localhost' IDENTIFIED BY ${escPassword}`
  );
  await connection.query(`GRANT ALL PRIVILEGES ON ${escDb}.* TO ${escUser}@'%'`);
  await connection.query(`GRANT ALL PRIVILEGES ON ${escDb}.* TO ${escUser}@'localhost'`);
  await connection.query('FLUSH PRIVILEGES');
}

async function ensureTestDatabase() {
  const config = getTestDbConfig();
  const adminConfig = getAdminDbConfig();
  let connection;

  try {
    connection =
      (await tryCreateConnection({
        host: adminConfig.host,
        port: adminConfig.port,
        user: adminConfig.user,
        password: adminConfig.password,
        multipleStatements: true,
      })) ||
      (await tryCreateConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        multipleStatements: true,
      }));

    if (!connection) {
      throw new Error('nao foi possivel autenticar com usuario de teste nem admin');
    }

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);

    if (adminConfig.user !== config.user || adminConfig.password !== config.password) {
      await ensureDedicatedUserAndGrants(
        connection,
        config.database,
        config.user,
        config.password
      );
    }
  } catch (error) {
    throw new Error(
      [
        'Falha ao preparar banco de teste.',
        `host=${config.host} port=${config.port} db=${config.database} test_user=${config.user}`,
        `admin_user=${adminConfig.user}`,
        `motivo=${error.message}`,
      ].join(' ')
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function validateTestDbConnection(pool) {
  const config = getTestDbConfig();
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    throw new Error(
      [
        'Falha de conexao com MySQL de teste.',
        `host=${config.host} port=${config.port} db=${config.database} user=${config.user}`,
        `motivo=${error.message}`,
      ].join(' ')
    );
  }
}

module.exports = {
  getTestDbConfig,
  ensureTestDatabase,
  validateTestDbConnection,
};
