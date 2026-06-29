const USER_UID = 'plugin::users-permissions.user';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const USER_TENANT_ROLE_UID = 'api::user-tenant-role.user-tenant-role';
const SURVEY_ASSIGNMENT_UID = 'api::survey-assignment.survey-assignment';
const SURVEY_RESPONSE_UID = 'api::survey-response.survey-response';
const SURVEY_ANSWER_UID = 'api::survey-answer.survey-answer';
const CLEANUP_LOG_UID = 'api::user-duplicate-cleanup-log.user-duplicate-cleanup-log';

function toPositiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toText(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeUsername(value: unknown) {
  return toText(value).toLowerCase();
}

function uniquePositiveNumbers(values: unknown[]) {
  const seen = new Set<number>();
  const result: number[] = [];

  for (const value of values) {
    const parsed = toPositiveInt(value);
    if (!parsed || seen.has(parsed)) continue;
    seen.add(parsed);
    result.push(parsed);
  }

  return result;
}

function compareKeepCandidate(a: any, b: any) {
  const responseDiff = Number(b?.surveyResponsesCount || 0) - Number(a?.surveyResponsesCount || 0);
  if (responseDiff !== 0) return responseDiff;

  const assignmentDiff = Number(b?.surveyAssignmentsCount || 0) - Number(a?.surveyAssignmentsCount || 0);
  if (assignmentDiff !== 0) return assignmentDiff;

  const roleDiff = Number(b?.userTenantRolesCount || 0) - Number(a?.userTenantRolesCount || 0);
  if (roleDiff !== 0) return roleDiff;

  const createdAtA = a?.createdAt ? new Date(a.createdAt).getTime() : Number.POSITIVE_INFINITY;
  const createdAtB = b?.createdAt ? new Date(b.createdAt).getTime() : Number.POSITIVE_INFINITY;
  if (createdAtA !== createdAtB) return createdAtA - createdAtB;

  return Number(a?.id || 0) - Number(b?.id || 0);
}

async function tableExists(knex: any, tableName: string) {
  return knex.schema.hasTable(tableName);
}

async function columnExists(knex: any, tableName: string, columnName: string) {
  try {
    return await knex.schema.hasColumn(tableName, columnName);
  } catch {
    return false;
  }
}

async function deleteByColumnIfTableExists(knex: any, tableName: string, columnName: string, ids: number[]) {
  if (!ids.length) return 0;
  if (!(await tableExists(knex, tableName))) return 0;
  if (!(await columnExists(knex, tableName, columnName))) return 0;

  return knex(tableName).whereIn(columnName, ids).del();
}

async function findTenantUserRows(tenantId: number, username?: string | null) {
  const where: any = {
    tenant: tenantId,
  };

  const normalizedUsername = normalizeUsername(username);
  if (normalizedUsername) {
    where.user = {
      username: {
        $eqi: normalizedUsername,
      },
    };
  }

  return strapi.db.query(USER_TENANT_UID).findMany({
    where,
    select: ['id', 'createdAt', 'updatedAt'],
    populate: {
      user: {
        select: ['id', 'username', 'email', 'fullName', 'createdAt', 'updatedAt'],
      },
      userTenantRoles: {
        where: {
          userTenantRoleStatus: 'active',
        },
        select: ['id', 'userTenantRoleStatus'],
        populate: {
          role: {
            select: ['id', 'name', 'type'],
          },
        },
      },
    },
  });
}

async function countByField(uid: string, whereField: string, ids: number[], tenantId: number) {
  const result = new Map<number, number>();
  for (const id of ids) {
    result.set(id, 0);
  }

  if (ids.length === 0) return result;

  const rows = await strapi.db.query(uid).findMany({
    where: {
      tenant: tenantId,
      [whereField]: {
        id: {
          $in: ids,
        },
      },
    },
    select: ['id'],
    populate: {
      [whereField]: {
        select: ['id'],
      },
    },
  });

  for (const row of rows || []) {
    const relatedId = toPositiveInt(row?.[whereField]?.id);
    if (!relatedId) continue;
    result.set(relatedId, Number(result.get(relatedId) || 0) + 1);
  }

  return result;
}

async function countSurveyAssignments(userIds: number[], tenantId: number) {
  return countByField(SURVEY_ASSIGNMENT_UID, 'respondent', userIds, tenantId);
}

async function countSurveyResponses(userIds: number[], tenantId: number) {
  const result = new Map<number, number>();
  for (const id of userIds) {
    result.set(id, 0);
  }

  if (userIds.length === 0) return result;

  const rows = await strapi.db.query(SURVEY_RESPONSE_UID).findMany({
    where: {
      tenant: tenantId,
      survey_assignment: {
        respondent: {
          id: {
            $in: userIds,
          },
        },
      },
    },
    select: ['id'],
    populate: {
      survey_assignment: {
        select: ['id'],
        populate: {
          respondent: {
            select: ['id'],
          },
        },
      },
    },
  });

  for (const row of rows || []) {
    const relatedId = toPositiveInt(row?.survey_assignment?.respondent?.id);
    if (!relatedId) continue;
    result.set(relatedId, Number(result.get(relatedId) || 0) + 1);
  }

  return result;
}

function buildPreviewGroups(userTenantRows: any[], surveyAssignmentsByUserId: Map<number, number>, surveyResponsesByUserId: Map<number, number>) {
  const groups = new Map<string, any[]>();
  const entriesByUserId = new Map<number, any>();

  for (const row of userTenantRows || []) {
    const user = row?.user;
    const userId = toPositiveInt(user?.id);
    const username = normalizeUsername(user?.username);
    if (!userId || !username) continue;

    const nextRoles = Array.isArray(row?.userTenantRoles)
      ? row.userTenantRoles.map((item: any) => ({
          id: toPositiveInt(item?.id),
          roleId: toPositiveInt(item?.role?.id),
          roleName: toText(item?.role?.name || item?.role?.type),
        }))
      : [];

    const existingEntry = entriesByUserId.get(userId);
    if (existingEntry) {
      existingEntry.userTenantIds = uniquePositiveNumbers([...(existingEntry.userTenantIds || []), row?.id]);
      existingEntry.userTenantRoles = [
        ...(Array.isArray(existingEntry.userTenantRoles) ? existingEntry.userTenantRoles : []),
        ...nextRoles,
      ].filter((item: any) => item?.id);
      existingEntry.userTenantRolesCount = uniquePositiveNumbers(existingEntry.userTenantRoles.map((item: any) => item?.id)).length;
      continue;
    }

    const entry = {
      id: userId,
      username: toText(user?.username),
      normalizedUsername: username,
      email: toText(user?.email),
      fullName: toText(user?.fullName),
      createdAt: user?.createdAt || row?.createdAt || null,
      userTenantId: toPositiveInt(row?.id),
      userTenantIds: uniquePositiveNumbers([row?.id]),
      surveyAssignmentsCount: Number(surveyAssignmentsByUserId.get(userId) || 0),
      surveyResponsesCount: Number(surveyResponsesByUserId.get(userId) || 0),
      userTenantRolesCount: nextRoles.filter((item: any) => item?.id).length,
      userTenantRoles: nextRoles,
    };

    entriesByUserId.set(userId, entry);

    const existing = groups.get(username) || [];
    existing.push(entry);
    groups.set(username, existing);
  }

  return Array.from(groups.values())
    .filter((items) => items.length >= 2)
    .map((items) => {
      const sorted = items.slice().sort(compareKeepCandidate);
      const keepUser = sorted[0];
      const deleteCandidates = sorted.slice(1);
      const totalAssignments = sorted.reduce((sum, item) => sum + Number(item.surveyAssignmentsCount || 0), 0);
      const totalResponses = sorted.reduce((sum, item) => sum + Number(item.surveyResponsesCount || 0), 0);

      return {
        username: keepUser?.username || items[0]?.username || '',
        normalizedUsername: keepUser?.normalizedUsername || items[0]?.normalizedUsername || '',
        duplicateCount: sorted.length,
        keepUserId: keepUser?.id || null,
        totalSurveyAssignments: totalAssignments,
        totalSurveyResponses: totalResponses,
        cleanupStatus: deleteCandidates.length > 0 ? 'preview' : 'no-action',
        members: sorted,
        deleteCandidates: deleteCandidates.map((item) => item.id),
      };
    })
    .sort((a, b) => a.normalizedUsername.localeCompare(b.normalizedUsername));
}

export async function scanTenantDuplicateUsers(options: { tenantId: number; username?: string | null }) {
  const tenantId = toPositiveInt(options?.tenantId);
  if (!tenantId) {
    throw new Error('tenantId is required');
  }

  const userTenantRows = await findTenantUserRows(tenantId, options?.username || null);
  const userIds = uniquePositiveNumbers((userTenantRows || []).map((item: any) => item?.user?.id));

  const [surveyAssignmentsByUserId, surveyResponsesByUserId] = await Promise.all([
    countSurveyAssignments(userIds, tenantId),
    countSurveyResponses(userIds, tenantId),
  ]);

  const groups = buildPreviewGroups(userTenantRows || [], surveyAssignmentsByUserId, surveyResponsesByUserId);

  return {
    ok: true,
    data: groups,
    meta: {
      tenantId,
      username: toText(options?.username),
      groupCount: groups.length,
      duplicateUserCount: groups.reduce((sum, group) => sum + Number(group?.duplicateCount || 0), 0),
      scannedAt: new Date().toISOString(),
    },
  };
}

async function findPreviewGroupOrThrow(tenantId: number, username: string) {
  const preview = await scanTenantDuplicateUsers({ tenantId, username });
  const group = Array.isArray(preview?.data)
    ? preview.data.find((item: any) => normalizeUsername(item?.username) === normalizeUsername(username))
    : null;

  if (!group) {
    throw new Error('Duplicate group not found or no longer duplicated');
  }

  return group;
}

async function collectDeleteUserIdsForCleanup(options: { tenantId: number; username?: string | null; keepUserId?: unknown }) {
  const tenantId = toPositiveInt(options?.tenantId);
  if (!tenantId) throw new Error('tenantId is required');

  const group = await findPreviewGroupOrThrow(tenantId, toText(options?.username));
  const expectedKeepUserId = toPositiveInt(options?.keepUserId);
  const actualKeepUserId = toPositiveInt(group?.keepUserId);

  if (!actualKeepUserId) {
    throw new Error('Unable to resolve keepUserId');
  }

  if (expectedKeepUserId && expectedKeepUserId !== actualKeepUserId) {
    throw new Error(`Preview is outdated. Suggested keepUserId has changed to ${actualKeepUserId}`);
  }

  return {
    group,
    keepUserId: actualKeepUserId,
    deleteUserIds: uniquePositiveNumbers(group?.deleteCandidates || []),
  };
}

async function deleteSurveyDataForUser(knex: any, tenantId: number, userId: number) {
  const assignmentRows = await knex('survey_assignments_respondent_lnk as sar')
    .innerJoin('survey_assignments_tenant_lnk as sat', 'sat.survey_assignment_id', 'sar.survey_assignment_id')
    .where('sar.user_id', userId)
    .andWhere('sat.tenant_id', tenantId)
    .distinct('sar.survey_assignment_id as id');
  const assignmentIds = uniquePositiveNumbers((assignmentRows || []).map((row: any) => row?.id));

  const responseRows = assignmentIds.length > 0
    ? await knex('survey_responses_survey_assignment_lnk as rsa')
        .innerJoin('survey_responses_tenant_lnk as rst', 'rst.survey_response_id', 'rsa.survey_response_id')
        .whereIn('rsa.survey_assignment_id', assignmentIds)
        .andWhere('rst.tenant_id', tenantId)
        .distinct('rsa.survey_response_id as id')
    : [];
  const responseIds = uniquePositiveNumbers((responseRows || []).map((row: any) => row?.id));

  const answerRows = responseIds.length > 0
    ? await knex('survey_answers_survey_response_lnk as asr')
        .innerJoin('survey_answers_tenant_lnk as ast', 'ast.survey_answer_id', 'asr.survey_answer_id')
        .whereIn('asr.survey_response_id', responseIds)
        .andWhere('ast.tenant_id', tenantId)
        .distinct('asr.survey_answer_id as id')
    : [];
  const answerIds = uniquePositiveNumbers((answerRows || []).map((row: any) => row?.id));

  const deletedAnswerLinks = {
    survey_answers_survey_question_lnk: await deleteByColumnIfTableExists(knex, 'survey_answers_survey_question_lnk', 'survey_answer_id', answerIds),
    survey_answers_survey_question_option_lnk: await deleteByColumnIfTableExists(knex, 'survey_answers_survey_question_option_lnk', 'survey_answer_id', answerIds),
    survey_answers_survey_response_lnk: await deleteByColumnIfTableExists(knex, 'survey_answers_survey_response_lnk', 'survey_answer_id', answerIds),
    survey_answers_tenant_lnk: await deleteByColumnIfTableExists(knex, 'survey_answers_tenant_lnk', 'survey_answer_id', answerIds),
  };

  const deletedAnswers = answerIds.length > 0 ? await knex('survey_answers').whereIn('id', answerIds).del() : 0;

  const deletedResponseLinks = {
    survey_responses_survey_assignment_lnk: await deleteByColumnIfTableExists(knex, 'survey_responses_survey_assignment_lnk', 'survey_response_id', responseIds),
    survey_responses_tenant_lnk: await deleteByColumnIfTableExists(knex, 'survey_responses_tenant_lnk', 'survey_response_id', responseIds),
  };

  const deletedResponses = responseIds.length > 0 ? await knex('survey_responses').whereIn('id', responseIds).del() : 0;

  const deletedAssignmentLinks = {
    survey_assignments_respondent_lnk: await deleteByColumnIfTableExists(knex, 'survey_assignments_respondent_lnk', 'survey_assignment_id', assignmentIds),
    survey_assignments_tenant_lnk: await deleteByColumnIfTableExists(knex, 'survey_assignments_tenant_lnk', 'survey_assignment_id', assignmentIds),
    survey_assignments_survey_campaign_lnk: await deleteByColumnIfTableExists(knex, 'survey_assignments_survey_campaign_lnk', 'survey_assignment_id', assignmentIds),
  };

  const deletedAssignments = assignmentIds.length > 0 ? await knex('survey_assignments').whereIn('id', assignmentIds).del() : 0;

  return {
    assignmentIds,
    responseIds,
    answerIds,
    deletedAssignments,
    deletedResponses,
    deletedAnswers,
    deletedAnswerLinks,
    deletedResponseLinks,
    deletedAssignmentLinks,
  };
}

async function cleanupUserTenantData(knex: any, tenantId: number, userId: number) {
  const userTenantRows = await knex('user_tenants_user_lnk as utu')
    .innerJoin('user_tenants_tenant_lnk as utt', 'utt.user_tenant_id', 'utu.user_tenant_id')
    .where('utu.user_id', userId)
    .andWhere('utt.tenant_id', tenantId)
    .distinct('utu.user_tenant_id as id');
  const userTenantIds = uniquePositiveNumbers((userTenantRows || []).map((row: any) => row?.id));

  const userTenantRoleRows = userTenantIds.length > 0
    ? await knex('user_tenant_roles_user_tenant_lnk')
        .whereIn('user_tenant_id', userTenantIds)
        .distinct('user_tenant_role_id as id')
    : [];
  const userTenantRoleIds = uniquePositiveNumbers((userTenantRoleRows || []).map((row: any) => row?.id));

  const deletedUserTenantRoleLinks = {
    user_tenant_roles_user_tenant_lnk: await deleteByColumnIfTableExists(knex, 'user_tenant_roles_user_tenant_lnk', 'user_tenant_role_id', userTenantRoleIds),
    user_tenant_roles_role_lnk: await deleteByColumnIfTableExists(knex, 'user_tenant_roles_role_lnk', 'user_tenant_role_id', userTenantRoleIds),
  };

  const deletedUserTenantRoles = userTenantRoleIds.length > 0
    ? await knex('user_tenant_roles').whereIn('id', userTenantRoleIds).del()
    : 0;

  const deletedUserTenantLinks = {
    user_tenants_tenant_lnk: await deleteByColumnIfTableExists(knex, 'user_tenants_tenant_lnk', 'user_tenant_id', userTenantIds),
    user_tenants_user_lnk: await deleteByColumnIfTableExists(knex, 'user_tenants_user_lnk', 'user_tenant_id', userTenantIds),
  };

  const deletedUserTenants = userTenantIds.length > 0
    ? await knex('user_tenants').whereIn('id', userTenantIds).del()
    : 0;

  return {
    userTenantIds,
    userTenantRoleIds,
    deletedUserTenantRoles,
    deletedUserTenantRoleLinks,
    deletedUserTenants,
    deletedUserTenantLinks,
  };
}

async function cleanupUserRoleLinks(knex: any, userId: number) {
  return deleteByColumnIfTableExists(knex, 'up_users_role_lnk', 'user_id', [userId]);
}

async function countOtherTenantMemberships(userId: number, tenantId: number) {
  const row = await strapi.db.connection('user_tenants_user_lnk as utu')
    .innerJoin('user_tenants_tenant_lnk as utt', 'utt.user_tenant_id', 'utu.user_tenant_id')
    .where('utu.user_id', userId)
    .whereNot('utt.tenant_id', tenantId)
    .countDistinct({ count: 'utu.user_tenant_id' })
    .first();

  return Number(row?.count || 0);
}

async function logCleanupReport(data: any) {
  try {
    await strapi.db.query(CLEANUP_LOG_UID).create({
      data,
    });
  } catch (error) {
    strapi.log.warn(`[user-duplicate-cleanup] Failed to persist cleanup log: ${error instanceof Error ? error.message : String(error)}`);
  }

  strapi.log.info(`[user-duplicate-cleanup] ${JSON.stringify(data)}`);
}

async function cleanupDuplicateGroup(options: { tenantId: number; username: string; keepUserId?: unknown }) {
  const tenantId = toPositiveInt(options?.tenantId);
  const username = toText(options?.username);
  if (!tenantId) throw new Error('tenantId is required');
  if (!username) throw new Error('username is required');

  const { group, keepUserId, deleteUserIds } = await collectDeleteUserIdsForCleanup({
    tenantId,
    username,
    keepUserId: options?.keepUserId,
  });

  const deletedUserIds: number[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  let deletedAssignments = 0;
  let deletedResponses = 0;
  let deletedAnswers = 0;

  await strapi.db.connection.transaction(async (trx: any) => {
    const knex = trx;

    for (const deleteUserId of deleteUserIds) {
      try {
        const otherTenantMembershipCount = Number(await countOtherTenantMemberships(deleteUserId, tenantId) || 0);
        const surveyCleanup = await deleteSurveyDataForUser(knex, tenantId, deleteUserId);
        deletedAssignments += Number(surveyCleanup.deletedAssignments || 0);
        deletedResponses += Number(surveyCleanup.deletedResponses || 0);
        deletedAnswers += Number(surveyCleanup.deletedAnswers || 0);

        await cleanupUserTenantData(knex, tenantId, deleteUserId);
        await cleanupUserRoleLinks(knex, deleteUserId);

        if (otherTenantMembershipCount > 0) {
          warnings.push(`User ${deleteUserId} still belongs to ${otherTenantMembershipCount} tenant membership(s); kept up_users row.`);
          continue;
        }

        await knex('up_users').where({ id: deleteUserId }).del();
        deletedUserIds.push(deleteUserId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to cleanup user ${deleteUserId}: ${message}`);
        throw error;
      }
    }
  });

  const cleanupStatus = errors.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'success';
  const report = {
    username,
    keepUserId,
    deletedUserIds,
    deletedAssignments,
    deletedResponses,
    deletedAnswers,
    warnings,
    errors,
    cleanupStatus,
    tenantId,
    previewGroup: group,
    cleanedAt: new Date().toISOString(),
  };

  await logCleanupReport(report);

  return report;
}

export async function cleanupOneTenantDuplicateGroup(options: { tenantId: number; username: string; keepUserId?: unknown }) {
  const report = await cleanupDuplicateGroup(options);
  return {
    ok: report.cleanupStatus !== 'failed',
    report,
  };
}

export async function cleanupAllTenantDuplicateGroups(options: { tenantId: number; username?: string | null }) {
  const tenantId = toPositiveInt(options?.tenantId);
  if (!tenantId) throw new Error('tenantId is required');

  const preview = await scanTenantDuplicateUsers({ tenantId, username: options?.username || null });
  const groups = Array.isArray(preview?.data) ? preview.data : [];
  const reports = [];

  for (const group of groups) {
    const report = await cleanupDuplicateGroup({
      tenantId,
      username: toText(group?.username),
      keepUserId: group?.keepUserId,
    });
    reports.push(report);
  }

  return {
    ok: reports.every((item: any) => item?.cleanupStatus !== 'failed'),
    reports,
    meta: {
      tenantId,
      processedGroups: reports.length,
      successGroups: reports.filter((item: any) => item?.cleanupStatus === 'success').length,
      warningGroups: reports.filter((item: any) => item?.cleanupStatus === 'warning').length,
      failedGroups: reports.filter((item: any) => item?.cleanupStatus === 'failed').length,
      cleanedAt: new Date().toISOString(),
    },
  };
}