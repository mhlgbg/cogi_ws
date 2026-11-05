const GAME_TYPE_UID = 'api::game-type.game-type';
const XP_CHALLENGE_CODE = 'xp_challenge';
const GHOST_RACE_CODE = 'ghost_race';

const DEFAULT_SETTINGS = {
  rules: [
    {
      activityCode: 'daily_active',
      xpAmount: 5,
      maxCount: 1,
      limitPeriod: 'daily',
      isEnabled: true,
    },
    {
      activityCode: 'community_post',
      xpAmount: 10,
      maxCount: 5,
      limitPeriod: 'daily',
      isEnabled: true,
    },
    {
      activityCode: 'community_comment',
      xpAmount: 3,
      maxCount: 5,
      limitPeriod: 'daily',
      isEnabled: true,
    },
  ],
};

const GHOST_RACE_DEFAULT_SETTINGS = {
  distanceMeters: 200,
  cutoffSeconds: 120,
  playPlatform: 'web',
  physicsVersion: 'v1',
  trackVersion: 'v1',
  rulesVersion: 'v1',
  countdown: {
    onYourMarksMs: 900,
    setMs: 900,
    goHoldMs: 500,
  },
};

export async function seedGameTypes(strapi: any) {
  const definitions = [
    {
      code: XP_CHALLENGE_CODE,
      name: 'XP Challenge',
      description: 'Tenant-scoped challenge game with configurable XP rules for daily activity and community engagement.',
      defaultSettings: DEFAULT_SETTINGS,
    },
    {
      code: GHOST_RACE_CODE,
      name: 'Ghost Race',
      description: 'Deterministic rhythm runner with attempt submission, replay verification, and ghost race progression.',
      defaultSettings: GHOST_RACE_DEFAULT_SETTINGS,
    },
  ];

  for (const definition of definitions) {
    const existing = await strapi.db.query(GAME_TYPE_UID).findOne({
      where: { code: definition.code },
      select: ['id', 'code'],
    });

    if (existing?.id) {
      await strapi.db.query(GAME_TYPE_UID).update({
        where: { id: Number(existing.id) },
        data: {
          name: definition.name,
          description: definition.description,
          status: 'active',
          isBuiltIn: true,
          defaultSettings: definition.defaultSettings,
        },
      });
      strapi.log.info(`[bootstrap] Game type ${definition.code} verified`);
      continue;
    }

    await strapi.db.query(GAME_TYPE_UID).create({
      data: {
        code: definition.code,
        name: definition.name,
        description: definition.description,
        status: 'active',
        isBuiltIn: true,
        defaultSettings: definition.defaultSettings,
      },
    });

    strapi.log.info(`[bootstrap] Game type ${definition.code} seeded`);
  }
}
