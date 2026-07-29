import { extractRelationRef, hasOwn, toText, whereByParam } from '../../../utils/tenant-scope'
import { getTenantEnabledRoles } from '../../admin/services/manage-tenant-users'
import {
  approveCampaignRegistration,
  buildVerificationRedirectUrl,
  cancelCampaignRegistration,
  handleRegistrationCampaignError,
  rejectCampaignRegistration,
  HttpError,
  resendCompletionNotificationForRegistration,
  resendRejectionNotificationForRegistration,
  resendVerificationNotificationForRegistration,
  retryCompleteApprovedRegistration,
} from './registration-campaign'

const REGISTRATION_CAMPAIGN_UID = 'api::registration-campaign.registration-campaign'
const CAMPAIGN_REGISTRATION_UID = 'api::campaign-registration.campaign-registration'
const FEATURE_UID = 'api::feature.feature'
const ROLE_UID = 'plugin::users-permissions.role'
const TENANT_FEATURE_UID = 'api::tenant-feature.tenant-feature'
const TENANT_ROLE_UID = 'api::tenant-role.tenant-role'
const USER_TENANT_ROLE_UID = 'api::user-tenant-role.user-tenant-role'
const ROLE_FEATURE_UID = 'api::role-feature.role-feature'
const MAIL_LOG_UID = 'api::mail-log.mail-log'
const NOTIFICATION_TEMPLATE_UID = 'api::notification-template.notification-template'
const NOTIFICATION_TEMPLATE_SERVICE_UID = 'api::notification-template.notification-template'
const REGISTRATION_VERIFICATION_TEMPLATE_CODE = 'registration_campaign_verification'
const REGISTRATION_COMPLETION_TEMPLATE_CODE = 'campaign_registration_completed'
const REGISTRATION_REJECTION_TEMPLATE_CODE = 'campaign_registration_rejected'
const SUPPORTED_TARGET_FEATURES = ['fitness.manage']
const RESERVED_FIELD_KEYS = new Set(['fullName', 'email', 'phone'])
const CAMPAIGN_EMAIL_TEMPLATE_FIELDS = [
  'verificationNotificationTemplate',
  'completionNotificationTemplate',
  'rejectionNotificationTemplate',
] as const
const CAMPAIGN_EMAIL_TEMPLATE_SELECT = ['id', 'documentId', 'code', 'name', 'subject', 'type', 'isActive', 'variables']
const STATUS_LABELS: Record<string, string> = {
  draft: 'Bản nháp',
  open: 'Đang mở',
  paused: 'Tạm dừng',
  closed: 'Đã đóng',
  cancelled: 'Đã hủy',
}

function httpError(status: number, message: string, code?: string): never {
  throw new HttpError(status, message, code)
}

function normalizeText(value: unknown): string {
  return toText(value)
}

function normalizeCode(value: unknown): string {
  return normalizeText(value).toLowerCase()
}

function normalizeStatus(value: unknown): string {
  return normalizeText(value).toLowerCase()
}

function normalizePath(value: unknown): string | null {
  const text = normalizeText(value)
  if (!text) return null
  return text.startsWith('/') ? text : `/${text}`
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  const text = normalizeText(value).toLowerCase()
  if (!text) return fallback
  return ['1', 'true', 'yes', 'on'].includes(text)
}

function normalizeInteger(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

function normalizePositiveInteger(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function ensureRequiredText(value: unknown, fieldName: string): string {
  const text = normalizeText(value)
  if (!text) {
    httpError(400, `${fieldName} is required`)
  }
  return text
}

function ensureEmail(value: unknown, fieldName = 'email'): string {
  const email = normalizeText(value).toLowerCase()
  if (!email) {
    httpError(400, `${fieldName} is required`)
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    httpError(400, `${fieldName} is invalid`)
  }

  return email
}

function ensureObject(value: unknown, fieldName: string): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) }
  }
  httpError(400, `${fieldName} must be an object`)
}

function ensurePathOrNull(value: unknown): string | null {
  const text = normalizeText(value)
  if (!text) return null
  if (!text.startsWith('/')) {
    httpError(400, 'redirectPath must start with /')
  }
  return text
}

