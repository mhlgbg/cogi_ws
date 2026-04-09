const { MongoClient } = require('mongodb')
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const MONGO_DATABASE_NAME = 'vines'
const MONGO_COLLECTION_NAME = 'debts'
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
  if (!fs.existsSync(ENV_FILE_PATH)) {
    return
  }

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

    const unquotedValue = rawValue.replace(/^(['"])(.*)\1$/, '$2')
    process.env[key] = unquotedValue
  })
}

function getEnv(...names) {
  for (const name of names) {
    const value = process.env[name]
    if (value && String(value).trim()) {
      return String(value).trim()
    }
  }

  return ''
}

function requireEnv(...names) {
  const value = getEnv(...names)
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${names.join(' or ')}`)
  }
  return String(value).trim()
}

async function testMongoConnection() {
  const mongoUri = requireEnv('MONGO_URI')
  const mongoClient = new MongoClient(mongoUri)

  try {
    await mongoClient.connect()
    log('Mongo connected')

    const database = mongoClient.db(MONGO_DATABASE_NAME)
    const debtsCollection = database.collection(MONGO_COLLECTION_NAME)

    const totalDebtsCount = await debtsCollection.countDocuments()
    const sampleDebts = await debtsCollection.find({}).limit(5).toArray()

    log(`Total debts count: ${totalDebtsCount}`)
    log('Sample debts (5 records max):', sampleDebts)
  } finally {
    await mongoClient.close()
    log('Mongo connection closed')
  }
}

async function testPostgresConnection() {
  const pool = new Pool({
    host: requireEnv('PG_HOST', 'DATABASE_HOST'),
    port: Number.parseInt(requireEnv('PG_PORT', 'DATABASE_PORT'), 10),
    database: requireEnv('PG_DATABASE', 'DATABASE_NAME'),
    user: requireEnv('PG_USER', 'DATABASE_USERNAME'),
    password: requireEnv('PG_PASSWORD', 'DATABASE_PASSWORD'),
  })

  try {
    const result = await pool.query('SELECT NOW() AS current_timestamp')
    log('Postgres connected')
    log('Current timestamp from Postgres:', result.rows[0]?.current_timestamp ?? null)
  } finally {
    await pool.end()
    log('Postgres connection closed')
  }
}

async function main() {
  const startedAt = Date.now()
  loadEnvFile()
  log('Starting connectivity test')

  try {
    await testMongoConnection()
    await testPostgresConnection()
    log(`Connectivity test finished in ${Date.now() - startedAt}ms`)
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Connectivity test failed:`)
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

main()