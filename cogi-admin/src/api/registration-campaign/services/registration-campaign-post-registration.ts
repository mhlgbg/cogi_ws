import { toText, whereByParam } from '../../../utils/tenant-scope'
import { HttpError } from './registration-campaign'
import { linkTenantSportsProfileUser } from '../../sports-profile/services/sports-profile'

const REGISTRATION_CAMPAIGN_UID = 'api::registration-campaign.registration-campaign'
const CAMPAIGN_REGISTRATION_UID = 'api::campaign-registration.campaign-registration'
const TENANT_FEATURE_UID = 'api::tenant-feature.tenant-feature'
const SPORTS_PROFILE_UID = 'api::sports-profile.sports-profile'
const POST_PROCESS_AUDIT_UID = 'api::registration-campaign-post-process-audit.registration-campaign-post-process-audit'
const SPORTS_PROFILE_FEATURE_KEY = 'sports-profile.manage'

const RECONCILIATION_STATUS = {
  READY_TO_LINK: 'ready_to_link',
  ALREADY_LINKED_CORRECT: 'already_linked_correct',
  ALREADY_LINKED_DIFFERENT_CODE: 'already_linked_different_code',
  PROFILE_NOT_FOUND: 'profile_not_found',
  PROFILE_CODE_NOT_UNIQUE: 'profile_code_not_unique',
  USER_LINKED_TO_OTHER_PROFILE: 'user_linked_to_other_profile',
  PROFILE_LINKED_TO_OTHER_USER: 'profile_linked_to_other_user',
  NOT_ELIGIBLE: 'not_eligible',
  NEED_MANUAL_REVIEW: 'need_manual_review',
} as const

type ReconciliationStatusKey = typeof RECONCILIATION_STATUS[keyof typeof RECONCILIATION_STATUS]

type GenericRecord = Record<string, unknown>

function httpError(status: number, message: string, code?: string): never {
  throw new HttpError(status, message, code)
}

function normalizeText(value: unknown): string {
  return toText(value)
}

function normalizeStatus(value: unknown): string {
  return normalizeText(value).toLowerCase()
}

function normalizePositiveInteger(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function normalizeMemberCode(value: unknown): string | null {
  const text = normalizeText(value).toUpperCase()
  return text || null
}

function normalizeCompactMemberCode(value: unknown): string | null {
  const text = normalizeText(value).toUpperCase().replace(/\s+/g, '')
  return text || null
}

function normalizeComparableName(value: unknown): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function getNonDeletedWhere() {
  return {
    $or: [
      { isDeleted: false },
      { isDeleted: { $null: true } },
    ],
  }
}

export function toCampaignPostRegistrationConfig(value: unknown) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as GenericRecord
    : {}
  const sportsProfileSource = source.sportsProfileLink && typeof source.sportsProfileLink === 'object' && !Array.isArray(source.sportsProfileLink)
    ? source.sportsProfileLink as GenericRecord
    : {}

  const formFieldKey = normalizeText(sportsProfileSource.formFieldKey)
  const enabled = Object.prototype.hasOwnProperty.call(sportsProfileSource, 'enabled')
    ? String(sportsProfileSource.enabled).toLowerCase() === 'true'
    : Boolean(formFieldKey)

  return {
    sportsProfileLink: {
      enabled,
      formFieldKey: formFieldKey || null,
    },
  }
}

export function normalizeCampaignPostRegistrationConfigInput(payloadValue: unknown, fallbackValue: unknown) {
  const fallback = toCampaignPostRegistrationConfig(fallbackValue)
  if (payloadValue === null) {
    return {
      sportsProfileLink: {
        enabled: false,
        formFieldKey: null,
      },
    }
  }
  const normalized = toCampaignPostRegistrationConfig(payloadValue)
  return {
    sportsProfileLink: {
      enabled: normalized.sportsProfileLink.enabled,
      formFieldKey: normalized.sportsProfileLink.formFieldKey,
    },
  }
}

