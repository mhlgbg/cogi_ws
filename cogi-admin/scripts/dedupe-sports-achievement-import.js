const path = require('node:path')

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function buildKey(row) {
  return [
    String(row?.sportsProfile?.id || ''),
    toText(row?.title),
    toText(row?.eventCode),
    toText(row?.bib),
    toText(row?.sourceReference),
    toText(row?.achievedAt),
  ].join('|')
}

async function main() {
  const tenantCode = (process.argv[2] || 'vkl').trim()
  const apply = process.argv.includes('--apply')

  const { createStrapi, compileStrapi } = require('@strapi/strapi')
  const appContext = await compileStrapi()
  const app = await createStrapi(appContext).load()
  global.strapi = app

  try {
    const tenant = await app.db.query('api::tenant.tenant').findOne({
      where: { code: { $eqi: tenantCode } },
      select: ['id', 'code', 'name'],
    })
    if (!tenant?.id) {
      throw new Error(`Tenant not found: ${tenantCode}`)
    }

    const submissions = await app.db.query('api::sports-achievement-submission.sports-achievement-submission').findMany({
      where: {
        tenant: { id: { $eq: tenant.id } },
        source: { $eq: 'import' },
        status: { $eq: 'verified' },
      },
      select: ['id', 'title', 'eventCode', 'bib', 'sourceReference', 'achievedAt', 'createdAt', 'updatedAt'],
      populate: {
        sportsProfile: { select: ['id', 'code', 'fullName'] },
        achievement: { select: ['id', 'title', 'createdAt', 'updatedAt'] },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })

    const groups = new Map()
    for (const row of submissions || []) {
      const key = buildKey(row)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(row)
    }

    const duplicateGroups = Array.from(groups.entries()).filter(([, items]) => items.length > 1)
    const plan = duplicateGroups.map(([key, items]) => {
      const sorted = items.slice().sort((a, b) => {
        const createdAtDiff = new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime()
        if (createdAtDiff !== 0) return createdAtDiff
        return Number(a?.id || 0) - Number(b?.id || 0)
      })
      const keep = sorted[0]
      const remove = sorted.slice(1)
      return {
        key,
        keep: {
          submissionId: Number(keep.id),
          achievementId: Number(keep?.achievement?.id || 0) || null,
          profileCode: toText(keep?.sportsProfile?.code),
          title: toText(keep?.title),
          sourceReference: toText(keep?.sourceReference),
          createdAt: keep?.createdAt || null,
        },
        remove: remove.map((item) => ({
          submissionId: Number(item.id),
          achievementId: Number(item?.achievement?.id || 0) || null,
          createdAt: item?.createdAt || null,
        })),
      }
    })

    const summary = {
      tenant: { id: tenant.id, code: tenant.code, name: tenant.name },
      totalVerifiedImportSubmissions: submissions.length,
      duplicateGroups: plan.length,
      duplicateRowsToRemove: plan.reduce((sum, item) => sum + item.remove.length, 0),
      sample: plan.slice(0, 20),
      applied: false,
      deletedSubmissions: 0,
      deletedAchievements: 0,
      skippedAchievementDeletes: [],
    }

    if (apply && plan.length > 0) {
      for (const item of plan) {
        for (const duplicate of item.remove) {
          await app.db.connection.transaction(async (trx) => {
            if (duplicate.achievementId) {
              const linkedSourceSubmission = await app.db.query('api::sports-achievement-submission.sports-achievement-submission').findOne({
                where: {
                  sourceAchievement: { id: { $eq: Number(duplicate.achievementId) } },
                },
                select: ['id'],
                transacting: trx,
              })
              if (!linkedSourceSubmission?.id) {
                await app.db.query('api::sports-achievement.sports-achievement').delete({
                  where: { id: Number(duplicate.achievementId) },
                  transacting: trx,
                })
                summary.deletedAchievements += 1
              } else {
                summary.skippedAchievementDeletes.push({
                  achievementId: Number(duplicate.achievementId),
                  reason: 'Referenced by sourceAchievement on another submission',
                })
              }
            }

            await app.db.query('api::sports-achievement-submission.sports-achievement-submission').delete({
              where: { id: Number(duplicate.submissionId) },
              transacting: trx,
            })
            summary.deletedSubmissions += 1
          })
        }
      }
      summary.applied = true
    }

    console.log(JSON.stringify(summary, null, 2))
  } finally {
    await app.destroy()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
