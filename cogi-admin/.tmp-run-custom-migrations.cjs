const fs = require('fs')
const path = require('path')
const { createStrapi, compileStrapi } = require('@strapi/strapi')

process.env.STRAVA_SYNC_RUNNER_ENABLED = 'false'
process.env.STRAVA_WEBHOOK_RUNNER_ENABLED = 'false'

async function main() {
  const resultPath = path.join(process.cwd(), '.tmp-run-custom-migrations.result.json')
  const appContext = await compileStrapi()
  const app = await createStrapi(appContext).load()
  app.log.level = 'error'

  try {
    const result = await app.db.connection.migrate.latest({
      directory: path.join(process.cwd(), 'database', 'migrations'),
      tableName: 'knex_migrations',
    })
    const payload = { ok: true, batch: result[0], migrations: result[1] }
    fs.writeFileSync(resultPath, JSON.stringify(payload, null, 2))
    console.log(JSON.stringify(payload, null, 2))
    await app.destroy()
    process.exit(0)
  } catch (error) {
    fs.writeFileSync(resultPath, JSON.stringify({
      ok: false,
      message: String(error?.message || error),
      stack: String(error?.stack || ''),
      code: error?.code || null,
    }, null, 2))
    console.error('[run-custom-migrations] failed', error)
    await app.destroy()
    process.exit(1)
  }
}

main()