function toStatusLabel(status: ReconciliationStatusKey) {
  if (status === RECONCILIATION_STATUS.READY_TO_LINK) return 'Sẵn sàng liên kết'
  if (status === RECONCILIATION_STATUS.ALREADY_LINKED_CORRECT) return 'Đã liên kết'
  if (status === RECONCILIATION_STATUS.ALREADY_LINKED_DIFFERENT_CODE) return 'Đã liên kết - khác mã khai báo'
  if (status === RECONCILIATION_STATUS.PROFILE_NOT_FOUND) return 'Không tìm thấy hồ sơ'
  if (status === RECONCILIATION_STATUS.PROFILE_CODE_NOT_UNIQUE) return 'Mã trùng hoặc không duy nhất'
  if (status === RECONCILIATION_STATUS.USER_LINKED_TO_OTHER_PROFILE) return 'User đã liên kết hồ sơ khác'
  if (status === RECONCILIATION_STATUS.PROFILE_LINKED_TO_OTHER_USER) return 'Hồ sơ đã liên kết User khác'
  if (status === RECONCILIATION_STATUS.NOT_ELIGIBLE) return 'Chưa đủ điều kiện'
  return 'Cần kiểm tra do dữ liệu không nhất quán'
}

function mapSportsProfileSummary(row: any) {
  if (!row?.id) return null
  return {
    id: row.id,
    code: normalizeText(row.code) || null,
    fullName: normalizeText(row.fullName) || null,
    displayName: normalizeText(row.displayName) || null,
    status: normalizeStatus(row.status) || 'active',
    userId: normalizePositiveInteger(row?.user?.id || row?.user) || null,
  }
}

function mapUserSummary(row: any) {
  if (!row?.id) return null
  return {
    id: row.id,
    email: normalizeText(row.email) || null,
    fullName: normalizeText(row.fullName) || null,
    phone: normalizeText(row.phone) || null,
    confirmed: row.confirmed === true,
    blocked: row.blocked === true,
  }
}

async function isTenantFeatureEnabled(tenantId: number, featureKey: string) {
  const row = await strapi.db.query(TENANT_FEATURE_UID).findOne({
    where: {
      tenant: tenantId,
      isEnabled: true,
      feature: {
        key: {
          $eq: featureKey,
        },
      },
    },
    select: ['id'],
  })
  return Boolean(row?.id)
}

async function findCampaignById(tenantId: number, campaignId: number) {
  const tenantWhere = whereByParam(tenantId)
  if (!tenantWhere) {
    httpError(400, 'Tenant context is required')
  }

  return strapi.db.query(REGISTRATION_CAMPAIGN_UID).findOne({
    where: {
      id: campaignId,
      tenant: tenantWhere,
      ...getNonDeletedWhere(),
    },
    populate: {
      tenant: {
        select: ['id'],
      },
    },
  })
}

function buildTaskState(config: ReturnType<typeof toCampaignPostRegistrationConfig>, hasSportsFeature: boolean) {
  const enabledByConfig = config.sportsProfileLink.enabled === true && Boolean(config.sportsProfileLink.formFieldKey)
  const available = enabledByConfig && hasSportsFeature
  let unavailableReason: string | null = null
  if (!hasSportsFeature) {
    unavailableReason = 'Tenant hiện chưa bật phân hệ Sports Profile.'
  } else if (!enabledByConfig) {
    unavailableReason = 'Tác vụ chưa được cấu hình trường mã thành viên để đối soát.'
  }

  return {
    key: 'sports_profile_link',
    title: 'Liên kết hồ sơ thể thao',
    moduleFeatureKey: SPORTS_PROFILE_FEATURE_KEY,
    configured: enabledByConfig,
    available,
    unavailableReason,
    config: {
      formFieldKey: config.sportsProfileLink.formFieldKey,
    },
  }
}

function getRegistrationFieldValue(formData: unknown, fieldKey: string | null) {
  if (!fieldKey) return null
  if (!formData || typeof formData !== 'object' || Array.isArray(formData)) return null
  const source = formData as GenericRecord
  if (!Object.prototype.hasOwnProperty.call(source, fieldKey)) return null
  const value = source[fieldKey]
  if (value === null || value === undefined) return null
  const raw = String(value)
  return raw.length > 0 ? raw : null
}

async function loadApprovedRegistrations(tenantId: number, campaignId: number) {
  return strapi.db.query(CAMPAIGN_REGISTRATION_UID).findMany({
    where: {
      tenant: tenantId,
      campaign: campaignId,
      status: 'approved',
      ...getNonDeletedWhere(),
    },
    orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
    select: ['id', 'fullName', 'email', 'phone', 'status', 'approvedAt', 'registeredAt', 'formData'],
    populate: {
      user: {
        select: ['id', 'email', 'fullName', 'phone', 'confirmed', 'blocked'],
      },
    },
  })
}

