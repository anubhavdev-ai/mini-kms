import mysql, { PoolConnection } from 'mysql2/promise';
import { config } from './config.js';

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
});

export async function initDatabase(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.query(
      `CREATE TABLE IF NOT EXISTS users (
        id CHAR(36) PRIMARY KEY,
        email VARCHAR(256) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(16) NOT NULL,
        created_at DATETIME NOT NULL
      )`
    );

    await connection.query(
      `CREATE TABLE IF NOT EXISTS \`keys\` (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(128) NOT NULL UNIQUE,
        type VARCHAR(32) NOT NULL,
        purpose VARCHAR(32) NOT NULL,
        state VARCHAR(16) NOT NULL,
        rotation_period_days INT NULL,
        grace_period_days INT NULL,
        created_at DATETIME NOT NULL,
        metadata JSON NULL,
        current_version INT NOT NULL
      )`
    );

    await connection.query(
      `CREATE TABLE IF NOT EXISTS \`key_versions\` (
        id CHAR(36) PRIMARY KEY,
        key_id CHAR(36) NOT NULL,
        version INT NOT NULL,
        state VARCHAR(16) NOT NULL,
        created_at DATETIME NOT NULL,
        not_before DATETIME NULL,
        not_after DATETIME NULL,
        wrapped_material JSON NOT NULL,
        public_key_pem TEXT NULL,
        grace_period_days INT NULL,
        UNIQUE KEY uq_key_version (key_id, version),
        CONSTRAINT fk_key_versions_keys FOREIGN KEY (key_id) REFERENCES \`keys\`(id) ON DELETE CASCADE
      )`
    );

    await connection.query(
      `CREATE TABLE IF NOT EXISTS \`grants\` (
        id CHAR(36) PRIMARY KEY,
        principal VARCHAR(128) NOT NULL,
        role VARCHAR(16) NOT NULL,
        key_id VARCHAR(64) NOT NULL,
        allowed_ops JSON NOT NULL,
        conditions JSON NULL,
        created_at DATETIME NOT NULL
      )`
    );

    await connection.query(
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id CHAR(36) PRIMARY KEY,
        timestamp DATETIME NOT NULL,
        actor VARCHAR(128) NOT NULL,
        role VARCHAR(16) NOT NULL,
        action VARCHAR(32) NOT NULL,
        request_id VARCHAR(64) NOT NULL,
        details JSON NULL,
        key_id VARCHAR(64) NULL,
        key_version INT NULL,
        prev_hash VARCHAR(128) NOT NULL,
        hash VARCHAR(128) NOT NULL,
        status VARCHAR(16) NOT NULL
      )`
    );

    await ensureIndex(connection, 'audit_logs', 'idx_audit_timestamp', '`timestamp`');
    await ensureIndex(connection, '`grants`', 'idx_grants_principal', '`principal`');
    await ensureIndex(connection, '`keys`', 'idx_keys_state', '`state`');
    await ensureIndex(connection, 'users', 'idx_users_email', '`email`');
  } finally {
    connection.release();
  }
}

async function ensureIndex(
  connection: PoolConnection,
  table: string,
  indexName: string,
  columnExpression: string
): Promise<void> {
  try {
    const tableName = table.startsWith('`') ? table : `\`${table}\``;
    await connection.query(`CREATE INDEX ${indexName} ON ${tableName} (${columnExpression})`);
  } catch (error) {
    if ((error as { code?: string }).code !== 'ER_DUP_KEYNAME') {
      throw error;
    }
  }
}
