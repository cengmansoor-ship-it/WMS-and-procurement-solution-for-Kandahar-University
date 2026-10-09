import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kandahar_wms_db',
  charset: 'UTF8MB4',
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 10000,
});

export const checkDbConnection = async () => {
  try {
    const connection = await pool.getConnection();
    await connection.execute("SET NAMES utf8mb4");
    console.log('Successfully connected to the MySQL Database.');
    connection.release();
  } catch (err) {
    console.error('Failed to connect to the MySQL Database:', err);
  }
};

export default pool;