function toInitialStats() {
  return {
    completedTotal: 0,
    alreadyLinkedTotal: 0,
    alreadyLinkedCorrect: 0,
    alreadyLinkedDifferentCode: 0,
    readyToLink: 0,
    waitingToLink: 0,
    needAttention: 0,
    notFound: 0,
    duplicateCode: 0,
    userLinkedOtherProfile: 0,
    profileLinkedOtherUser: 0,
    notEligible: 0,
    manualReview: 0,
  }
}

async function evaluateReconciliationRows(
  registrations: any[],
  tenantId: number,
  fieldKey: string | null,
) {
  const exactCodes = new Set<string>()
  const compactCodes = new Set<string>()
  const userIds = new Set<number>()

  for (const registration of registrations || []) {
    const declaredCode = getRegistrationFieldValue(registration?.formData, fieldKey)
    const normalizedCode = normalizeMemberCode(declaredCode)
    const compactCode = normalizeCompactMemberCode(declaredCode)
    if (normalizedCode) exactCodes.add(normalizedCode)
    if (compactCode) compactCodes.add(compactCode)
    const userId = normalizePositiveInteger(registration?.user?.id || registration?.user)
    if (userId) userIds.add(userId)
  }

  const [profilesByCodeRows, profilesByUserRows] = await Promise.all([
    exactCodes.size > 0 || compactCodes.size > 0
      ? strapi.db.query(SPORTS_PROFILE_UID).findMany({
          where: {
            tenant: tenantId,
            $or: [
              {
                code: {
                  $in: Array.from(exactCodes),
                },
              },
              {
                code: {
                  $in: Array.from(compactCodes),
                },
              },
            ],
          },
          select: ['id', 'code', 'fullName', 'displayName', 'status'],
          populate: {
            user: {
              select: ['id'],
            },
          },
          orderBy: [{ id: 'asc' }],
        })
      : [],
    userIds.size > 0
      ? strapi.db.query(SPORTS_PROFILE_UID).findMany({
          where: {
            tenant: tenantId,
            user: {
              id: {
                $in: Array.from(userIds),
              },
            },
          },
          select: ['id', 'code', 'fullName', 'displayName', 'status'],
          populate: {
            user: {
              select: ['id'],
            },
          },
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        })
      : [],
  ])

  const profilesByCodeMap = new Map<string, Map<number, any>>()
  for (const profile of profilesByCodeRows || []) {
    const profileId = normalizePositiveInteger(profile?.id)
    if (!profileId) continue
    const keys = [normalizeMemberCode(profile?.code), normalizeCompactMemberCode(profile?.code)].filter((item): item is string => Boolean(item))
    for (const codeKey of keys) {
      const bucket = profilesByCodeMap.get(codeKey) || new Map<number, any>()
      bucket.set(profileId, profile)
      profilesByCodeMap.set(codeKey, bucket)
    }
  }

  const profilesByUserMap = new Map<number, any[]>()
  for (const profile of profilesByUserRows || []) {
    const userId = normalizePositiveInteger(profile?.user?.id || profile?.user)
    if (!userId) continue
    const bucket = profilesByUserMap.get(userId) || []
    bucket.push(profile)
    profilesByUserMap.set(userId, bucket)
  }

  const rows = []
  const stats = toInitialStats()

  for (const registration of registrations || []) {
    const registrationId = normalizePositiveInteger(registration?.id)
    if (!registrationId) continue

    const user = mapUserSummary(registration?.user)
    const userId = normalizePositiveInteger(user?.id)
    const declaredCodeRaw = getRegistrationFieldValue(registration?.formData, fieldKey)
    const declaredCode = normalizeMemberCode(declaredCodeRaw)
    const declaredCodeCompact = normalizeCompactMemberCode(declaredCodeRaw)
    const profilesByCodeMapBucket = new Map<number, any>()
    for (const codeKey of [declaredCode, declaredCodeCompact]) {
      if (!codeKey) continue
      const bucket = profilesByCodeMap.get(codeKey)
      if (!bucket) continue
      for (const [profileId, profile] of bucket.entries()) {
        profilesByCodeMapBucket.set(profileId, profile)
      }
    }
    const profilesByCode = Array.from(profilesByCodeMapBucket.values())
    const linkedProfilesForUser = userId ? (profilesByUserMap.get(userId) || []) : []
    const linkedProfile = linkedProfilesForUser.length > 0 ? linkedProfilesForUser[0] : null
    const linkedProfileSummary = mapSportsProfileSummary(linkedProfile)
    const targetProfile = profilesByCode.length === 1 ? profilesByCode[0] : null
    const targetProfileSummary = mapSportsProfileSummary(targetProfile)

    let status: ReconciliationStatusKey = RECONCILIATION_STATUS.NOT_ELIGIBLE
    let reason = ''
    let canLink = false
    let canBulkLink = false
    let canManualLink = false
    let sportsProfile = targetProfileSummary
    let isDeclaredCodeMatched: boolean | null = null

    if (!userId) {
      status = RECONCILIATION_STATUS.NOT_ELIGIBLE
      reason = 'Bản đăng ký chưa có User hợp lệ để liên kết.'
    } else if (linkedProfilesForUser.length > 1) {
      status = RECONCILIATION_STATUS.USER_LINKED_TO_OTHER_PROFILE
      reason = 'User đang liên kết nhiều Sports Profile. Cần rà soát thủ công.'
      sportsProfile = linkedProfileSummary
    } else if (linkedProfileSummary?.id) {
      sportsProfile = linkedProfileSummary
      const linkedCompactCode = normalizeCompactMemberCode(linkedProfileSummary.code)
      isDeclaredCodeMatched = Boolean(declaredCodeCompact && linkedCompactCode && declaredCodeCompact === linkedCompactCode)
      if (isDeclaredCodeMatched) {
        status = RECONCILIATION_STATUS.ALREADY_LINKED_CORRECT
        reason = 'User đã liên kết Sports Profile hợp lệ trong tenant.'
      } else {
        status = RECONCILIATION_STATUS.ALREADY_LINKED_DIFFERENT_CODE
        reason = declaredCodeRaw
          ? 'User đã liên kết Sports Profile nhưng khác mã khai báo.'
          : 'User đã liên kết Sports Profile dù bản đăng ký chưa khai báo mã.'
      }
    } else if (!declaredCode) {
      status = RECONCILIATION_STATUS.PROFILE_NOT_FOUND
      reason = `Bản đăng ký chưa có dữ liệu trường ${fieldKey || 'mã thành viên'}.`
      canManualLink = true
    } else if (profilesByCode.length === 0) {
      status = RECONCILIATION_STATUS.PROFILE_NOT_FOUND
      reason = `Không tìm thấy Sports Profile theo mã ${declaredCodeRaw}.`
      canManualLink = true
    } else if (profilesByCode.length > 1) {
      status = RECONCILIATION_STATUS.PROFILE_CODE_NOT_UNIQUE
      reason = `Có ${profilesByCode.length} Sports Profile trùng mã ${declaredCodeRaw} trong tenant.`
      canManualLink = true
    } else if (!targetProfileSummary?.id) {
      status = RECONCILIATION_STATUS.NEED_MANUAL_REVIEW
      reason = 'Dữ liệu Sports Profile không nhất quán, cần kiểm tra thủ công.'
      canManualLink = true
    } else if (targetProfileSummary.userId && targetProfileSummary.userId !== userId) {
      status = RECONCILIATION_STATUS.PROFILE_LINKED_TO_OTHER_USER
      reason = 'Sports Profile đã liên kết với User khác.'
      canManualLink = true
    } else {
      const registrationName = normalizeComparableName(registration?.fullName)
      const profileFullName = normalizeComparableName(targetProfileSummary.fullName)
      const profileDisplayName = normalizeComparableName(targetProfileSummary.displayName)
      const nameMatched = registrationName
        && (registrationName === profileFullName || (profileDisplayName && registrationName === profileDisplayName))

      if (!nameMatched) {
        status = RECONCILIATION_STATUS.NEED_MANUAL_REVIEW
        reason = 'Tên người đăng ký khác tên Sports Profile. Cần kiểm tra thủ công trước khi liên kết.'
        canManualLink = true
      } else {
        status = RECONCILIATION_STATUS.READY_TO_LINK
        reason = 'Có thể liên kết an toàn.'
        canLink = true
        canBulkLink = true
        canManualLink = true
      }
    }

    const row = {
      registrationId,
      registration: {
        id: registrationId,
        fullName: normalizeText(registration?.fullName) || null,
        email: normalizeText(registration?.email) || null,
        phone: normalizeText(registration?.phone) || null,
        approvedAt: registration?.approvedAt || null,
        registeredAt: registration?.registeredAt || null,
      },
      user,
      declaredMemberCode: declaredCodeRaw,
      sportsProfile: sportsProfile,
      sportsProfileCandidates: (profilesByCode || []).map((item: any) => mapSportsProfileSummary(item)).filter(Boolean),
      reconciliationStatus: status,
      reconciliationStatusLabel: toStatusLabel(status),
      reconciliationReason: reason,
      isDeclaredCodeMatched,
      manualLinkTag: status === RECONCILIATION_STATUS.ALREADY_LINKED_DIFFERENT_CODE ? 'Liên kết thủ công – khác mã khai báo' : null,
      canLink,
      canBulkLink,
      canManualLink,
    }

    stats.completedTotal += 1
    if (status === RECONCILIATION_STATUS.ALREADY_LINKED_CORRECT) {
      stats.alreadyLinkedCorrect += 1
      stats.alreadyLinkedTotal += 1
    } else if (status === RECONCILIATION_STATUS.ALREADY_LINKED_DIFFERENT_CODE) {
      stats.alreadyLinkedDifferentCode += 1
      stats.alreadyLinkedTotal += 1
    } else if (status === RECONCILIATION_STATUS.READY_TO_LINK) stats.readyToLink += 1
    else stats.needAttention += 1

    if (status === RECONCILIATION_STATUS.PROFILE_NOT_FOUND) stats.notFound += 1
    if (status === RECONCILIATION_STATUS.PROFILE_CODE_NOT_UNIQUE) stats.duplicateCode += 1
    if (status === RECONCILIATION_STATUS.USER_LINKED_TO_OTHER_PROFILE) stats.userLinkedOtherProfile += 1
    if (status === RECONCILIATION_STATUS.PROFILE_LINKED_TO_OTHER_USER) stats.profileLinkedOtherUser += 1
    if (status === RECONCILIATION_STATUS.NOT_ELIGIBLE) stats.notEligible += 1
    if (status === RECONCILIATION_STATUS.NEED_MANUAL_REVIEW) stats.manualReview += 1

    rows.push(row)
  }

  stats.waitingToLink = stats.readyToLink
  return { rows, stats }
}

