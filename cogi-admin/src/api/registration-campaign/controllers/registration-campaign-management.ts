import { resolveCurrentTenantId, toText } from '../../../utils/tenant-scope'
import {
  adminChangeRegistrationEmail,
  adminResendRegistrationVerification,
  approveCampaignRegistration,
  cancelCampaignRegistration,
  createAdminRegistrationCampaign,
  getAdminCampaignEmailDetail,
  getAdminCampaignRegistrationDetail,
  getAdminRegistrationCampaignDetail,
  getRegistrationCampaignFormOptions,
  handleRegistrationCampaignError,
  listAdminCampaignEmailTemplates,
  listAdminCampaignEmails,
  listAdminCampaignRegistrations,
  listAdminRegistrationCampaigns,
  previewAdminCampaignEmailTemplate,
  rejectCampaignRegistration,
  adminResendCompletionNotification,
  adminResendRejectionNotification,
  sendAdminCampaignEmailTemplateTest,
  retryCompleteApprovedRegistration,
  updateAdminRegistrationCampaignBasicInfo,
  updateAdminRegistrationCampaignConfig,
  updateAdminRegistrationCampaignEmailConfig,
  updateAdminRegistrationCampaignForm,
  updateAdminRegistrationCampaignStatus,
} from '../services/registration-campaign-management'

type AuthUser = {
  id: number
  email?: string | null
  blocked?: boolean | null
}

async function resolveUserFromJwt(ctx: any): Promise<AuthUser | null> {
  try {
    const authHeader = ctx.request?.headers?.authorization || ctx.request?.header?.authorization || ''
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : ''

    if (!token) return null

    const jwtService = strapi.plugin('users-permissions')?.service('jwt')
    if (!jwtService) return null

    const decoded = await jwtService.verify(token)
    const userId = Number(decoded?.id || 0)
    if (!Number.isInteger(userId) || userId <= 0) return null

    return strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
      select: ['id', 'email', 'blocked'],
    })
  } catch {
    return null
  }
}

async function requireAuthenticatedUser(ctx: any): Promise<AuthUser | null> {
  let authUser = ctx.state?.user as AuthUser | undefined
  if (!authUser?.id) {
    authUser = await resolveUserFromJwt(ctx) || undefined
    if (authUser?.id) {
      ctx.state.user = authUser
    }
  }

  if (!authUser?.id) {
    ctx.unauthorized('Unauthorized')
    return null
  }

  if (authUser.blocked) {
    ctx.unauthorized('Account is blocked')
    return null
  }

  return authUser
}

function extractPayload(ctx: any): Record<string, unknown> {
  const body = ctx.request?.body
  if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    return body.data as Record<string, unknown>
  }

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>
  }

  return {}
}

