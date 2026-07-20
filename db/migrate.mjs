/**
 * Apply db/schema.sql to MySQL.
 * Usage: node db/migrate.mjs
 * Env: MYSQL_HOST MYSQL_USER MYSQL_PASSWORD MYSQL_PORT
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST || '192.168.1.90',
  user: process.env.MYSQL_USER || 'pmii',
  password: process.env.MYSQL_PASSWORD || '123456',
  port: Number(process.env.MYSQL_PORT || 3306),
  multipleStatements: true,
})

try {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  await conn.query(sql)
  const [tables] = await conn.query('SHOW TABLES FROM game_fc')
  console.log('game_fc ready:', tables)
} finally {
  await conn.end()
}