function toDateOrNull(value: unknown): Date | null {
  const text = normalizeText(value)
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

function getNonDeletedWhere() {
  return {
    $or: [
      { isDeleted: false },
      { isDeleted: { $null: true } },
    ],
  }
}

function getMailLogTypes() {
  return [
    REGISTRATION_VERIFICATION_TEMPLATE_CODE,
    REGISTRATION_COMPLETION_TEMPLATE_CODE,
    REGISTRATION_REJECTION_TEMPLATE_CODE,
    `test:${REGISTRATION_VERIFICATION_TEMPLATE_CODE}`,
    `test:${REGISTRATION_COMPLETION_TEMPLATE_CODE}`,
    `test:${REGISTRATION_REJECTION_TEMPLATE_CODE}`,
    'tenant_invite',
    'tenant_invite_fallback',
  ]
}

function getCampaignEmailTemplateConfig(fieldName: string) {
  if (fieldName === 'completionNotificationTemplate') {
    return {
      purpose: 'completion',
      recommendedCodes: [REGISTRATION_COMPLETION_TEMPLATE_CODE],
      requiredVariables: ['fullName', 'campaignName', 'tenantName', 'featureName', 'featureUrl', 'loginUrl', 'supportEmail'],
      missingWarning: 'Template hoàn tất đăng ký chưa được cấu hình.',
    }
  }

  if (fieldName === 'rejectionNotificationTemplate') {
    return {
      purpose: 'rejection',
      recommendedCodes: [REGISTRATION_REJECTION_TEMPLATE_CODE],
      requiredVariables: ['fullName', 'campaignName', 'tenantName', 'rejectionReason', 'supportEmail'],
      missingWarning: 'Template từ chối chưa được cấu hình.',
    }
  }

  return {
    purpose: 'verification',
    recommendedCodes: [REGISTRATION_VERIFICATION_TEMPLATE_CODE, 'campaign_registration_verify'],
    requiredVariables: ['fullName', 'campaignName', 'tenantName', 'verificationUrl', 'verificationExpiresAt', 'supportEmail'],
    missingWarning: 'Chưa cấu hình template xác minh email.',
  }
}

function toTemplatePurposeLabel(fieldName: string) {
  if (fieldName === 'completionNotificationTemplate') return 'hoàn tất đăng ký'
  if (fieldName === 'rejectionNotificationTemplate') return 'từ chối đăng ký'
  return 'xác minh email'
}

function toTemplateSummary(template: any, extras: Record<string, unknown> = {}) {
  if (!template?.id) return null
  return {
    id: template.id,
    documentId: template.documentId || null,
    code: normalizeText(template.code) || null,
    name: normalizeText(template.name) || null,
    subject: normalizeText(template.subject) || null,
    type: normalizeStatus(template.type) || 'email',
    isActive: template.isActive !== false,
    variables: template.variables ?? null,
    ...extras,
  }
}

function isTemplateUsable(template: any) {
  return Boolean(template?.isAvailable === true || template?.id)
}

function buildCampaignEmailPreviewData(campaign: any, purpose: string) {
  const featureName = normalizeText(campaign?.targetFeature) || 'Fitness'
  const tenantName = normalizeText(campaign?.tenant?.name) || normalizeText(campaign?.tenant?.shortName) || 'COGI'
  const campaignName = normalizeText(campaign?.name) || 'Đăng ký Fitness miễn phí'

  return {
    fullName: 'Nguyen Van A',
    campaignName,
    tenantName,
    verificationUrl: 'https://example.com/join/verify?token=sample',
    verificationExpiresAt: '23:59 31/07/2026',
    featureName,
    featureUrl: `https://example.com/${encodeURIComponent(featureName.toLowerCase().replace(/\s+/g, '-'))}`,
    loginUrl: 'https://example.com/login',
    rejectionReason: 'Thong tin dang ky chua phu hop.',
    supportEmail: 'support@example.com',
    purpose,
  }
}

async function findCampaignNotificationTemplate(tenantId: number, templateRef: unknown, fieldName: string, options: Record<string, unknown> = {}) {
  const relationRef = extractRelationRef(templateRef)
  if (relationRef === null || relationRef === undefined || relationRef === '') {
    return null
  }

  const service = strapi.service(NOTIFICATION_TEMPLATE_SERVICE_UID) as any
  const template = await service.findTenantTemplateByRef(tenantId, relationRef, {
    selectContent: options.selectContent === true,
  })

  if (!template?.id) {
    httpError(404, `NOTIFICATION_TEMPLATE_NOT_FOUND: Không tìm thấy template ${toTemplatePurposeLabel(fieldName)}`, 'NOTIFICATION_TEMPLATE_NOT_FOUND')
  }

  if (normalizeStatus(template.type) !== 'email') {
    httpError(409, `NOTIFICATION_TEMPLATE_WRONG_TYPE: Template ${toTemplatePurposeLabel(fieldName)} phải có loại email`, 'NOTIFICATION_TEMPLATE_WRONG_TYPE')
  }

  if (template.isActive === false && options.allowInactive !== true) {
    httpError(409, `NOTIFICATION_TEMPLATE_INACTIVE: Template ${toTemplatePurposeLabel(fieldName)} đang ngung hoat dong`, 'NOTIFICATION_TEMPLATE_INACTIVE')
  }

  const config = getCampaignEmailTemplateConfig(fieldName)
  const compatible = service.matchesCompatibility(template, config)
  if (!compatible && options.allowIncompatible !== true) {
    httpError(409, `NOTIFICATION_TEMPLATE_NOT_ALLOWED: Template ${toTemplatePurposeLabel(fieldName)} khong phu hop voi muc dich su dung`, 'NOTIFICATION_TEMPLATE_NOT_ALLOWED')
  }

  return template
}

async function buildCampaignTemplateRelationData(tenantId: number, payload: Record<string, unknown>) {
  const data: Record<string, unknown> = {}

  for (const fieldName of CAMPAIGN_EMAIL_TEMPLATE_FIELDS) {
    if (!hasOwn(payload, fieldName)) continue
    const relationRef = extractRelationRef(payload[fieldName])
    if (relationRef === null || relationRef === undefined || relationRef === '') {
      data[fieldName] = null
      continue
    }

    const template = await findCampaignNotificationTemplate(tenantId, relationRef, fieldName)
    data[fieldName] = template.id
  }

  return data
}

function getTemplateAvailability(template: any, fieldName: string) {
  if (!template?.id) return null
  const config = getCampaignEmailTemplateConfig(fieldName)
  const service = strapi.service(NOTIFICATION_TEMPLATE_SERVICE_UID) as any
  const isEmail = normalizeStatus(template.type) === 'email'
  const isActive = template.isActive !== false
  const isCompatible = service.matchesCompatibility(template, config)
  const isAvailable = isEmail && isActive && isCompatible

  let availabilityCode = 'AVAILABLE'
  let availabilityLabel = 'Dang kha dung'
  if (!isEmail) {
    availabilityCode = 'WRONG_TYPE'
    availabilityLabel = 'Sai loai template'
  } else if (!isActive) {
    availabilityCode = 'INACTIVE'
    availabilityLabel = 'Khong con kha dung'
  } else if (!isCompatible) {
    availabilityCode = 'NOT_ALLOWED'
    availabilityLabel = 'Khong dung nghiep vu'
  }

  return toTemplateSummary(template, {
    isAvailable,
    availabilityCode,
    availabilityLabel,
  })
}

async function buildCampaignEmailTemplateState(campaign: any) {
  const tenantId = normalizePositiveInteger(campaign?.tenant?.id || campaign?.tenant || 0) || 0
  const verificationSelected = getTemplateAvailability(campaign?.verificationNotificationTemplate, 'verificationNotificationTemplate')
  const completionSelected = getTemplateAvailability(campaign?.completionNotificationTemplate, 'completionNotificationTemplate')
  const rejectionSelected = getTemplateAvailability(campaign?.rejectionNotificationTemplate, 'rejectionNotificationTemplate')
  const service = strapi.service(NOTIFICATION_TEMPLATE_SERVICE_UID) as any
  const verificationFallback = await service.findActiveTenantTemplateByCode(tenantId, REGISTRATION_VERIFICATION_TEMPLATE_CODE)

  return {
    verification: {
      selected: verificationSelected,
      fallback: verificationFallback ? toTemplateSummary(verificationFallback, { isAvailable: true, availabilityCode: 'FALLBACK', availabilityLabel: 'Template fallback hien co' }) : null,
      hasUsableTemplate: Boolean((verificationSelected as any)?.isAvailable === true || verificationFallback?.id),
      ...getCampaignEmailTemplateConfig('verificationNotificationTemplate'),
    },
    completion: {
      selected: completionSelected,
      fallback: null,
      hasUsableTemplate: Boolean((completionSelected as any)?.isAvailable === true),
      ...getCampaignEmailTemplateConfig('completionNotificationTemplate'),
    },
    rejection: {
      selected: rejectionSelected,
      fallback: null,
      hasUsableTemplate: Boolean((rejectionSelected as any)?.isAvailable === true),
      ...getCampaignEmailTemplateConfig('rejectionNotificationTemplate'),
    },
  }
}

function toSerializableMedia(media: any) {
  if (!media) return null
  return {
    id: media.id,
    name: normalizeText(media.name),
    url: normalizeText(media.url) || null,
    formats: media.formats || null,
  }
}

function toSerializableRole(role: any, availabilityStatus = 'unconfigured', availabilityLabel = 'Chưa cấu hình') {
  if (!role?.id) return null
  return {
    id: role.id,
    documentId: role.documentId || null,
    name: normalizeText(role.name) || normalizeText(role.type) || `Role #${role.id}`,
    description: normalizeText(role.description) || null,
    type: normalizeText(role.type) || null,
    availabilityStatus,
    availabilityLabel,
    isAvailable: availabilityStatus === 'active',
  }
}

function sanitizeMailContent(value: unknown): string | null {
  const text = normalizeText(value)
  if (!text) return null
  return text
    .replace(/([?&](?:token|code)=)([^&\s"']+)/gi, '$1[hidden]')
    .replace(/(\/verify-email\?token=)([^\s"'<]+)/gi, '$1[hidden]')
    .replace(/(\/campaign-registrations\/verify\?token=)([^\s"'<]+)/gi, '$1[hidden]')
}

function sanitizeMetadata(value: unknown) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

  const next: Record<string, unknown> = {}
  for (const [key, rawValue] of Object.entries(source)) {
    const lowered = key.toLowerCase()
    if (lowered.includes('token') || lowered.includes('password') || lowered.includes('secret')) {
      continue
    }

    if (typeof rawValue === 'string') {
      next[key] = sanitizeMailContent(rawValue)
      continue
    }

    if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
      next[key] = sanitizeMetadata(rawValue)
      continue
    }

    next[key] = rawValue
  }

  return next
}

function normalizeFormField(rawField: Record<string, unknown>, index: number) {
  const key = normalizeText(rawField.key)
  const type = normalizeStatus(rawField.type) || 'text'
  const options = Array.isArray(rawField.options)
    ? rawField.options
      .map((item) => {
        if (item && typeof item === 'object') {
          return {
            label: normalizeText((item as Record<string, unknown>).label),
            value: normalizeText((item as Record<string, unknown>).value),
          }
        }
        const text = normalizeText(item)
        return { label: text, value: text }
      })
      .filter((item) => item.label && item.value)
    : []

  return {
    key,
    label: normalizeText(rawField.label),
    type,
    required: normalizeBoolean(rawField.required, false),
    placeholder: normalizeText(rawField.placeholder) || null,
    helpText: normalizeText(rawField.helpText) || null,
    options,
    enabled: normalizeBoolean(rawField.enabled, true),
    order: normalizeInteger(rawField.order) ?? index,
  }
}

function buildDefaultFormConfig() {
  return {
    fields: [
      {
        key: 'fullName',
        label: 'Họ và tên',
        type: 'text',
        required: true,
        placeholder: 'Nhập họ và tên',
        helpText: null,
        enabled: true,
        order: 0,
        system: true,
      },
      {
        key: 'email',
        label: 'Email',
        type: 'text',
        required: true,
        placeholder: 'Nhập email',
        helpText: null,
        enabled: true,
        order: 1,
        system: true,
      },
      {
        key: 'phone',
        label: 'Số điện thoại',
        type: 'text',
        required: false,
        placeholder: 'Nhập số điện thoại',
        helpText: null,
        enabled: true,
        order: 2,
        system: true,
      },
    ],
  }
}

function normalizeFormConfig(value: unknown, verificationRequired = true) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const rawFields = Array.isArray(source.fields) ? source.fields : []
  const fieldMap = new Map<string, any>()

  for (const systemField of buildDefaultFormConfig().fields) {
    fieldMap.set(systemField.key, { ...systemField })
  }

  rawFields.forEach((rawField, index) => {
    if (!rawField || typeof rawField !== 'object') return
    const normalized = normalizeFormField(rawField as Record<string, unknown>, index + 10)
    if (!normalized.key) return
    if (RESERVED_FIELD_KEYS.has(normalized.key)) {
      const existing = fieldMap.get(normalized.key)
      if (existing) {
        fieldMap.set(normalized.key, {
          ...existing,
          label: normalized.label || existing.label,
          placeholder: normalized.placeholder,
          helpText: normalized.helpText,
          required: normalized.key === 'email' ? verificationRequired || normalized.required : normalized.required,
          enabled: normalized.key === 'email' ? true : normalized.enabled,
          order: existing.order,
          system: true,
        })
      }
      return
    }

    fieldMap.set(normalized.key, normalized)
  })

  const emailField = fieldMap.get('email')
  if (emailField) {
    emailField.required = verificationRequired ? true : normalizeBoolean(emailField.required, true)
    emailField.enabled = true
    fieldMap.set('email', emailField)
  }

  const fields = Array.from(fieldMap.values())
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
    .map((item, index) => ({
      ...item,
      order: index,
    }))

  return { fields }
}

function validateFormConfig(value: unknown, verificationRequired = true) {
  const config = normalizeFormConfig(value, verificationRequired)
  const errors: string[] = []
  const keys = new Set<string>()

  for (const field of config.fields || []) {
    const key = normalizeText(field.key)
    const label = normalizeText(field.label)
    const type = normalizeStatus(field.type)

    if (!key) {
      errors.push('Biểu mẫu có trường chưa khai báo key.')
      continue
    }

    if (keys.has(key)) {
      errors.push(`Trường ${key} bị trùng key.`)
      continue
    }

    keys.add(key)

    if (!label) {
      errors.push(`Trường ${key} chưa có nhãn hiển thị.`)
    }

    if (!RESERVED_FIELD_KEYS.has(key) && !['text', 'textarea', 'number', 'select', 'radio', 'checkbox', 'date'].includes(type)) {
      errors.push(`Trường ${key} có kiểu không được hỗ trợ.`)
    }

    if ((type === 'select' || type === 'radio') && (!Array.isArray(field.options) || field.options.length === 0)) {
      errors.push(`Trường ${key} cần có danh sách lựa chọn.`)
    }
  }

  if (!keys.has('fullName')) {
    errors.push('Biểu mẫu phải có trường Họ và tên.')
  }

  if (!keys.has('email')) {
    errors.push('Biểu mẫu phải có trường Email.')
  }

  const emailField = (config.fields || []).find((item: any) => item.key === 'email')
  if (verificationRequired && emailField?.required !== true) {
    errors.push('Email phải là bắt buộc khi bật xác minh email.')
  }

  return {
    config,
    errors,
    isValid: errors.length === 0,
  }
}

async function findFeatureByKey(featureKey: string) {
  return strapi.db.query(FEATURE_UID).findOne({
    where: { key: featureKey },
    select: ['id', 'key', 'name', 'path'],
  })
}

async function getTargetFeatureOptions(tenantId: number) {
  const rows = await strapi.db.query(TENANT_FEATURE_UID).findMany({
    where: {
      tenant: tenantId,
      isEnabled: true,
      feature: {
        key: {
          $in: SUPPORTED_TARGET_FEATURES,
        },
      },
    },
    populate: {
      feature: {
        select: ['id', 'key', 'name', 'path'],
      },
    },
  })

  return (rows || [])
    .map((row: any) => row?.feature)
    .filter((feature: any) => feature?.id)
    .map((feature: any) => ({
      id: feature.id,
      key: normalizeText(feature.key),
      name: normalizeText(feature.name),
      path: normalizeText(feature.path) || null,
    }))
}

async function findRoleByRef(roleRef: unknown) {
  const where = whereByParam(roleRef)
  if (!where) return null
  return strapi.db.query(ROLE_UID).findOne({
    where,
    select: ['id', 'documentId', 'name', 'description', 'type'],
  })
}

async function findTenantRoleAssignment(tenantId: number, roleId: number) {
  return strapi.db.query(TENANT_ROLE_UID).findOne({
    where: {
      tenant: tenantId,
      role: roleId,
    },
    populate: {
      role: {
        select: ['id', 'documentId', 'name', 'description', 'type'],
      },
    },
  })
}

async function resolveTenantRoleAvailability(tenantId: number, roleRef: unknown) {
  const role = await findRoleByRef(roleRef)
  if (!role?.id) {
    return {
      role: null,
      tenantRole: null,
      availabilityStatus: 'missing',
      availabilityLabel: 'Không tìm thấy role',
    }
  }

  const tenantRole = await findTenantRoleAssignment(tenantId, Number(role.id))
  if (!tenantRole?.id) {
    return {
      role,
      tenantRole: null,
      availabilityStatus: 'withdrawn',
      availabilityLabel: 'Không còn được tenant sử dụng',
    }
  }

  if (tenantRole.isActive !== true) {
    return {
      role,
      tenantRole,
      availabilityStatus: 'inactive',
      availabilityLabel: 'Đã bị khóa hoặc thu hồi',
    }
  }

  return {
    role,
    tenantRole,
    availabilityStatus: 'active',
    availabilityLabel: 'Đang hoạt động',
  }
}

async function ensureDefaultTenantRoleAllowed(tenantId: number, roleRef: unknown) {
  if (roleRef === null || roleRef === undefined || roleRef === '') {
    return null
  }

  const role = await findRoleByRef(roleRef)
  if (!role?.id) {
    httpError(404, 'TENANT_ROLE_NOT_FOUND: Không tìm thấy role đã chọn', 'TENANT_ROLE_NOT_FOUND')
  }

  const tenantRole = await findTenantRoleAssignment(tenantId, Number(role.id))
  if (!tenantRole?.id) {
    httpError(409, 'TENANT_ROLE_NOT_AVAILABLE: Role chưa được tenant hiện tại cấp sử dụng', 'TENANT_ROLE_NOT_AVAILABLE')
  }

  if (tenantRole.isActive !== true) {
    httpError(409, 'TENANT_ROLE_INACTIVE: Role đã bị khóa hoặc thu hồi khỏi tenant', 'TENANT_ROLE_INACTIVE')
  }

  return role
}

async function ensureTargetFeatureAllowed(tenantId: number, targetFeature: string) {
  const feature = await findFeatureByKey(targetFeature)
  if (!feature?.id) {
    httpError(400, 'targetFeature is invalid')
  }

  const tenantFeature = await strapi.db.query(TENANT_FEATURE_UID).findOne({
    where: {
      tenant: tenantId,
      feature: feature.id,
      isEnabled: true,
    },
    select: ['id'],
  })

  if (!tenantFeature?.id) {
    httpError(400, 'targetFeature is not enabled for this tenant')
  }

  return feature
}

async function findCampaignById(tenantId: number | string, id: number | string) {
  const tenantWhere = whereByParam(tenantId)
  if (!tenantWhere) {
    httpError(400, 'Tenant context is required')
  }

  return strapi.db.query(REGISTRATION_CAMPAIGN_UID).findOne({
    where: {
      id,
      tenant: tenantWhere,
      ...getNonDeletedWhere(),
    },
    populate: {
      tenant: {
        select: ['id', 'name', 'code', 'shortName', 'slogan'],
      },
      coverImage: {
        select: ['id', 'name', 'url', 'formats'],
      },
      defaultTenantRole: {
        select: ['id', 'documentId', 'name', 'description', 'type'],
      },
      verificationNotificationTemplate: {
        select: CAMPAIGN_EMAIL_TEMPLATE_SELECT,
      },
      completionNotificationTemplate: {
        select: CAMPAIGN_EMAIL_TEMPLATE_SELECT,
      },
      rejectionNotificationTemplate: {
        select: CAMPAIGN_EMAIL_TEMPLATE_SELECT,
      },
    },
  })
}

async function countCampaignRegistrations(campaignId: number) {
  const registrations = await strapi.db.query(CAMPAIGN_REGISTRATION_UID).findMany({
    where: {
      campaign: campaignId,
      ...getNonDeletedWhere(),
    },
    select: ['id', 'status'],
  })

  const counts = {
    total: 0,
    pendingVerification: 0,
    verified: 0,
    approved: 0,
    rejected: 0,
    cancelledOrExpired: 0,
  }

  for (const item of registrations || []) {
    counts.total += 1
    const status = normalizeStatus(item?.status)
    if (status === 'pending_verification') counts.pendingVerification += 1
    else if (status === 'verified') counts.verified += 1
    else if (status === 'approved') counts.approved += 1
    else if (status === 'rejected') counts.rejected += 1
    else if (status === 'cancelled' || status === 'expired') counts.cancelledOrExpired += 1
  }

  return counts
}

async function hasApprovedRegistrations(campaignId: number) {
  const count = await strapi.db.query(CAMPAIGN_REGISTRATION_UID).count({
    where: {
      campaign: campaignId,
      status: 'approved',
      ...getNonDeletedWhere(),
    },
  })

  return Number(count) > 0
}

async function hasAnyRegistrations(campaignId: number) {
  const count = await strapi.db.query(CAMPAIGN_REGISTRATION_UID).count({
    where: {
      campaign: campaignId,
      ...getNonDeletedWhere(),
    },
  })

  return Number(count) > 0
}

function buildCampaignPublicJoinPath(campaign: any) {
  const campaignCode = normalizeCode(campaign?.code)
  if (!campaignCode) return null
  return `/join/${encodeURIComponent(campaignCode)}`
}

async function buildCampaignPublicJoinUrl(ctx: any, campaign: any) {
  const joinPath = buildCampaignPublicJoinPath(campaign)
  if (!joinPath) return null
  const tenantId = normalizePositiveInteger(campaign?.tenant?.id || campaign?.tenant)
  const baseUrl = await buildVerificationRedirectUrl(ctx, { tenant: tenantId ? { id: tenantId } : null, redirectPath: joinPath }, 'success', 'ok')
  if (!baseUrl) return joinPath
  return baseUrl.replace(/[?&]verificationStatus=success(?:&message=ok)?$/, '').replace(/\?message=ok$/, '')
}

function buildCampaignValidationState(campaign: any, options: { emailTemplates: any, registrationCount: number }) {
  const warnings: string[] = []
  const errors: string[] = []

  if (!normalizeCode(campaign?.code)) {
    warnings.push('Chiến dịch chưa có mã chiến dịch.')
  }

  if (!normalizeText(campaign?.targetFeature)) {
    errors.push('Chiến dịch chưa cấu hình chức năng được cấp.')
  }

  if (!campaign?.defaultTenantRole?.id) {
    warnings.push('Chiến dịch chưa có vai trò mặc định để cấp khi người dùng tham gia tenant.')
  } else if (campaign?.defaultTenantRole?.isAvailable === false) {
    warnings.push('Vai trò mặc định hiện không còn được tenant sử dụng.')
  }

  if (normalizeBoolean(campaign?.verificationRequired, true) && normalizeStatus(campaign?.verificationMethod) === 'none') {
    errors.push('Đang bật xác minh email nhưng phương thức xác minh là none.')
  }

  if (normalizeStatus(campaign?.registrationMode) === 'approval_required' && normalizeBoolean(campaign?.autoApprove, true)) {
    errors.push('Chế độ cần phê duyệt không thể bật tự động duyệt.')
  }

  const startAt = toDateOrNull(campaign?.startAt)
  const endAt = toDateOrNull(campaign?.endAt)
  if (startAt && endAt && endAt.getTime() < startAt.getTime()) {
    errors.push('Thời gian kết thúc không được nhỏ hơn thời gian bắt đầu.')
  }

  const redirectPath = normalizeText(campaign?.redirectPath)
  if (redirectPath && !redirectPath.startsWith('/')) {
    errors.push('redirectPath phải bắt đầu bằng /.')
  }

  const formValidation = validateFormConfig(campaign?.formConfig, normalizeBoolean(campaign?.verificationRequired, true))
  errors.push(...formValidation.errors)

  const verificationRequired = normalizeBoolean(campaign?.verificationRequired, true)
  const autoApprove = normalizeBoolean(campaign?.autoApprove, true)
  const registrationMode = normalizeStatus(campaign?.registrationMode)

  if (verificationRequired && !options.emailTemplates?.verification?.hasUsableTemplate) {
    warnings.push(getCampaignEmailTemplateConfig('verificationNotificationTemplate').missingWarning)
  }

  if (autoApprove && !options.emailTemplates?.completion?.hasUsableTemplate) {
    warnings.push(getCampaignEmailTemplateConfig('completionNotificationTemplate').missingWarning)
  }

  if (registrationMode === 'approval_required' && !options.emailTemplates?.rejection?.hasUsableTemplate) {
    warnings.push(getCampaignEmailTemplateConfig('rejectionNotificationTemplate').missingWarning)
  }

  if (options.registrationCount > 0 && normalizeStatus(campaign?.status) === 'draft') {
    warnings.push('Chiến dịch đang ở trạng thái bản nháp nhưng đã có bản đăng ký.')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

function toCampaignStatusMeta(status: string) {
  const normalized = normalizeStatus(status)
  return {
    value: normalized || 'draft',
    label: STATUS_LABELS[normalized] || 'Bản nháp',
  }
}

async function toCampaignListItem(ctx: any, campaign: any) {
  const counts = await countCampaignRegistrations(Number(campaign.id))
  const roleAvailability = campaign?.defaultTenantRole?.id
    ? await resolveTenantRoleAvailability(Number(campaign?.tenant?.id || campaign?.tenant || 0), campaign.defaultTenantRole.id)
    : null
  const publicJoinPath = buildCampaignPublicJoinPath(campaign)
  return {
    id: campaign.id,
    name: normalizeText(campaign.name),
    code: normalizeCode(campaign.code),
    shortDescription: normalizeText(campaign.shortDescription) || null,
    targetFeature: normalizeText(campaign.targetFeature),
    status: normalizeStatus(campaign.status) || 'draft',
    statusLabel: toCampaignStatusMeta(campaign.status).label,
    startAt: campaign.startAt || null,
    endAt: campaign.endAt || null,
    registrationCount: counts.total,
    approvedCount: counts.approved,
    createdAt: campaign.createdAt || null,
    updatedAt: campaign.updatedAt || null,
    defaultTenantRole: roleAvailability?.role
      ? toSerializableRole(roleAvailability.role, roleAvailability.availabilityStatus, roleAvailability.availabilityLabel)
      : null,
    publicJoinPath,
    publicJoinUrl: publicJoinPath ? await buildCampaignPublicJoinUrl(ctx, campaign) : null,
  }
}

async function toCampaignDetail(ctx: any, campaign: any) {
  const counts = await countCampaignRegistrations(Number(campaign.id))
  const maxRegistrations = normalizePositiveInteger(campaign?.maxRegistrations)
  const emailTemplates = await buildCampaignEmailTemplateState(campaign)
  const roleAvailability = campaign?.defaultTenantRole?.id
    ? await resolveTenantRoleAvailability(Number(campaign?.tenant?.id || campaign?.tenant || 0), campaign.defaultTenantRole.id)
    : null
  const defaultTenantRole = roleAvailability?.role
    ? toSerializableRole(roleAvailability.role, roleAvailability.availabilityStatus, roleAvailability.availabilityLabel)
    : null
  const validation = buildCampaignValidationState({
    ...campaign,
    defaultTenantRole,
  }, {
    emailTemplates,
    registrationCount: counts.total,
  })
  const publicJoinPath = buildCampaignPublicJoinPath(campaign)
  const publicJoinUrl = publicJoinPath ? await buildCampaignPublicJoinUrl(ctx, campaign) : null
  const approvedRegistrations = counts.approved
  const formValidation = validateFormConfig(campaign?.formConfig, normalizeBoolean(campaign?.verificationRequired, true))

  return {
    id: campaign.id,
    name: normalizeText(campaign.name),
    code: normalizeCode(campaign.code),
    description: normalizeText(campaign.description) || null,
    shortDescription: normalizeText(campaign.shortDescription) || null,
    targetFeature: normalizeText(campaign.targetFeature),
    defaultTenantRole,
    status: normalizeStatus(campaign.status) || 'draft',
    statusLabel: toCampaignStatusMeta(campaign.status).label,
    registrationMode: normalizeStatus(campaign.registrationMode) || 'public_code',
    verificationRequired: normalizeBoolean(campaign.verificationRequired, true),
    verificationMethod: normalizeStatus(campaign.verificationMethod) || 'email_link',
    verificationExpireMinutes: normalizePositiveInteger(campaign.verificationExpireMinutes) || 1440,
    autoApprove: normalizeBoolean(campaign.autoApprove, true),
    requireTermsAcceptance: normalizeBoolean(campaign.requireTermsAcceptance, false),
    termsContent: normalizeText(campaign.termsContent) || null,
    successMessage: normalizeText(campaign.successMessage) || null,
    redirectPath: normalizePath(campaign.redirectPath),
    startAt: campaign.startAt || null,
    endAt: campaign.endAt || null,
    maxRegistrations,
    remainingRegistrations: maxRegistrations ? Math.max(0, maxRegistrations - counts.total) : null,
    createdAt: campaign.createdAt || null,
    updatedAt: campaign.updatedAt || null,
    coverImage: toSerializableMedia(campaign.coverImage),
    formConfig: formValidation.config,
    formValidation,
    counts,
    publicJoinPath,
    publicJoinUrl,
    publicApiPath: normalizeCode(campaign.code) ? `/api/public/registration-campaigns/${encodeURIComponent(normalizeCode(campaign.code))}` : null,
    tenant: campaign.tenant
      ? {
          id: campaign.tenant.id,
          code: normalizeText(campaign.tenant.code),
          name: normalizeText(campaign.tenant.name) || normalizeText(campaign.tenant.shortName) || normalizeText(campaign.tenant.code),
          shortName: normalizeText(campaign.tenant.shortName) || null,
        }
      : null,
    emailTemplates,
    validation,
    readiness: {
      hasName: Boolean(normalizeText(campaign.name)),
      hasCode: Boolean(normalizeCode(campaign.code)),
      hasTargetFeature: Boolean(normalizeText(campaign.targetFeature)),
      hasDefaultTenantRole: defaultTenantRole?.isAvailable === true,
      emailServiceReady: emailTemplates.verification.hasUsableTemplate || !normalizeBoolean(campaign.verificationRequired, true),
      hasVerificationTemplate: !normalizeBoolean(campaign.verificationRequired, true) || emailTemplates.verification.hasUsableTemplate,
      hasCompletionTemplate: !normalizeBoolean(campaign.autoApprove, true) || emailTemplates.completion.hasUsableTemplate,
      hasRejectionTemplate: normalizeStatus(campaign.registrationMode) !== 'approval_required' || emailTemplates.rejection.hasUsableTemplate,
      formValid: formValidation.isValid,
      termsValid: !normalizeBoolean(campaign.requireTermsAcceptance, false) || Boolean(normalizeText(campaign.termsContent)),
      redirectPathValid: !normalizeText(campaign.redirectPath) || String(campaign.redirectPath).startsWith('/'),
      timeValid: !(toDateOrNull(campaign.startAt) && toDateOrNull(campaign.endAt) && toDateOrNull(campaign.endAt)!.getTime() < toDateOrNull(campaign.startAt)!.getTime()),
    },
    canEditTargetFeature: approvedRegistrations === 0,
    hasRegistrations: counts.total > 0,
    hasApprovedRegistrations: approvedRegistrations > 0,
  }
}

function buildCampaignListWhere(tenantId: number, query: Record<string, unknown>) {
  const where: Record<string, unknown> = {
    tenant: tenantId,
    ...getNonDeletedWhere(),
  }

  const q = normalizeText(query.q)
  const name = normalizeText(query.name)
  const code = normalizeText(query.code)
  const status = normalizeStatus(query.status)
  const targetFeature = normalizeText(query.targetFeature)

  if (q) {
    where.$and = [
      {
        $or: [
          { name: { $containsi: q } },
          { code: { $containsi: q } },
          { shortDescription: { $containsi: q } },
        ],
      },
    ]
  }

  if (name) {
    where.name = { $containsi: name }
  }

  if (code) {
    where.code = { $containsi: code }
  }

  if (status) {
    where.status = status
  }

  if (targetFeature) {
    where.targetFeature = targetFeature
  }

  return where
}

function resolveCampaignSort(query: Record<string, unknown>) {
  const sort = normalizeText(query.sort).toLowerCase()
  if (sort === 'startat:asc') return [{ startAt: 'asc' }, { createdAt: 'desc' }]
  if (sort === 'startat:desc') return [{ startAt: 'desc' }, { createdAt: 'desc' }]
  if (sort === 'createdat:asc') return [{ createdAt: 'asc' }]
  return [{ createdAt: 'desc' }]
}

async function findRegistrationById(tenantId: number, campaignId: number, registrationId: number) {
  return strapi.db.query(CAMPAIGN_REGISTRATION_UID).findOne({
    where: {
      id: registrationId,
      tenant: tenantId,
      campaign: campaignId,
      ...getNonDeletedWhere(),
    },
    populate: {
      user: {
        select: ['id', 'email', 'fullName', 'phone', 'confirmed'],
      },
      membership: {
        select: ['id', 'userTenantStatus'],
      },
      approvedBy: {
        select: ['id', 'email', 'fullName'],
      },
      rejectedBy: {
        select: ['id', 'email', 'fullName'],
      },
      campaign: {
        populate: {
          tenant: {
            select: ['id', 'code', 'name', 'shortName'],
          },
        },
      },
    },
  })
}

async function getMembershipFeatureGrantMap(membershipIds: number[], featureKey: string) {
  if (membershipIds.length === 0 || !featureKey) {
    return new Map<number, { granted: boolean, roleIds: number[] }>()
  }

  const feature = await findFeatureByKey(featureKey)
  if (!feature?.id) {
    return new Map<number, { granted: boolean, roleIds: number[] }>()
  }

  const assignments = await strapi.db.query(USER_TENANT_ROLE_UID).findMany({
    where: {
      userTenant: {
        id: {
          $in: membershipIds,
        },
      },
      userTenantRoleStatus: 'active',
    },
    populate: {
      role: {
        select: ['id', 'name', 'type'],
      },
      userTenant: {
        select: ['id'],
      },
    },
  })

  const roleIds = Array.from(new Set((assignments || [])
    .map((item: any) => normalizePositiveInteger(item?.role?.id || item?.role))
    .filter((value): value is number => Boolean(value))))

  const roleFeatures = roleIds.length > 0
    ? await strapi.db.query(ROLE_FEATURE_UID).findMany({
      where: {
        role: {
          id: {
            $in: roleIds,
          },
        },
        feature: feature.id,
        isActive: true,
      },
      populate: {
        role: {
          select: ['id'],
        },
      },
    })
    : []

  const grantedRoleIds = new Set((roleFeatures || [])
    .map((row: any) => normalizePositiveInteger(row?.role?.id || row?.role))
    .filter((value): value is number => Boolean(value)))

  const map = new Map<number, { granted: boolean, roleIds: number[] }>()
  for (const item of assignments || []) {
    const membershipId = normalizePositiveInteger(item?.userTenant?.id || item?.userTenant)
    const roleId = normalizePositiveInteger(item?.role?.id || item?.role)
    if (!membershipId || !roleId) continue
    const current = map.get(membershipId) || { granted: false, roleIds: [] }
    current.roleIds.push(roleId)
    if (grantedRoleIds.has(roleId)) {
      current.granted = true
    }
    map.set(membershipId, current)
  }

  return map
}

async function findLatestMailLogsForRegistrations(tenantId: number, registrationIds: number[]) {
  const result = new Map<number, any>()
  if (registrationIds.length === 0) return result

  const logs = await strapi.db.query(MAIL_LOG_UID).findMany({
    where: {
      tenant: tenantId,
      mailType: {
        $in: getMailLogTypes(),
      },
    },
    orderBy: [{ queuedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    select: ['id', 'mailType', 'toEmail', 'subject', 'sendStatus', 'attempts', 'lastError', 'queuedAt', 'sentAt', 'failedAt', 'createdAt', 'metadata'],
    limit: 1000,
  })

  for (const log of logs || []) {
    const metadata = log?.metadata && typeof log.metadata === 'object' && !Array.isArray(log.metadata)
      ? log.metadata as Record<string, unknown>
      : {}
    const registrationId = normalizePositiveInteger(metadata.registrationId)
    if (!registrationId || !registrationIds.includes(registrationId)) continue

    const current = result.get(registrationId) || {
      latest: null,
      verification: null,
      completion: null,
      rejection: null,
    }

    if (!current.latest) {
      current.latest = log
    }

    const mailType = normalizeText(log?.mailType).toLowerCase()
    if (!current.verification && mailType === REGISTRATION_VERIFICATION_TEMPLATE_CODE) {
      current.verification = log
    }
    if (!current.completion && mailType === REGISTRATION_COMPLETION_TEMPLATE_CODE) {
      current.completion = log
    }
    if (!current.rejection && mailType === REGISTRATION_REJECTION_TEMPLATE_CODE) {
      current.rejection = log
    }

    result.set(registrationId, current)
  }

  return result
}

function toEmailStatusSummary(log: any) {
  if (!log?.id) return null
  return {
    id: log.id,
    mailType: normalizeText(log.mailType),
    toEmail: normalizeText(log.toEmail),
    subject: normalizeText(log.subject),
    sendStatus: normalizeText(log.sendStatus),
    attempts: normalizePositiveInteger(log.attempts) || 0,
    queuedAt: log.queuedAt || log.createdAt || null,
    sentAt: log.sentAt || null,
    failedAt: log.failedAt || null,
    lastError: normalizeText(log.lastError) || null,
  }
}

function toRegistrationLabel(status: string) {
  const normalized = normalizeStatus(status)
  if (normalized === 'pending_verification') return 'Chờ xác minh'
  if (normalized === 'verified') return 'Đã xác minh'
  if (normalized === 'approved') return 'Đã hoàn tất'
  if (normalized === 'rejected') return 'Bị từ chối'
  if (normalized === 'cancelled') return 'Đã hủy'
  if (normalized === 'expired') return 'Đã hết hạn'
  return normalized || '-'
}

function toRegistrationSummary(row: any, grantState?: { granted: boolean, roleIds: number[] } | null, emailState?: any) {
  const metadata = row?.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
    ? row.metadata as Record<string, unknown>
    : {}

  const latestEmail = emailState?.latest || null
  const verificationEmail = emailState?.verification || null
  const completionEmail = emailState?.completion || null
  const rejectionEmail = emailState?.rejection || null

  return {
    id: row?.id,
    fullName: normalizeText(row?.fullName),
    email: ensureEmail(row?.email),
    phone: normalizeText(row?.phone) || null,
    status: normalizeStatus(row?.status) || 'pending_verification',
    statusLabel: toRegistrationLabel(row?.status),
    registrationSource: normalizeStatus(row?.registrationSource) || 'campaign_link',
    registeredAt: row?.registeredAt || null,
    verifiedAt: row?.verifiedAt || null,
    approvedAt: row?.approvedAt || null,
    rejectedAt: row?.rejectedAt || null,
    rejectionReason: normalizeText(row?.rejectionReason) || null,
    cancelledAt: row?.cancelledAt || null,
    verificationExpiresAt: row?.verificationExpiresAt || null,
    verificationSentAt: row?.verificationSentAt || null,
    verificationSendCount: normalizePositiveInteger(row?.verificationSendCount) || 0,
    formData: row?.formData && typeof row.formData === 'object' ? row.formData : {},
    user: row?.user
      ? {
          id: row.user.id,
          email: normalizeText(row.user.email),
          fullName: normalizeText(row.user.fullName) || null,
          confirmed: normalizeBoolean(row.user.confirmed, false),
        }
      : null,
    membership: row?.membership
      ? {
          id: row.membership.id,
          status: normalizeStatus(row.membership.userTenantStatus) || null,
        }
      : null,
    targetFeatureGranted: Boolean(grantState?.granted),
    targetFeatureRoleIds: Array.isArray(grantState?.roleIds) ? grantState.roleIds : [],
    latestEmail: latestEmail
      ? {
          id: latestEmail.id,
          mailType: normalizeText(latestEmail.mailType),
          toEmail: normalizeText(latestEmail.toEmail),
          subject: normalizeText(latestEmail.subject),
          sendStatus: normalizeText(latestEmail.sendStatus),
          attempts: normalizePositiveInteger(latestEmail.attempts) || 0,
          queuedAt: latestEmail.queuedAt || latestEmail.createdAt || null,
          sentAt: latestEmail.sentAt || null,
          failedAt: latestEmail.failedAt || null,
          lastError: normalizeText(latestEmail.lastError) || null,
        }
      : null,
    verificationEmail: toEmailStatusSummary(verificationEmail),
    completionEmail: toEmailStatusSummary(completionEmail),
    rejectionEmail: toEmailStatusSummary(rejectionEmail),
    mailStatus: latestEmail ? normalizeText(latestEmail.sendStatus) : null,
    metadata: {
      targetRoleName: normalizeText(metadata.targetRoleName) || null,
      targetFeatureName: normalizeText(metadata.targetFeatureName) || null,
      activationRequired: normalizeBoolean(metadata.activationRequired, false),
      activationEmailSent: normalizeBoolean(metadata.activationEmailSent, false),
      activationInviteTemplateCode: normalizeText(metadata.activationInviteTemplateCode) || null,
      completionStatus: normalizeText(metadata.completionStatus) || null,
      completionError: normalizeText(metadata.completionError) || null,
      completionErrorCode: normalizeText(metadata.completionErrorCode) || null,
    },
    completionStatus: normalizeText(metadata.completionStatus) || null,
    completionError: normalizeText(metadata.completionError) || null,
    completionErrorCode: normalizeText(metadata.completionErrorCode) || null,
  }
}

function buildRegistrationWhere(tenantId: number, campaignId: number, query: Record<string, unknown>) {
  const where: Record<string, unknown> = {
    tenant: tenantId,
    campaign: campaignId,
    ...getNonDeletedWhere(),
  }

  const q = normalizeText(query.q)
  const status = normalizeStatus(query.status)
  const email = normalizeText(query.email)
  const phone = normalizeText(query.phone)
  const hasUser = normalizeText(query.hasUser)
  const hasMembership = normalizeText(query.hasMembership)
  const dateFrom = toDateOrNull(query.dateFrom)
  const dateTo = toDateOrNull(query.dateTo)

  if (q) {
    where.$and = [
      {
        $or: [
          { fullName: { $containsi: q } },
          { email: { $containsi: q } },
          { phone: { $containsi: q } },
        ],
      },
    ]
  }

  if (status) {
    where.status = status
  }

  if (email) {
    where.email = { $containsi: email }
  }

  if (phone) {
    where.phone = { $containsi: phone }
  }

  if (hasUser === 'true') where.user = { id: { $notNull: true } }
  if (hasUser === 'false') where.user = { id: { $null: true } }
  if (hasMembership === 'true') where.membership = { id: { $notNull: true } }
  if (hasMembership === 'false') where.membership = { id: { $null: true } }

  if (dateFrom || dateTo) {
    where.registeredAt = {
      ...(dateFrom ? { $gte: dateFrom.toISOString() } : {}),
      ...(dateTo ? { $lte: dateTo.toISOString() } : {}),
    }
  }

  return where
}

function resolveRegistrationSort(query: Record<string, unknown>) {
  const sort = normalizeText(query.sort).toLowerCase()
  if (sort === 'registeredat:asc') return [{ registeredAt: 'asc' }, { createdAt: 'asc' }]
  if (sort === 'verifiedat:desc') return [{ verifiedAt: 'desc' }, { createdAt: 'desc' }]
  return [{ registeredAt: 'desc' }, { createdAt: 'desc' }]
}

function buildMailMonitorItem(log: any) {
  const metadata = log?.metadata && typeof log.metadata === 'object' && !Array.isArray(log.metadata)
    ? log.metadata as Record<string, unknown>
    : {}

  return {
    id: log?.id,
    toEmail: normalizeText(log?.toEmail),
    mailType: normalizeText(log?.mailType),
    subject: normalizeText(log?.subject),
    sendStatus: normalizeText(log?.sendStatus) || 'QUEUED',
    attempts: normalizePositiveInteger(log?.attempts) || 0,
    queuedAt: log?.queuedAt || log?.createdAt || null,
    sentAt: log?.sentAt || null,
    failedAt: log?.failedAt || null,
    lastError: normalizeText(log?.lastError) || normalizeText(log?.lastProviderError) || normalizeText(log?.fallbackError) || null,
    registrationId: normalizePositiveInteger(metadata.registrationId),
    campaignId: normalizePositiveInteger(metadata.campaignId),
    metadata: sanitizeMetadata(metadata),
    html: sanitizeMailContent(log?.html),
    text: sanitizeMailContent(log?.text),
  }
}

async function listCampaignMailLogs(tenantId: number, campaignId: number, query: Record<string, unknown>) {
  const mailLogs = await strapi.db.query(MAIL_LOG_UID).findMany({
    where: {
      tenant: tenantId,
      mailType: {
        $in: getMailLogTypes(),
      },
    },
    orderBy: [{ queuedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    select: ['id', 'toEmail', 'mailType', 'subject', 'sendStatus', 'attempts', 'lastError', 'lastProviderError', 'fallbackError', 'queuedAt', 'sentAt', 'failedAt', 'createdAt', 'html', 'text', 'metadata'],
    limit: 1000,
  })

  const registrationId = normalizePositiveInteger(query.registrationId)
  const sendStatus = normalizeText(query.sendStatus).toUpperCase()
  const mailType = normalizeText(query.mailType)
  const q = normalizeText(query.q).toLowerCase()
  const filtered = (mailLogs || []).filter((item: any) => {
    const metadata = item?.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
      ? item.metadata as Record<string, unknown>
      : {}
    const logCampaignId = normalizePositiveInteger(metadata.campaignId)
    const logRegistrationId = normalizePositiveInteger(metadata.registrationId)
    if (logCampaignId !== campaignId) return false
    if (registrationId && logRegistrationId !== registrationId) return false
    if (sendStatus && normalizeText(item?.sendStatus).toUpperCase() !== sendStatus) return false
    if (mailType && !normalizeText(item?.mailType).toLowerCase().includes(mailType.toLowerCase())) return false
    if (q) {
      const haystack = [item?.toEmail, item?.subject, item?.mailType].map((value) => normalizeText(value).toLowerCase()).join(' ')
      if (!haystack.includes(q)) return false
    }
    return true
  })

  const page = Math.max(1, normalizePositiveInteger(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, normalizePositiveInteger(query.pageSize) || 20))
  const start = (page - 1) * pageSize
  const pageRows = filtered.slice(start, start + pageSize).map(buildMailMonitorItem)

  return {
    rows: pageRows,
    pagination: {
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(filtered.length / pageSize)),
      total: filtered.length,
    },
  }
}

async function findCampaignMailLogDetail(tenantId: number, campaignId: number, mailLogId: number) {
  const log = await strapi.db.query(MAIL_LOG_UID).findOne({
    where: {
      id: mailLogId,
      tenant: tenantId,
    },
    select: ['id', 'toEmail', 'mailType', 'subject', 'sendStatus', 'attempts', 'lastError', 'lastProviderError', 'fallbackError', 'queuedAt', 'sentAt', 'failedAt', 'createdAt', 'html', 'text', 'metadata'],
  })

  if (!log?.id) {
    httpError(404, 'Mail log not found')
  }

  const metadata = log?.metadata && typeof log.metadata === 'object' && !Array.isArray(log.metadata)
    ? log.metadata as Record<string, unknown>
    : {}

  if (normalizePositiveInteger(metadata.campaignId) !== campaignId) {
    httpError(404, 'Mail log not found')
  }

  return buildMailMonitorItem(log)
}

async function resendRegistrationVerificationById(registrationId: number) {
  const registration = await strapi.db.query(CAMPAIGN_REGISTRATION_UID).findOne({
    where: { id: registrationId },
    populate: {
      campaign: {
        populate: {
          tenant: {
            select: ['id', 'code', 'name', 'shortName'],
          },
        },
      },
    },
  })

  if (!registration?.id) {
    httpError(404, 'Registration not found')
  }

  const status = normalizeStatus(registration.status)
  if (!['pending_verification', 'expired'].includes(status)) {
    httpError(409, 'Only pending verification registrations can resend email')
  }

  const verificationExpireMinutes = normalizePositiveInteger(registration?.campaign?.verificationExpireMinutes) || 1440
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  const crypto = await import('node:crypto')
  const verificationTokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const now = new Date()
  const verificationExpiresAt = new Date(now.getTime() + verificationExpireMinutes * 60 * 1000)

  await strapi.db.query(CAMPAIGN_REGISTRATION_UID).update({
    where: { id: registrationId },
    data: {
      verificationTokenHash,
      verificationExpiresAt,
      verificationSentAt: now,
      lastVerificationRequestAt: now,
      verificationSendCount: (normalizePositiveInteger(registration.verificationSendCount) || 0) + 1,
      status: 'pending_verification',
    },
  })

  const verificationLink = `${normalizeText(process.env.BACKEND_URL).replace(/\/+$/, '') || 'http://localhost:1339'}/api/public/campaign-registrations/verify?token=${encodeURIComponent(token)}`
  const notificationService = strapi.service('api::notification.notification') as any
  try {
    await notificationService.sendNotification(REGISTRATION_VERIFICATION_TEMPLATE_CODE, Number(registration.campaign.tenant.id), {
      email: ensureEmail(registration.email),
      fullName: normalizeText(registration.fullName) || ensureEmail(registration.email),
      tenantName: normalizeText(registration.campaign.tenant.name) || normalizeText(registration.campaign.tenant.shortName) || 'the system',
      tenantCode: normalizeText(registration.campaign.tenant.code),
      campaignName: normalizeText(registration.campaign.name),
      verificationLink,
    })
    return {
      ok: true,
      message: 'Đã gửi lại email xác minh',
    }
  } catch {
    return {
      ok: true,
      message: 'Đã cập nhật token xác minh. Hệ thống sẽ dùng fallback email nếu template không sẵn sàng.',
    }
  }
}

export async function listAdminRegistrationCampaigns(ctx: any, tenantId: number, query: Record<string, unknown>) {
  const page = Math.max(1, normalizePositiveInteger(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, normalizePositiveInteger(query.pageSize) || 10))
  const start = (page - 1) * pageSize
  const where = buildCampaignListWhere(tenantId, query)
  const sort = resolveCampaignSort(query)

  const [rows, total] = await Promise.all([
    strapi.db.query(REGISTRATION_CAMPAIGN_UID).findMany({
      where,
      offset: start,
      limit: pageSize,
      orderBy: sort,
      populate: {
        tenant: {
          select: ['id', 'name', 'code', 'shortName'],
        },
        coverImage: {
          select: ['id', 'name', 'url', 'formats'],
        },
        defaultTenantRole: {
          select: ['id', 'documentId', 'name', 'description', 'type'],
        },
      },
    }),
    strapi.db.query(REGISTRATION_CAMPAIGN_UID).count({ where }),
  ])

  const data = []
  for (const row of rows || []) {
    data.push(await toCampaignListItem(ctx, row))
  }

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
}

export async function getRegistrationCampaignFormOptions(tenantId: number) {
  const availableRoles = await getTenantEnabledRoles(tenantId)
  return {
    targetFeatures: await getTargetFeatureOptions(tenantId),
    availableRoles,
    registrationModes: [
      { value: 'public_link', label: 'Công khai bằng link' },
      { value: 'public_code', label: 'Công khai bằng mã' },
      { value: 'invite_only', label: 'Chỉ người có lời mời' },
      { value: 'approval_required', label: 'Cần phê duyệt' },
      { value: 'admin_only', label: 'Chỉ quản trị viên thêm' },
    ],
    verificationMethods: [
      { value: 'email_link', label: 'Liên kết qua email', disabled: false },
      { value: 'email_otp', label: 'Mã OTP qua email', disabled: true },
      { value: 'none', label: 'Không xác minh', disabled: true },
    ],
    verificationExpirePresets: [30, 60, 360, 1440, 2880],
    supportedTargetFeatureKeys: SUPPORTED_TARGET_FEATURES,
  }
}

export async function createAdminRegistrationCampaign(tenantId: number, payload: Record<string, unknown>) {
  const name = ensureRequiredText(payload.name, 'name')
  const code = normalizeCode(ensureRequiredText(payload.code, 'code'))
  const targetFeature = ensureRequiredText(payload.targetFeature, 'targetFeature')
  const defaultTenantRole = await ensureDefaultTenantRoleAllowed(tenantId, payload.defaultTenantRole)
  const shortDescription = normalizeText(payload.shortDescription) || null
  const startAt = toDateOrNull(payload.startAt)
  const endAt = toDateOrNull(payload.endAt)
  const maxRegistrations = normalizePositiveInteger(payload.maxRegistrations)

  if (startAt && endAt && endAt.getTime() < startAt.getTime()) {
    httpError(400, 'endAt must be greater than or equal to startAt')
  }

  await ensureTargetFeatureAllowed(tenantId, targetFeature)

  const duplicate = await strapi.db.query(REGISTRATION_CAMPAIGN_UID).findOne({
    where: {
      tenant: tenantId,
      code: {
        $eqi: code,
      },
      ...getNonDeletedWhere(),
    },
    select: ['id'],
  })

  if (duplicate?.id) {
    httpError(409, 'Mã chiến dịch đã tồn tại trong tenant hiện tại')
  }

  const created = await strapi.db.query(REGISTRATION_CAMPAIGN_UID).create({
    data: {
      tenant: tenantId,
      name,
      code,
      targetFeature,
      defaultTenantRole: defaultTenantRole?.id || null,
      shortDescription,
      startAt: startAt ? startAt.toISOString() : null,
      endAt: endAt ? endAt.toISOString() : null,
      maxRegistrations: maxRegistrations || null,
      status: 'draft',
      registrationMode: 'public_code',
      verificationRequired: true,
      verificationMethod: 'email_link',
      verificationExpireMinutes: 1440,
      autoApprove: true,
      requireTermsAcceptance: false,
      formConfig: buildDefaultFormConfig(),
      ...(await buildCampaignTemplateRelationData(tenantId, payload)),
    },
  })

  return {
    id: created.id,
  }
}

export async function getAdminRegistrationCampaignDetail(ctx: any, tenantId: number, campaignId: number) {
  const campaign = await findCampaignById(tenantId, campaignId)
  if (!campaign?.id) {
    httpError(404, 'Registration campaign not found')
  }

  return toCampaignDetail(ctx, campaign)
}

export async function updateAdminRegistrationCampaignBasicInfo(tenantId: number, campaignId: number, payload: Record<string, unknown>) {
  const campaign = await findCampaignById(tenantId, campaignId)
  if (!campaign?.id) {
    httpError(404, 'Registration campaign not found')
  }

  const name = ensureRequiredText(payload.name, 'name')
  const code = normalizeCode(ensureRequiredText(payload.code, 'code'))
  const targetFeature = ensureRequiredText(payload.targetFeature, 'targetFeature')
  const defaultTenantRole = await ensureDefaultTenantRoleAllowed(tenantId, payload.defaultTenantRole)
  const startAt = toDateOrNull(payload.startAt)
  const endAt = toDateOrNull(payload.endAt)
  const maxRegistrations = normalizePositiveInteger(payload.maxRegistrations)

  if (startAt && endAt && endAt.getTime() < startAt.getTime()) {
    httpError(400, 'endAt must be greater than or equal to startAt')
  }

  const hasRegistrations = await hasAnyRegistrations(campaignId)
  const approvedExists = await hasApprovedRegistrations(campaignId)
  if (approvedExists && normalizeText(campaign.targetFeature) !== targetFeature) {
    httpError(409, 'Không thể đổi targetFeature khi đã có người đăng ký được hoàn tất')
  }

  if (normalizeCode(campaign.code) !== code) {
    const duplicate = await strapi.db.query(REGISTRATION_CAMPAIGN_UID).findOne({
      where: {
        tenant: tenantId,
        code: {
          $eqi: code,
        },
        id: {
          $ne: campaignId,
        },
        ...getNonDeletedWhere(),
      },
      select: ['id'],
    })
    if (duplicate?.id) {
      httpError(409, 'Mã chiến dịch đã tồn tại trong tenant hiện tại')
    }
  }

  await ensureTargetFeatureAllowed(tenantId, targetFeature)

  const updated = await strapi.db.query(REGISTRATION_CAMPAIGN_UID).update({
    where: { id: campaignId },
    data: {
      name,
      code,
      shortDescription: normalizeText(payload.shortDescription) || null,
      description: normalizeText(payload.description) || null,
      targetFeature,
      defaultTenantRole: defaultTenantRole?.id || null,
      startAt: startAt ? startAt.toISOString() : null,
      endAt: endAt ? endAt.toISOString() : null,
      maxRegistrations: maxRegistrations || null,
      coverImage: payload.coverImage === null ? null : (normalizePositiveInteger(payload.coverImage) || undefined),
      metadata: undefined,
      ...(await buildCampaignTemplateRelationData(tenantId, payload)),
    },
    populate: {
      tenant: {
        select: ['id', 'name', 'code', 'shortName'],
      },
      coverImage: {
        select: ['id', 'name', 'url', 'formats'],
      },
    },
  })

  return {
    id: updated.id,
    codeWarning: hasRegistrations && normalizeCode(campaign.code) !== code,
  }
}

export async function updateAdminRegistrationCampaignConfig(tenantId: number, campaignId: number, payload: Record<string, unknown>) {
  const campaign = await findCampaignById(tenantId, campaignId)
  if (!campaign?.id) {
    httpError(404, 'Registration campaign not found')
  }

  const registrationMode = normalizeStatus(payload.registrationMode) || normalizeStatus(campaign.registrationMode) || 'public_code'
  const verificationRequired = normalizeBoolean(payload.verificationRequired, normalizeBoolean(campaign.verificationRequired, true))
  const verificationMethod = normalizeStatus(payload.verificationMethod) || normalizeStatus(campaign.verificationMethod) || 'email_link'
  const verificationExpireMinutes = normalizePositiveInteger(payload.verificationExpireMinutes) || 1440
  const requireTermsAcceptance = normalizeBoolean(payload.requireTermsAcceptance, normalizeBoolean(campaign.requireTermsAcceptance, false))
  const autoApprove = registrationMode === 'approval_required'
    ? false
    : normalizeBoolean(payload.autoApprove, normalizeBoolean(campaign.autoApprove, true))

  if (!['public_link', 'public_code', 'invite_only', 'approval_required', 'admin_only'].includes(registrationMode)) {
    httpError(400, 'registrationMode is invalid')
  }

  if (verificationMethod !== 'email_link') {
    httpError(400, 'Chỉ hỗ trợ verificationMethod=email_link trong giai đoạn hiện tại')
  }

  const redirectPath = ensurePathOrNull(payload.redirectPath)
  const termsContent = normalizeText(payload.termsContent) || null
  if (requireTermsAcceptance && !termsContent) {
    httpError(400, 'termsContent is required when requireTermsAcceptance is true')
  }

  await strapi.db.query(REGISTRATION_CAMPAIGN_UID).update({
    where: { id: campaignId },
    data: {
      registrationMode,
      verificationRequired,
      verificationMethod,
      verificationExpireMinutes,
      autoApprove,
      requireTermsAcceptance,
      termsContent,
      successMessage: normalizeText(payload.successMessage) || null,
      redirectPath,
      ...(await buildCampaignTemplateRelationData(tenantId, payload)),
    },
  })

  return { id: campaignId }
}

export async function updateAdminRegistrationCampaignForm(tenantId: number, campaignId: number, payload: Record<string, unknown>) {
  const campaign = await findCampaignById(tenantId, campaignId)
  if (!campaign?.id) {
    httpError(404, 'Registration campaign not found')
  }

  const verificationRequired = normalizeBoolean(campaign.verificationRequired, true)
  const validation = validateFormConfig(payload.formConfig, verificationRequired)
  if (!validation.isValid) {
    httpError(400, validation.errors[0] || 'formConfig is invalid')
  }

  await strapi.db.query(REGISTRATION_CAMPAIGN_UID).update({
    where: { id: campaignId },
    data: {
      formConfig: validation.config,
    },
  })

  return { id: campaignId }
}

export async function updateAdminRegistrationCampaignEmailConfig(tenantId: number, campaignId: number, payload: Record<string, unknown>) {
  const campaign = await findCampaignById(tenantId, campaignId)
  if (!campaign?.id) {
    httpError(404, 'Registration campaign not found')
  }

  const relationData = await buildCampaignTemplateRelationData(tenantId, payload)
  await strapi.db.query(REGISTRATION_CAMPAIGN_UID).update({
    where: { id: campaignId },
    data: relationData,
  })

  return { id: campaignId }
}

export async function listAdminCampaignEmailTemplates(
  tenantId: number,
  campaignId: number,
  query: Record<string, unknown>,
  options: { defaultTestEmail?: string | null } = {},
) {
  const campaign = await findCampaignById(tenantId, campaignId)
  if (!campaign?.id) {
    httpError(404, 'Registration campaign not found')
  }

  const service = strapi.service(NOTIFICATION_TEMPLATE_SERVICE_UID) as any
  const grouped = {
    verification: await service.listTenantEmailTemplates(tenantId, {
      q: query.q,
      activeOnly: true,
      compatibleOnly: true,
      ...getCampaignEmailTemplateConfig('verificationNotificationTemplate'),
    }),
    completion: await service.listTenantEmailTemplates(tenantId, {
      q: query.q,
      activeOnly: true,
      compatibleOnly: true,
      ...getCampaignEmailTemplateConfig('completionNotificationTemplate'),
    }),
    rejection: await service.listTenantEmailTemplates(tenantId, {
      q: query.q,
      activeOnly: true,
      compatibleOnly: true,
      ...getCampaignEmailTemplateConfig('rejectionNotificationTemplate'),
    }),
  }

  return {
    defaultTestEmail: normalizeText(options.defaultTestEmail) || null,
    templates: grouped,
    purposes: {
      verification: getCampaignEmailTemplateConfig('verificationNotificationTemplate'),
      completion: getCampaignEmailTemplateConfig('completionNotificationTemplate'),
      rejection: getCampaignEmailTemplateConfig('rejectionNotificationTemplate'),
    },
  }
}

export async function previewAdminCampaignEmailTemplate(
  tenantId: number,
  campaignId: number,
  payload: Record<string, unknown>,
) {
  const campaign = await findCampaignById(tenantId, campaignId)
  if (!campaign?.id) {
    httpError(404, 'Registration campaign not found')
  }

  const fieldName = normalizeText(payload.field)
  if (!CAMPAIGN_EMAIL_TEMPLATE_FIELDS.includes(fieldName as typeof CAMPAIGN_EMAIL_TEMPLATE_FIELDS[number])) {
    httpError(400, 'field is invalid')
  }

  const templateRef = extractRelationRef(payload.templateId ?? payload.templateDocumentId ?? payload.template ?? campaign?.[fieldName])
  if (templateRef === null || templateRef === undefined || templateRef === '') {
    httpError(400, 'templateId is required')
  }

  const service = strapi.service(NOTIFICATION_TEMPLATE_SERVICE_UID) as any
  const preview = await service.previewTemplate(
    templateRef,
    tenantId,
    buildCampaignEmailPreviewData(campaign, getCampaignEmailTemplateConfig(fieldName).purpose),
  )

  return {
    ...preview,
    purpose: getCampaignEmailTemplateConfig(fieldName).purpose,
    sampleData: buildCampaignEmailPreviewData(campaign, getCampaignEmailTemplateConfig(fieldName).purpose),
  }
}

export async function sendAdminCampaignEmailTemplateTest(
  tenantId: number,
  campaignId: number,
  payload: Record<string, unknown>,
  actor: { id?: number | null, email?: string | null } | null,
) {
  const campaign = await findCampaignById(tenantId, campaignId)
  if (!campaign?.id) {
    httpError(404, 'Registration campaign not found')
  }

  const fieldName = normalizeText(payload.field)
  if (!CAMPAIGN_EMAIL_TEMPLATE_FIELDS.includes(fieldName as typeof CAMPAIGN_EMAIL_TEMPLATE_FIELDS[number])) {
    httpError(400, 'field is invalid')
  }

  const templateRef = extractRelationRef(payload.templateId ?? payload.templateDocumentId ?? payload.template ?? campaign?.[fieldName])
  if (templateRef === null || templateRef === undefined || templateRef === '') {
    httpError(400, 'templateId is required')
  }

  const template = await findCampaignNotificationTemplate(tenantId, templateRef, fieldName)
  const recipientEmail = normalizeText(payload.email || actor?.email).toLowerCase()
  if (!recipientEmail) {
    httpError(400, 'email is required')
  }

  const service = strapi.service(NOTIFICATION_TEMPLATE_SERVICE_UID) as any
  const purpose = getCampaignEmailTemplateConfig(fieldName).purpose
  return service.sendTestEmail(
    template.id,
    tenantId,
    recipientEmail,
    {
      ...buildCampaignEmailPreviewData(campaign, purpose),
      mailType: getCampaignEmailTemplateConfig(fieldName).recommendedCodes[0],
    },
    {
      campaignId,
      testPurpose: purpose,
      testTemplateField: fieldName,
      triggeredByUserId: actor?.id || null,
    },
  )
}

export async function updateAdminRegistrationCampaignStatus(tenantId: number, campaignId: number, action: string, payload: Record<string, unknown>) {
  const campaign = await findCampaignById(tenantId, campaignId)
  if (!campaign?.id) {
    httpError(404, 'Registration campaign not found')
  }

  const currentStatus = normalizeStatus(campaign.status) || 'draft'
  const normalizedAction = normalizeStatus(action)

  if (normalizedAction === 'open') {
    if (!['draft', 'paused'].includes(currentStatus)) {
      httpError(409, 'Chỉ có thể mở chiến dịch từ draft hoặc paused')
    }

    const detail = await toCampaignDetail({ request: {}, state: {} }, campaign)
    if (!detail.validation.isValid) {
      httpError(409, detail.validation.errors[0] || 'Chiến dịch chưa đủ điều kiện để mở')
    }

    await strapi.db.query(REGISTRATION_CAMPAIGN_UID).update({
      where: { id: campaignId },
      data: { status: 'open' },
    })
    return { id: campaignId, status: 'open' }
  }

  if (normalizedAction === 'pause') {
    if (currentStatus !== 'open') {
      httpError(409, 'Chỉ có thể tạm dừng chiến dịch đang mở')
    }
    await strapi.db.query(REGISTRATION_CAMPAIGN_UID).update({
      where: { id: campaignId },
      data: { status: 'paused' },
    })
    return { id: campaignId, status: 'paused' }
  }

  if (normalizedAction === 'close') {
    if (!['open', 'paused'].includes(currentStatus)) {
      httpError(409, 'Chỉ có thể đóng chiến dịch đang mở hoặc tạm dừng')
    }
    await strapi.db.query(REGISTRATION_CAMPAIGN_UID).update({
      where: { id: campaignId },
      data: { status: 'closed' },
    })
    return { id: campaignId, status: 'closed' }
  }

  if (normalizedAction === 'cancel') {
    if (currentStatus === 'cancelled') {
      return { id: campaignId, status: 'cancelled' }
    }
    await strapi.db.query(REGISTRATION_CAMPAIGN_UID).update({
      where: { id: campaignId },
      data: {
        status: 'cancelled',
        description: normalizeText(payload.reason)
          ? `${normalizeText(campaign.description)}\n\n[Cancelled reason] ${normalizeText(payload.reason)}`.trim()
          : campaign.description,
      },
    })
    return { id: campaignId, status: 'cancelled' }
  }

  httpError(400, 'Unsupported action')
}

export async function listAdminCampaignRegistrations(tenantId: number, campaignId: number, query: Record<string, unknown>) {
  const campaign = await findCampaignById(tenantId, campaignId)
  if (!campaign?.id) {
    httpError(404, 'Registration campaign not found')
  }

  const page = Math.max(1, normalizePositiveInteger(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, normalizePositiveInteger(query.pageSize) || 10))
  const start = (page - 1) * pageSize
  const where = buildRegistrationWhere(tenantId, campaignId, query)
  const sort = resolveRegistrationSort(query)
  const [rows, total] = await Promise.all([
    strapi.db.query(CAMPAIGN_REGISTRATION_UID).findMany({
      where,
      offset: start,
      limit: pageSize,
      orderBy: sort,
      populate: {
        user: {
          select: ['id', 'email', 'fullName', 'confirmed'],
        },
        membership: {
          select: ['id', 'userTenantStatus'],
        },
      },
    }),
    strapi.db.query(CAMPAIGN_REGISTRATION_UID).count({ where }),
  ])

  const membershipIds = (rows || [])
    .map((item: any) => normalizePositiveInteger(item?.membership?.id || item?.membership))
    .filter((value): value is number => Boolean(value))
  const grantMap = await getMembershipFeatureGrantMap(membershipIds, normalizeText(campaign.targetFeature))
  const latestEmailMap = await findLatestMailLogsForRegistrations(tenantId, (rows || []).map((item: any) => Number(item.id)).filter(Boolean))

  let data = (rows || []).map((row: any) => toRegistrationSummary(
    row,
    grantMap.get(normalizePositiveInteger(row?.membership?.id || row?.membership) || 0) || null,
    latestEmailMap.get(Number(row.id)) || null,
  ))

  const hasTargetFeature = normalizeText(query.hasTargetFeature)
  if (hasTargetFeature === 'true') {
    data = data.filter((item) => item.targetFeatureGranted === true)
  } else if (hasTargetFeature === 'false') {
    data = data.filter((item) => item.targetFeatureGranted !== true)
  }

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
}

export async function getAdminCampaignRegistrationDetail(tenantId: number, campaignId: number, registrationId: number) {
  const campaign = await findCampaignById(tenantId, campaignId)
  if (!campaign?.id) {
    httpError(404, 'Registration campaign not found')
  }

  const registration = await findRegistrationById(tenantId, campaignId, registrationId)
  if (!registration?.id) {
    httpError(404, 'Registration not found')
  }

  const membershipId = normalizePositiveInteger(registration?.membership?.id || registration?.membership)
  const grantMap = await getMembershipFeatureGrantMap(membershipId ? [membershipId] : [], normalizeText(campaign.targetFeature))
  const latestEmailMap = await findLatestMailLogsForRegistrations(tenantId, [registrationId])

  return toRegistrationSummary(
    registration,
    membershipId ? grantMap.get(membershipId) || null : null,
    latestEmailMap.get(registrationId) || null,
  )
}

export async function adminResendRegistrationVerification(ctx: any, tenantId: number, campaignId: number, registrationId: number) {
  const registration = await findRegistrationById(tenantId, campaignId, registrationId)
  if (!registration?.id) {
    httpError(404, 'Registration not found')
  }

  return resendVerificationNotificationForRegistration(ctx, tenantId, registrationId)
}

export async function adminResendCompletionNotification(ctx: any, tenantId: number, campaignId: number, registrationId: number) {
  const registration = await findRegistrationById(tenantId, campaignId, registrationId)
  if (!registration?.id) {
    httpError(404, 'Registration not found')
  }

  return resendCompletionNotificationForRegistration(ctx, tenantId, registrationId)
}

export async function adminResendRejectionNotification(ctx: any, tenantId: number, campaignId: number, registrationId: number) {
  const registration = await findRegistrationById(tenantId, campaignId, registrationId)
  if (!registration?.id) {
    httpError(404, 'Registration not found')
  }

  return resendRejectionNotificationForRegistration(ctx, tenantId, registrationId)
}

export async function adminChangeRegistrationEmail(tenantId: number, campaignId: number, registrationId: number, payload: Record<string, unknown>) {
  const registration = await findRegistrationById(tenantId, campaignId, registrationId)
  if (!registration?.id) {
    httpError(404, 'Registration not found')
  }

  const status = normalizeStatus(registration.status)
  if (!['pending_verification', 'expired'].includes(status)) {
    httpError(409, 'Chỉ có thể đổi email khi đăng ký còn chờ xác minh hoặc đã hết hạn')
  }

  const newEmail = ensureEmail(payload.email)
  await strapi.db.query(CAMPAIGN_REGISTRATION_UID).update({
    where: { id: registrationId },
    data: {
      email: newEmail,
      emailChangedAt: new Date(),
      user: null,
      membership: null,
      status: 'pending_verification',
      verifiedAt: null,
    },
  })

  return resendRegistrationVerificationById(registrationId)
}

export async function listAdminCampaignEmails(tenantId: number, campaignId: number, query: Record<string, unknown>) {
  const campaign = await findCampaignById(tenantId, campaignId)
  if (!campaign?.id) {
    httpError(404, 'Registration campaign not found')
  }

  return listCampaignMailLogs(tenantId, campaignId, query)
}

export async function getAdminCampaignEmailDetail(tenantId: number, campaignId: number, mailLogId: number) {
  const campaign = await findCampaignById(tenantId, campaignId)
  if (!campaign?.id) {
    httpError(404, 'Registration campaign not found')
  }

  return findCampaignMailLogDetail(tenantId, campaignId, mailLogId)
}

export { approveCampaignRegistration, rejectCampaignRegistration, cancelCampaignRegistration, handleRegistrationCampaignError, HttpError, retryCompleteApprovedRegistration }