export default {
  async listCampaigns(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const data = await listAdminRegistrationCampaigns(ctx, tenantId, ctx.request?.query || {})
      ctx.body = { success: true, data }
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async getFormOptions(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const data = await getRegistrationCampaignFormOptions(tenantId)
      ctx.body = { success: true, data }
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async createCampaign(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const data = await createAdminRegistrationCampaign(tenantId, extractPayload(ctx))
      ctx.body = { success: true, data }
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async getCampaignDetail(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const campaignId = Number(ctx.params?.id || 0)
      const data = await getAdminRegistrationCampaignDetail(ctx, tenantId, campaignId)
      ctx.body = { success: true, data }
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async updateCampaignBasicInfo(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const campaignId = Number(ctx.params?.id || 0)
      const data = await updateAdminRegistrationCampaignBasicInfo(tenantId, campaignId, extractPayload(ctx))
      ctx.body = { success: true, data }
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async updateCampaignConfig(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const campaignId = Number(ctx.params?.id || 0)
      const data = await updateAdminRegistrationCampaignConfig(tenantId, campaignId, extractPayload(ctx))
      ctx.body = { success: true, data }
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async updateCampaignForm(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return

    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const campaignId = Number(ctx.params?.id || 0)
      const data = await updateAdminRegistrationCampaignForm(tenantId, campaignId, extractPayload(ctx))
      ctx.body = { success: true, data }
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async openCampaign(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return
    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const campaignId = Number(ctx.params?.id || 0)
      const data = await updateAdminRegistrationCampaignStatus(tenantId, campaignId, 'open', extractPayload(ctx))
      ctx.body = { success: true, data }
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async pauseCampaign(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return
    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const campaignId = Number(ctx.params?.id || 0)
      const data = await updateAdminRegistrationCampaignStatus(tenantId, campaignId, 'pause', extractPayload(ctx))
      ctx.body = { success: true, data }
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async closeCampaign(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return
    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const campaignId = Number(ctx.params?.id || 0)
      const data = await updateAdminRegistrationCampaignStatus(tenantId, campaignId, 'close', extractPayload(ctx))
      ctx.body = { success: true, data }
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async cancelCampaign(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return
    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const campaignId = Number(ctx.params?.id || 0)
      const data = await updateAdminRegistrationCampaignStatus(tenantId, campaignId, 'cancel', extractPayload(ctx))
      ctx.body = { success: true, data }
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async listRegistrations(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return
    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const campaignId = Number(ctx.params?.id || 0)
      const data = await listAdminCampaignRegistrations(tenantId, campaignId, ctx.request?.query || {})
      ctx.body = { success: true, data }
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async registrationDetail(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return
    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const campaignId = Number(ctx.params?.id || 0)
      const registrationId = Number(ctx.params?.registrationId || 0)
      const data = await getAdminCampaignRegistrationDetail(tenantId, campaignId, registrationId)
      ctx.body = { success: true, data }
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async resendRegistration(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return
    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const campaignId = Number(ctx.params?.id || 0)
      const registrationId = Number(ctx.params?.registrationId || 0)
      const data = await adminResendRegistrationVerification(ctx, tenantId, campaignId, registrationId)
      ctx.body = data
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async changeRegistrationEmail(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return
    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const campaignId = Number(ctx.params?.id || 0)
      const registrationId = Number(ctx.params?.registrationId || 0)
      const data = await adminChangeRegistrationEmail(tenantId, campaignId, registrationId, extractPayload(ctx))
      ctx.body = data
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async resendCompletionEmail(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return
    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const campaignId = Number(ctx.params?.id || 0)
      const registrationId = Number(ctx.params?.registrationId || 0)
      const data = await adminResendCompletionNotification(ctx, tenantId, campaignId, registrationId)
      ctx.body = data
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async resendRejectionEmail(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return
    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const campaignId = Number(ctx.params?.id || 0)
      const registrationId = Number(ctx.params?.registrationId || 0)
      const data = await adminResendRejectionNotification(ctx, tenantId, campaignId, registrationId)
      ctx.body = data
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async approveRegistration(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return
    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const registrationId = Number(ctx.params?.registrationId || ctx.params?.id || 0)
      const data = await approveCampaignRegistration(ctx, tenantId, registrationId, authUser)
      ctx.body = data
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async rejectRegistration(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return
    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const registrationId = Number(ctx.params?.registrationId || ctx.params?.id || 0)
      const data = await rejectCampaignRegistration(tenantId, registrationId, authUser, extractPayload(ctx))
      ctx.body = data
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async cancelRegistration(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return
    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const registrationId = Number(ctx.params?.registrationId || ctx.params?.id || 0)
      const data = await cancelCampaignRegistration(tenantId, registrationId, authUser, extractPayload(ctx))
      ctx.body = data
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async retryCompleteRegistration(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return
    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const registrationId = Number(ctx.params?.registrationId || ctx.params?.id || 0)
      const data = await retryCompleteApprovedRegistration(ctx, tenantId, registrationId, authUser)
      ctx.body = data
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async listEmails(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return
    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const campaignId = Number(ctx.params?.id || 0)
      const data = await listAdminCampaignEmails(tenantId, campaignId, ctx.request?.query || {})
      ctx.body = { success: true, data }
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async listEmailTemplates(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return
    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const campaignId = Number(ctx.params?.id || 0)
      const data = await listAdminCampaignEmailTemplates(tenantId, campaignId, ctx.request?.query || {}, {
        defaultTestEmail: authUser.email || null,
      })
      ctx.body = { success: true, data }
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async updateEmailConfig(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return
    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const campaignId = Number(ctx.params?.id || 0)
      await updateAdminRegistrationCampaignEmailConfig(tenantId, campaignId, extractPayload(ctx))
      const data = await getAdminRegistrationCampaignDetail(ctx, tenantId, campaignId)
      ctx.body = { success: true, data }
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async previewEmailTemplate(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return
    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const campaignId = Number(ctx.params?.id || 0)
      const data = await previewAdminCampaignEmailTemplate(tenantId, campaignId, extractPayload(ctx))
      ctx.body = { success: true, data }
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async testSendEmailTemplate(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return
    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const campaignId = Number(ctx.params?.id || 0)
      const data = await sendAdminCampaignEmailTemplateTest(tenantId, campaignId, extractPayload(ctx), authUser)
      ctx.body = { success: true, data }
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },

  async emailDetail(ctx: any) {
    const authUser = await requireAuthenticatedUser(ctx)
    if (!authUser?.id) return
    try {
      const tenantId = Number(resolveCurrentTenantId(ctx))
      const campaignId = Number(ctx.params?.id || 0)
      const mailLogId = Number(ctx.params?.mailLogId || 0)
      const data = await getAdminCampaignEmailDetail(tenantId, campaignId, mailLogId)
      ctx.body = { success: true, data }
    } catch (error) {
      return handleRegistrationCampaignError(ctx, error)
    }
  },
}