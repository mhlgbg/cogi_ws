const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

const ENV_FILE_PATH = path.resolve(__dirname, '..', '.env')

function log(message, payload) {
  const timestamp = new Date().toISOString()

  if (payload === undefined) {
    console.log(`[${timestamp}] ${message}`)
    return
  }

  console.log(`[${timestamp}] ${message}`, payload)
}

function loadEnvFile() {
  if (!fs.existsSync(ENV_FILE_PATH)) return

  const content = fs.readFileSync(ENV_FILE_PATH, 'utf8')
  const lines = content.split(/\r?\n/)

  lines.forEach((line) => {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith('#')) return

    const separatorIndex = trimmedLine.indexOf('=')
    if (separatorIndex <= 0) return

    const key = trimmedLine.slice(0, separatorIndex).trim()
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim()
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) return

    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2')
  })
}

function getEnv(...names) {
  for (const name of names) {
    const value = process.env[name]
    if (value && String(value).trim()) return String(value).trim()
  }

  return ''
}

function requireEnv(...names) {
  const value = getEnv(...names)
  if (!value) {
    throw new Error(`Missing required environment variable: ${names.join(' or ')}`)
  }
  return value
}

function createPostgresPool() {
  return new Pool({
    host: requireEnv('PG_HOST', 'DATABASE_HOST'),
    port: Number.parseInt(requireEnv('PG_PORT', 'DATABASE_PORT'), 10),
    database: requireEnv('PG_DATABASE', 'DATABASE_NAME'),
    user: requireEnv('PG_USER', 'DATABASE_USERNAME'),
    password: requireEnv('PG_PASSWORD', 'DATABASE_PASSWORD'),
  })
}

function normalizeStudentCode(value) {
  const text = String(value || '').trim().toUpperCase()
  return text || null
}

async function main() {
  loadEnvFile()
  const pool = createPostgresPool()

  try {
    log('Starting admission studentCode backfill')

    const rows = await pool.query(`
      SELECT id, student_code, form_data
      FROM admission_applications
      WHERE student_code IS NULL OR BTRIM(student_code) = ''
      ORDER BY id ASC
    `)

    let updatedCount = 0
    let skippedCount = 0

    for (const row of rows.rows || []) {
      const formData = row?.form_data && typeof row.form_data === 'object' ? row.form_data : null
      const studentCode = normalizeStudentCode(formData?.studentCode)
      if (!studentCode) {
        skippedCount += 1
        continue
      }

      await pool.query(
        `
          UPDATE admission_applications
          SET student_code = $2
          WHERE id = $1
        `,
        [row.id, studentCode]
      )
      updatedCount += 1
    }

    log('Admission studentCode backfill completed', {
      totalCandidates: rows.rowCount || 0,
      updatedCount,
      skippedCount,
    })
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(`[${new Date().toISOString()}] Admission studentCode backfill failed:`)
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})