function filterReconciliationRows(rows: any[], query: Record<string, unknown>) {
  const statusFilter = normalizeStatus(query.status)
  const keyword = normalizeText(query.q || query.search || query.keyword).toLowerCase()

  return (rows || []).filter((row) => {
    if (statusFilter && normalizeStatus(row?.reconciliationStatus) !== statusFilter) {
      return false
    }
    if (!keyword) return true
    const haystack = [
      row?.registration?.fullName,
      row?.registration?.email,
      row?.registration?.phone,
      row?.user?.email,
      row?.user?.fullName,
      row?.declaredMemberCode,
      row?.sportsProfile?.code,
      row?.sportsProfile?.fullName,
    ]
      .map((item) => normalizeText(item).toLowerCase())
      .join(' ')
    return haystack.includes(keyword)
  })
}

function paginateRows(rows: any[], query: Record<string, unknown>) {
  const page = Math.max(1, normalizePositiveInteger(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, normalizePositiveInteger(query.pageSize) || 20))
  const total = rows.length
  const start = (page - 1) * pageSize
  const pagedRows = rows.slice(start, start + pageSize)

  return {
    rows: pagedRows,
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
}

async function writePostProcessAudit(input: {
  tenantId: number
  campaignId: number
  registrationId: number
  userId: number | null
  sportsProfileId: number | null
  actorUserId: number | null
  actionType: string
  resultStatus: 'success' | 'skipped' | 'failed'
  resultCode: string | null
  resultMessage: string | null
  metadata?: Record<string, unknown> | null
}) {
  try {
    await strapi.db.query(POST_PROCESS_AUDIT_UID).create({
      data: {
        tenant: input.tenantId,
        campaign: input.campaignId,
        registration: input.registrationId,
        user: input.userId || null,
        sportsProfile: input.sportsProfileId || null,
        actor: input.actorUserId || null,
        taskType: 'sports_profile_link',
        actionType: input.actionType,
        resultStatus: input.resultStatus,
        resultCode: input.resultCode || null,
        resultMessage: input.resultMessage || null,
        metadata: input.metadata || {},
        executedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    strapi.log.error('[registration-campaign.post-registration] cannot write audit log', error)
  }
}

export async function getCampaignSportsProfilePostRegistrationSummary(campaign: any, tenantId: number) {
  const config = toCampaignPostRegistrationConfig(campaign?.postRegistrationConfig)
  const hasSportsFeature = await isTenantFeatureEnabled(tenantId, SPORTS_PROFILE_FEATURE_KEY)
  const task = buildTaskState(config, hasSportsFeature)
  if (!task.available) {
    return {
      task,
      stats: toInitialStats(),
    }
  }

  const registrations = await loadApprovedRegistrations(tenantId, Number(campaign.id))
  const evaluation = await evaluateReconciliationRows(registrations || [], tenantId, config.sportsProfileLink.formFieldKey)
  return {
    task,
    stats: evaluation.stats,
  }
}

export async function listCampaignSportsProfilePostRegistration(
  tenantId: number,
  campaignId: number,
  query: Record<string, unknown>,
) {
  const campaign = await findCampaignById(tenantId, campaignId)
  if (!campaign?.id) {
    httpError(404, 'Registration campaign not found')
  }

  const summary = await getCampaignSportsProfilePostRegistrationSummary(campaign, tenantId)
  if (!summary.task.available) {
    return {
      task: summary.task,
      stats: summary.stats,
      data: [],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        pageCount: 1,
      },
    }
  }

  const registrations = await loadApprovedRegistrations(tenantId, campaignId)
  const evaluation = await evaluateReconciliationRows(registrations || [], tenantId, summary.task.config.formFieldKey)
  const filteredRows = filterReconciliationRows(evaluation.rows, query)
  const paged = paginateRows(filteredRows, query)

  return {
    task: summary.task,
    stats: evaluation.stats,
    data: paged.rows,
    pagination: paged.pagination,
  }
}

export async function linkCampaignSportsProfilePostRegistration(
  tenantId: number,
  campaignId: number,
  payload: Record<string, unknown>,
  actor: { id?: number | null } | null,
) {
  const campaign = await findCampaignById(tenantId, campaignId)
  if (!campaign?.id) {
    httpError(404, 'Registration campaign not found')
  }

  const summary = await getCampaignSportsProfilePostRegistrationSummary(campaign, tenantId)
  if (!summary.task.available) {
    httpError(409, summary.task.unavailableReason || 'Tác vụ liên kết hồ sơ thể thao chưa sẵn sàng')
  }

  const mode = normalizeStatus(payload.mode) || 'selected'
  const requestedIds = Array.isArray(payload.registrationIds)
    ? payload.registrationIds.map((item) => normalizePositiveInteger(item)).filter((item): item is number => Boolean(item))
    : []
  let targetIds: number[] = []

  const registrations = await loadApprovedRegistrations(tenantId, campaignId)
  const evaluation = await evaluateReconciliationRows(registrations || [], tenantId, summary.task.config.formFieldKey)
  const rowByRegistrationId = new Map<number, any>()
  for (const row of evaluation.rows || []) {
    rowByRegistrationId.set(Number(row.registrationId), row)
  }

  if (mode === 'all_ready') {
    targetIds = evaluation.rows
      .filter((row: any) => row?.reconciliationStatus === RECONCILIATION_STATUS.READY_TO_LINK)
      .map((row: any) => Number(row.registrationId))
      .filter((id: number) => Number.isInteger(id) && id > 0)
  } else {
    targetIds = Array.from(new Set(requestedIds))
  }

  if (targetIds.length === 0) {
    httpError(400, 'Không có bản đăng ký hợp lệ để liên kết')
  }

  const results = []
  const actionType = mode === 'all_ready' ? 'link_all_ready' : targetIds.length === 1 ? 'link_single' : 'link_bulk'
  const actorUserId = normalizePositiveInteger(actor?.id) || null

  for (const registrationId of targetIds) {
    const row = rowByRegistrationId.get(registrationId)
    if (!row) {
      results.push({
        registrationId,
        ok: false,
        status: RECONCILIATION_STATUS.NOT_ELIGIBLE,
        code: 'REGISTRATION_NOT_ELIGIBLE',
        message: 'Bản đăng ký không thuộc nhóm đã hoàn tất hoặc không có User hợp lệ.',
      })
      await writePostProcessAudit({
        tenantId,
        campaignId,
        registrationId,
        userId: null,
        sportsProfileId: null,
        actorUserId,
        actionType,
        resultStatus: 'failed',
        resultCode: 'REGISTRATION_NOT_ELIGIBLE',
        resultMessage: 'Registration row not found in approved reconciliation set.',
      })
      continue
    }

    const userId = normalizePositiveInteger(row?.user?.id)
    const sportsProfileId = normalizePositiveInteger(row?.sportsProfile?.id)
    const status = normalizeStatus(row?.reconciliationStatus) as ReconciliationStatusKey

    if (status === RECONCILIATION_STATUS.ALREADY_LINKED_CORRECT) {
      results.push({
        registrationId,
        ok: true,
        status,
        code: 'ALREADY_LINKED',
        message: 'Đã liên kết từ trước.',
      })
      await writePostProcessAudit({
        tenantId,
        campaignId,
        registrationId,
        userId: userId || null,
        sportsProfileId: sportsProfileId || null,
        actorUserId,
        actionType,
        resultStatus: 'skipped',
        resultCode: 'ALREADY_LINKED',
        resultMessage: 'Already linked correctly.',
      })
      continue
    }

    if (status !== RECONCILIATION_STATUS.READY_TO_LINK || !userId || !sportsProfileId) {
      results.push({
        registrationId,
        ok: false,
        status,
        code: 'NOT_READY_TO_LINK',
        message: normalizeText(row?.reconciliationReason) || 'Bản ghi chưa đủ điều kiện liên kết.',
      })
      await writePostProcessAudit({
        tenantId,
        campaignId,
        registrationId,
        userId: userId || null,
        sportsProfileId: sportsProfileId || null,
        actorUserId,
        actionType,
        resultStatus: 'failed',
        resultCode: 'NOT_READY_TO_LINK',
        resultMessage: normalizeText(row?.reconciliationReason) || 'Row is not ready to link.',
      })
      continue
    }

    try {
      await linkTenantSportsProfileUser(sportsProfileId, { userId }, tenantId, actorUserId ? { id: actorUserId } : null)
      results.push({
        registrationId,
        ok: true,
        status: RECONCILIATION_STATUS.ALREADY_LINKED_CORRECT,
        code: 'LINKED',
        message: 'Liên kết thành công.',
      })
      await writePostProcessAudit({
        tenantId,
        campaignId,
        registrationId,
        userId,
        sportsProfileId,
        actorUserId,
        actionType,
        resultStatus: 'success',
        resultCode: 'LINKED',
        resultMessage: 'Linked successfully.',
      })
    } catch (error: any) {
      const code = normalizeText(error?.code) || 'LINK_FAILED'
      const message = normalizeText(error?.message) || 'Liên kết thất bại.'
      results.push({
        registrationId,
        ok: false,
        status: RECONCILIATION_STATUS.NEED_MANUAL_REVIEW,
        code,
        message,
      })
      await writePostProcessAudit({
        tenantId,
        campaignId,
        registrationId,
        userId,
        sportsProfileId,
        actorUserId,
        actionType,
        resultStatus: 'failed',
        resultCode: code,
        resultMessage: message,
      })
    }
  }

  const latestSummary = await getCampaignSportsProfilePostRegistrationSummary(campaign, tenantId)

  return {
    mode,
    totalRequested: targetIds.length,
    successCount: results.filter((item) => item.ok).length,
    failedCount: results.filter((item) => !item.ok).length,
    results,
    stats: latestSummary.stats,
    task: latestSummary.task,
  }
}

export async function manualLinkCampaignSportsProfilePostRegistration(
  tenantId: number,
  campaignId: number,
  payload: Record<string, unknown>,
  actor: { id?: number | null } | null,
) {
  const campaign = await findCampaignById(tenantId, campaignId)
  if (!campaign?.id) {
    httpError(404, 'Registration campaign not found')
  }

  const summary = await getCampaignSportsProfilePostRegistrationSummary(campaign, tenantId)
  if (!summary.task.available) {
    httpError(409, summary.task.unavailableReason || 'Tác vụ liên kết hồ sơ thể thao chưa sẵn sàng')
  }

  const registrationId = normalizePositiveInteger(payload.registrationId)
  const sportsProfileId = normalizePositiveInteger(payload.sportsProfileId)
  if (!registrationId) {
    httpError(400, 'registrationId is required', 'INVALID_REQUEST_BODY')
  }
  if (!sportsProfileId) {
    httpError(400, 'sportsProfileId is required', 'INVALID_REQUEST_BODY')
  }

  const registrations = await loadApprovedRegistrations(tenantId, campaignId)
  const evaluation = await evaluateReconciliationRows(registrations || [], tenantId, summary.task.config.formFieldKey)
  const row = (evaluation.rows || []).find((item: any) => Number(item?.registrationId) === registrationId)
  if (!row) {
    httpError(404, 'Registration not found in approved set')
  }

  const userId = normalizePositiveInteger(row?.user?.id)
  if (!userId) {
    httpError(409, 'Bản đăng ký chưa có User hợp lệ để liên kết.')
  }

  const selectedProfile = await strapi.db.query(SPORTS_PROFILE_UID).findOne({
    where: {
      id: sportsProfileId,
      tenant: tenantId,
    },
    select: ['id', 'code', 'fullName', 'displayName', 'status'],
    populate: {
      user: {
        select: ['id'],
      },
    },
  })
  if (!selectedProfile?.id) {
    httpError(404, 'Sports Profile not found')
  }

  const selectedProfileSummary = mapSportsProfileSummary(selectedProfile)
  const actorUserId = normalizePositiveInteger(actor?.id) || null
  const actionType = 'link_manual_single'

  if (selectedProfileSummary?.userId && Number(selectedProfileSummary.userId) === userId) {
    const refreshedRegistrations = await loadApprovedRegistrations(tenantId, campaignId)
    const refreshedEvaluation = await evaluateReconciliationRows(refreshedRegistrations || [], tenantId, summary.task.config.formFieldKey)
    const latestRow = (refreshedEvaluation.rows || []).find((item: any) => Number(item?.registrationId) === registrationId) || row
    return {
      ok: true,
      status: latestRow?.reconciliationStatus || RECONCILIATION_STATUS.ALREADY_LINKED_CORRECT,
      message: 'Sports Profile đã liên kết với User này từ trước.',
      row: latestRow,
      stats: refreshedEvaluation.stats,
      task: summary.task,
    }
  }

  if (row?.canManualLink !== true) {
    httpError(409, normalizeText(row?.reconciliationReason) || 'Bản ghi chưa đủ điều kiện liên kết thủ công.')
  }

  try {
    await linkTenantSportsProfileUser(sportsProfileId, { userId }, tenantId, actorUserId ? { id: actorUserId } : null)
    await writePostProcessAudit({
      tenantId,
      campaignId,
      registrationId,
      userId,
      sportsProfileId,
      actorUserId,
      actionType,
      resultStatus: 'success',
      resultCode: 'MANUAL_LINKED',
      resultMessage: 'Linked manually from post-registration tab.',
      metadata: {
        declaredMemberCode: normalizeText(row?.declaredMemberCode) || null,
        selectedProfileCode: normalizeText(selectedProfileSummary?.code) || null,
      },
    })
  } catch (error: any) {
    const code = normalizeText(error?.code) || 'LINK_FAILED'
    const message = normalizeText(error?.message) || 'Liên kết thất bại.'
    await writePostProcessAudit({
      tenantId,
      campaignId,
      registrationId,
      userId,
      sportsProfileId,
      actorUserId,
      actionType,
      resultStatus: 'failed',
      resultCode: code,
      resultMessage: message,
      metadata: {
        declaredMemberCode: normalizeText(row?.declaredMemberCode) || null,
        selectedProfileCode: normalizeText(selectedProfileSummary?.code) || null,
      },
    })
    throw error
  }

  const refreshedRegistrations = await loadApprovedRegistrations(tenantId, campaignId)
  const refreshedEvaluation = await evaluateReconciliationRows(refreshedRegistrations || [], tenantId, summary.task.config.formFieldKey)
  const latestRow = (refreshedEvaluation.rows || []).find((item: any) => Number(item?.registrationId) === registrationId) || null

  return {
    ok: true,
    status: latestRow?.reconciliationStatus || RECONCILIATION_STATUS.ALREADY_LINKED_CORRECT,
    message: 'Liên kết thủ công thành công.',
    row: latestRow,
    stats: refreshedEvaluation.stats,
    task: summary.task,
  }
}
