import { readFile } from 'node:fs/promises'
import { neon } from '@neondatabase/serverless'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

const sql = neon(databaseUrl)
const source = await readFile(new URL('../migrations/001_vercel_core.sql', import.meta.url), 'utf8')
const statements = source
  .split(/;\s*(?:\r?\n|$)/)
  .map(statement => statement.trim())
  .filter(Boolean)

for (const statement of statements) await sql.query(statement)

const rows = await sql`SELECT version, name FROM app_migrations ORDER BY version`
console.log(`Applied migrations: ${rows.map(row => `${row.version}:${row.name}`).join(', ')}`)
