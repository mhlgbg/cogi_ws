require('dotenv').config()
const { Client } = require('pg')

async function main() {
  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT || 5432),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  })
  await client.connect()
  const result = await client.query(`
    select sal.sports_achievement_id as source_achievement_id,
           s.status,
           count(*)::int as duplicate_count,
           array_agg(s.id order by s.id desc) as submission_ids
    from sports_achievement_submissions s
    join sports_achievement_submissions_source_achievement_lnk sal
      on sal.sports_achievement_submission_id = s.id
    group by sal.sports_achievement_id, s.status
    having count(*) > 1
    order by sal.sports_achievement_id desc, s.status asc
  `)
  console.log(JSON.stringify(result.rows, null, 2))
  await client.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
