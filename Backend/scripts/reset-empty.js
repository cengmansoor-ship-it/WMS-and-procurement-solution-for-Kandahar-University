const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const database = process.env.DB_NAME || 'kandahar_db';

function quoteIdentifier(identifier) {
  return `\`${String(identifier).replace(/`/g, '``')}\``;
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database,
    multipleStatements: false,
  });

  try {
    const [rows] = await connection.query(
      `
        SELECT TABLE_NAME AS tableName
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = ?
          AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
      `,
      [database],
    );

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const row of rows) {
      await connection.query(`TRUNCATE TABLE ${quoteIdentifier(row.tableName)}`);
      console.log(`[RESET] Emptied ${row.tableName}`);
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log(`[RESET] Database "${database}" is now empty. Tables kept: ${rows.length}`);
  } finally {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => undefined);
    await connection.end();
  }
}

main().catch((err) => {
  console.error('[RESET] Failed:', err.message);
  process.exit(1);
});
