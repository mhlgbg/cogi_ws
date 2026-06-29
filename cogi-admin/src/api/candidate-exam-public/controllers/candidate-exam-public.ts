import { createCandidateExamLogEntry } from '../../candidate-exam-log/services/candidate-exam-log';
import { enqueueMail } from '../../../services/mail-queue';

const TENANT_UID = 'api::tenant.tenant';
const CAMPAIGN_UID = 'api::campaign.campaign';
const CANDIDATE_EXAM_UID = 'api::candidate-exam.candidate-exam';
const ADMISSION_APPLICATION_UID = 'api::admission-application.admission-application';
const CANDIDATE_EXAM_LOG_UID = 'api::candidate-exam-log.candidate-exam-log';

const LOOKUP_NOT_FOUND_MESSAGE = 'Thông tin tra cứu không chính xác. Vui lòng kiểm tra lại mã học sinh và mã hồ sơ.';
const SCORE_REPORT_SEND_NOT_ALLOWED_MESSAGE = 'Phiếu báo điểm đã được gửi trước đó hoặc chưa có email đăng ký hợp lệ.';
const DEFAULT_SCORE_REPORT_TEMPLATE = `<div style="font-family:'Times New Roman',serif; max-width:800px; margin:0 auto; padding:24px; color:#111; border:1px solid #d9d9d9; background:#fff;">

  <div style="text-align:center; line-height:1.4;">
    <div style="font-size:15px; font-weight:bold;">UBND PHƯỜNG VIỆT HƯNG</div>
    <div style="font-size:16px; font-weight:bold;">TRƯỜNG THCS CHẤT LƯỢNG CAO CHU VĂN AN</div>
    <div style="margin-top:8px; font-size:13px;">--------------------</div>
  </div>

  <div style="text-align:center; margin-top:18px;">
    <div style="font-size:22px; font-weight:bold; color:#0d47a1;">PHIẾU BÁO ĐIỂM</div>
    <div style="font-size:16px; font-weight:bold; margin-top:4px;">{{campaignName}}</div>
  </div>

  <div style="margin-top:22px; padding:14px 16px; border:1px solid #bcd0f7; border-left:5px solid #0d6efd; border-radius:8px; background:#f5f9ff;">
    <table style="width:100%; border-collapse:collapse; font-size:15px;">
      <tr><td style="width:32%; padding:5px 0;"><b>Họ và tên học sinh:</b></td><td>{{fullName}}</td></tr>
      <tr><td style="padding:5px 0;"><b>Ngày sinh:</b></td><td>{{dateOfBirth}}</td></tr>
      <tr><td style="padding:5px 0;"><b>Trường Tiểu học:</b></td><td>{{primarySchool}}</td></tr>
      <tr><td style="padding:5px 0;"><b>Mã học sinh:</b></td><td>{{studentCode}}</td></tr>
      <tr><td style="padding:5px 0;"><b>Mã hồ sơ:</b></td><td>{{applicationCode}}</td></tr>
      <tr><td style="padding:5px 0;"><b>Số báo danh:</b></td><td><b>{{candidateNumber}}</b></td></tr>
      <tr><td style="padding:5px 0;"><b>Phòng thi:</b></td><td>{{examRoom}}</td></tr>
      <tr><td style="padding:5px 0;"><b>Địa điểm thi:</b></td><td>{{examLocation}}</td></tr>
    </table>
  </div>

  <div style="margin-top:24px;">
    <table style="width:100%; border-collapse:collapse; font-size:15px; text-align:center;">
      <thead>
        <tr style="background:#0d6efd; color:white;">
          <th style="border:1px solid #999; padding:10px;">Môn</th>
          <th style="border:1px solid #999; padding:10px;">Điểm</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="border:1px solid #999; padding:10px; text-align:left;">Toán</td><td style="border:1px solid #999; padding:10px;">{{mathScore}}</td></tr>
        <tr><td style="border:1px solid #999; padding:10px; text-align:left;">Tiếng Việt</td><td style="border:1px solid #999; padding:10px;">{{vietnameseScore}}</td></tr>
        <tr><td style="border:1px solid #999; padding:10px; text-align:left;">Tiếng Anh</td><td style="border:1px solid #999; padding:10px;">{{englishScore}}</td></tr>
        <tr><td style="border:1px solid #999; padding:10px; text-align:left;">Điểm khuyến khích</td><td style="border:1px solid #999; padding:10px;">{{incentiveScore}}</td></tr>
        <tr style="background:#fff3cd; font-weight:bold;">
          <td style="border:1px solid #999; padding:12px; text-align:left;">Tổng điểm</td>
          <td style="border:1px solid #999; padding:12px; font-size:18px; color:#c00000;">{{totalScore}}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div style="margin-top:28px; display:flex; justify-content:space-between; align-items:flex-start; font-size:14px;">
    <div>
      <b>Ngày tra cứu:</b> {{lookupDate}}<br/>
      <b>Trạng thái thí sinh:</b> {{candidateExamStatus}}
    </div>
    <div style="text-align:center; min-width:220px;">
      <i>Hà Nội, ngày {{day}} tháng {{month}} năm {{year}}</i><br/>
      <b>TRƯỜNG THCS CLC CHU VĂN AN</b>
    </div>
  </div>

</div>`;

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeText(value: unknown): string {
  return toText(value);
}

function normalizeStudentCode(value: unknown): string {
  return toText(value).toUpperCase();
}

function normalizeApplicationCode(value: unknown): string {
  return toText(value).toUpperCase();
}

function normalizeTenantCode(value: unknown): string {
  return toText(value).toLowerCase();
}

function resolveCurrentTenantIdFromContext(ctx: any): number | string | null {
  const tenantId = ctx.state?.tenantId ?? ctx.state?.tenant?.id;
  if (tenantId === null || tenantId === undefined || tenantId === '') return null;
  return tenantId;
}

function normalizeHost(host?: string | null): string {
  if (!host) return '';
  const trimmedHost = String(host).trim().toLowerCase();
  if (!trimmedHost) return '';
  const withoutProtocol = trimmedHost.replace(/^https?:\/\//, '');
  const firstHost = withoutProtocol.split('/')[0]?.split(',')[0]?.trim() || '';
  if (!firstHost) return '';
  const colonIndex = firstHost.indexOf(':');
  return colonIndex > -1 ? firstHost.slice(0, colonIndex) : firstHost;
}

function getTenantCodeFromTenantPath(pathValue?: string | null): string {
  if (!pathValue) return '';
  const pathname = String(pathValue || '').split('?')[0] || '';
  const trimmed = pathname.replace(/^\/+|\/+$/g, '');
  if (!trimmed) return '';
  const [firstSegment = '', secondSegment = ''] = trimmed.split('/');
  if (firstSegment.toLowerCase() !== 't') return '';
  return secondSegment.trim().toLowerCase();
}

async function findTenantByCode(code: string) {
  if (!code) return null;
  return strapi.db.query(TENANT_UID).findOne({
    where: {
      code: {
        $eqi: code,
      },
    },
    select: ['id', 'code', 'tenantStatus'],
  });
}

async function resolveTenantForPublicRequest(ctx: any) {
  const directTenantId = resolveCurrentTenantIdFromContext(ctx);
  if (directTenantId) {
    const tenant = await strapi.db.query(TENANT_UID).findOne({
      where: { id: directTenantId },
      select: ['id', 'code', 'tenantStatus'],
    });
    if (tenant?.id) return tenant;
  }

  const headerTenantCode = normalizeTenantCode(ctx.get?.('x-tenant-code') || ctx.request?.header?.['x-tenant-code']);
  if (headerTenantCode) {
    const tenant = await findTenantByCode(headerTenantCode);
    if (tenant?.id) return tenant;
  }

  const pathTenantCode = getTenantCodeFromTenantPath(ctx.request?.path || ctx.path || '');
  if (pathTenantCode) {
    const tenant = await findTenantByCode(pathTenantCode);
    if (tenant?.id) return tenant;
  }

  const host = normalizeHost(ctx.request?.host || ctx.host || ctx.request?.header?.host || '');
  if (host === 'localhost' || host === '127.0.0.1') {
    return null;
  }

  const tenantDomain = await strapi.db.query('api::tenant-domain.tenant-domain').findOne({
    where: {
      domain: host,
      tenantDomainStatus: 'active',
    },
    populate: {
      tenant: {
        select: ['id', 'code', 'tenantStatus'],
      },
    },
  });

  return tenantDomain?.tenant || null;
}

async function findCampaignByCode(campaignCode: string, tenantId: number | string) {
  return strapi.db.query(CAMPAIGN_UID).findOne({
    where: {
      code: {
        $eqi: campaignCode,
      },
      tenant: {
        id: {
          $eq: tenantId,
        },
      },
      isActive: true,
    },
    select: ['id', 'code', 'name'],
  });
}

function resolveRequestIp(ctx: any) {
  return normalizeText(ctx.request?.ip || ctx.ip || ctx.request?.headers?.['x-forwarded-for'] || '') || null;
}

function resolveRequestUserAgent(ctx: any) {
  return normalizeText(ctx.request?.headers?.['user-agent'] || '') || null;
}

function maskApplicationCode(value: unknown) {
  const text = normalizeApplicationCode(value);
  if (!text) return '';
  if (text.length <= 3) return `${text[0] || ''}***`;
  return `${text.slice(0, 2)}***${text.slice(-1)}`;
}

function buildSafeCandidatePayload(row: any) {
  return {
    fullName: toText(row?.fullName) || null,
    dateOfBirth: row?.dateOfBirth || null,
    primarySchool: toText(row?.primarySchool) || null,
    studentCode: toText(row?.studentCode) || null,
    applicationCode: toText(row?.applicationCode) || null,
    candidateNumber: toText(row?.candidateNumber) || null,
    examRoom: toText(row?.examRoom) || null,
    examLocation: toText(row?.examLocation) || null,
    mathScore: row?.mathScore ?? null,
    vietnameseScore: row?.vietnameseScore ?? null,
    englishScore: row?.englishScore ?? null,
    incentiveScore: row?.incentiveScore ?? null,
    totalScore: row?.totalScore ?? null,
    candidateExamStatus: toText(row?.candidateExamStatus) || null,
    recheckMath: row?.recheckMath ?? row?.recheck_math ?? false,
    recheckVietnamese: row?.recheckVietnamese ?? row?.recheck_vietnamese ?? false,
    recheckEnglish: row?.recheckEnglish ?? row?.recheck_english ?? false,
    recheckMathScore: row?.recheckMathScore ?? row?.recheck_math_score ?? null,
    recheckVietnameseScore: row?.recheckVietnameseScore ?? row?.recheck_vietnamese_score ?? null,
    recheckEnglishScore: row?.recheckEnglishScore ?? row?.recheck_english_score ?? null,
  };
}

function formatDate(value: unknown) {
  const text = normalizeText(value);
  if (!text) return '-';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatScore(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '-';
  if (Number.isInteger(parsed)) return String(parsed);
  return String(Number(parsed.toFixed(2)));
}

function formatCandidateStatus(value: unknown) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'draft') return 'Chưa sẵn sàng';
  if (normalized === 'ready') return 'Sẵn sàng';
  if (normalized === 'card_downloaded') return 'Đã tải thẻ';
  if (normalized === 'checked_in') return 'Đã điểm danh';
  if (normalized === 'absent') return 'Vắng thi';
  if (normalized === 'completed') return 'Đã hoàn thành';
  if (normalized === 'cancelled') return 'Đã hủy';
  return normalizeText(value) || '-';
}

function collectEmailsFromStructuredValue(value: unknown, target: Set<string>, path = '') {
  if (!value) return;

  if (typeof value === 'string') {
    const normalizedPath = path.toLowerCase();
    if (normalizedPath.includes('email') || normalizedPath.includes('mail')) {
      const email = normalizeText(value).toLowerCase();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) target.add(email);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectEmailsFromStructuredValue(item, target, `${path}[${index}]`));
    return;
  }

  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      collectEmailsFromStructuredValue(child, target, path ? `${path}.${key}` : key);
    }
  }
}

function pickFirstEmail(candidates: Array<unknown>) {
  for (const candidate of candidates) {
    const email = normalizeText(candidate).toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return email;
  }
  return '';
}

function applyTemplate(template: string, context: Record<string, unknown>) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_matched, key) => {
    return String(context?.[key] ?? '-');
  });
}

function buildScoreReportContext(candidate: any, campaign: any) {
  const now = new Date();
  return {
    fullName: normalizeText(candidate?.fullName) || '-',
    dateOfBirth: formatDate(candidate?.dateOfBirth),
    primarySchool: normalizeText(candidate?.primarySchool) || '-',
    studentCode: normalizeText(candidate?.studentCode) || '-',
    applicationCode: normalizeText(candidate?.applicationCode) || '-',
    candidateNumber: normalizeText(candidate?.candidateNumber) || '-',
    examRoom: normalizeText(candidate?.examRoom) || '-',
    examLocation: normalizeText(candidate?.examLocation) || '-',
    mathScore: formatScore(candidate?.mathScore),
    vietnameseScore: formatScore(candidate?.vietnameseScore),
    englishScore: formatScore(candidate?.englishScore),
    incentiveScore: formatScore(candidate?.incentiveScore),
    totalScore: formatScore(candidate?.totalScore),
    candidateExamStatus: formatCandidateStatus(candidate?.candidateExamStatus),
    campaignName: normalizeText(campaign?.name) || '-',
    lookupDate: new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(now),
    day: String(now.getDate()).padStart(2, '0'),
    month: String(now.getMonth() + 1).padStart(2, '0'),
    year: String(now.getFullYear()),
  };
}

async function findAdmissionApplicationForCandidate(candidateExam: any, tenantId: number | string, campaignId: number) {
  if (candidateExam?.admissionApplication?.id) {
    const byRelation = await strapi.db.query(ADMISSION_APPLICATION_UID).findOne({
      where: {
        id: candidateExam.admissionApplication.id,
        tenant: { id: { $eq: tenantId } },
      },
      select: ['id', 'applicationCode', 'studentCode', 'studentName', 'formData'],
      populate: {
        parent: {
          select: ['id', 'username', 'email', 'fullName'],
        },
      },
    });
    if (byRelation?.id) return byRelation;
  }

  return strapi.db.query(ADMISSION_APPLICATION_UID).findOne({
    where: {
      tenant: { id: { $eq: tenantId } },
      campaign: { id: { $eq: campaignId } },
      studentCode: { $eq: normalizeStudentCode(candidateExam?.studentCode) },
      applicationCode: { $eq: normalizeApplicationCode(candidateExam?.applicationCode) },
      $or: [
        { isDeleted: false },
        { isDeleted: { $null: true } },
      ],
    },
    select: ['id', 'applicationCode', 'studentCode', 'studentName', 'formData'],
    populate: {
      parent: {
        select: ['id', 'username', 'email', 'fullName'],
      },
    },
  });
}

function resolveAdmissionApplicationEmail(admissionApplication: any) {
  const candidates = new Set<string>();
  const parentEmail = normalizeText(admissionApplication?.parent?.email).toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) candidates.add(parentEmail);
  collectEmailsFromStructuredValue(admissionApplication?.formData, candidates, 'formData');
  return pickFirstEmail(Array.from(candidates));
}

async function findScoreReportSentLog(candidateExamId: number, tenantId: number | string) {
  if (!candidateExamId) return null;
  return strapi.db.query(CANDIDATE_EXAM_LOG_UID).findOne({
    where: {
      tenant: { id: { $eq: tenantId } },
      candidateExam: { id: { $eq: candidateExamId } },
      action: 'score_report_sent',
      $or: [
        { isDeleted: false },
        { isDeleted: { $null: true } },
      ],
    },
    select: ['id', 'actionAt', 'note', 'newValue'],
    orderBy: [{ actionAt: 'desc' }, { id: 'desc' }],
  });
}

async function resolveScoreLookupContext(options: {
  tenantId: number | string;
  campaignCode: string;
  studentCode: string;
  applicationCode: string;
}) {
  const campaign = await strapi.db.query(CAMPAIGN_UID).findOne({
    where: {
      code: { $eqi: options.campaignCode },
      tenant: { id: { $eq: options.tenantId } },
      isActive: true,
    },
    select: ['id', 'code', 'name', 'scoreReportTemplateHtml'],
  });
  if (!campaign?.id) return null;

  const candidateExam = await strapi.db.query(CANDIDATE_EXAM_UID).findOne({
    where: {
      tenant: { id: { $eq: options.tenantId } },
      admissionSeason: { id: { $eq: campaign.id } },
      studentCode: { $eq: options.studentCode },
      applicationCode: { $eq: options.applicationCode },
      $or: [
        { isDeleted: false },
        { isDeleted: { $null: true } },
      ],
    },
      select: [
        'id',
        'fullName',
        'dateOfBirth',
        'primarySchool',
        'studentCode',
        'applicationCode',
        'candidateNumber',
        'examRoom',
        'examLocation',
        'mathScore',
        'vietnameseScore',
        'englishScore',
        'incentiveScore',
        'totalScore',
        'candidateExamStatus',
        // recheck fields
        'recheckMath',
        'recheckVietnamese',
        'recheckEnglish',
        'recheckMathScore',
        'recheckVietnameseScore',
        'recheckEnglishScore',
      ],
    populate: {
      admissionApplication: {
        select: ['id'],
      },
    },
  });
  if (!candidateExam?.id) return null;

  const admissionApplication = await findAdmissionApplicationForCandidate(candidateExam, options.tenantId, campaign.id);
  const registeredEmail = resolveAdmissionApplicationEmail(admissionApplication);
  const sentLog = await findScoreReportSentLog(Number(candidateExam.id), options.tenantId);

  return {
    campaign,
    candidateExam,
    admissionApplication,
    registeredEmail,
    sentLog,
  };
}

export default {
  async scoreLookup(ctx: any) {
    const body = ctx.request?.body && typeof ctx.request.body === 'object' ? ctx.request.body : {};
    const campaignCode = toText(body?.campaignCode);
    const studentCode = normalizeStudentCode(body?.studentCode);
    const applicationCode = normalizeApplicationCode(body?.applicationCode);

    if (!campaignCode || !studentCode || !applicationCode) {
      return ctx.badRequest(LOOKUP_NOT_FOUND_MESSAGE);
    }

    try {
      const tenant = await resolveTenantForPublicRequest(ctx);
      if (!tenant?.id) {
        return ctx.notFound(LOOKUP_NOT_FOUND_MESSAGE);
      }

      const context = await resolveScoreLookupContext({
			tenantId: tenant.id,
			campaignCode,
			studentCode,
			applicationCode,
		});

		if (!context?.campaign?.id || !context?.candidateExam?.id) {
        return ctx.badRequest(LOOKUP_NOT_FOUND_MESSAGE);
      }

      await createCandidateExamLogEntry({
        tenant: tenant.id,
        admissionSeason: context.campaign.id,
        candidateExam: context.candidateExam.id,
        action: 'score_lookup',
        actorType: 'parent',
        ip: resolveRequestIp(ctx),
        userAgent: resolveRequestUserAgent(ctx),
        newValue: {
          source: 'PUBLIC_SCORE_LOOKUP',
          studentCode,
          candidateNumber: toText(context.candidateExam?.candidateNumber) || null,
        },
      });

      ctx.body = {
        candidate: buildSafeCandidatePayload(context.candidateExam),
        campaign: {
          code: toText(context.campaign.code),
          name: toText(context.campaign.name),
        },
		scoreReportMail: {
			registeredEmail: context.registeredEmail || '',
			isSent: Boolean(context.sentLog?.id),
			sentAt: context.sentLog?.actionAt || null,
		},
      };
    } catch (error: any) {
      try {
        const tenant = await resolveTenantForPublicRequest(ctx);
        const campaign = tenant?.id ? await findCampaignByCode(campaignCode, tenant.id) : null;
        if (tenant?.id && campaign?.id) {
          await createCandidateExamLogEntry({
            tenant: tenant.id,
            admissionSeason: campaign.id,
            action: 'score_lookup',
            actorType: 'parent',
            ip: resolveRequestIp(ctx),
            userAgent: resolveRequestUserAgent(ctx),
            note: 'FAILED_PUBLIC_SCORE_LOOKUP',
            newValue: {
              source: 'PUBLIC_SCORE_LOOKUP_FAILED',
              studentCode,
              applicationCode: maskApplicationCode(applicationCode),
            },
          });
        }
      } catch {
        // ignore failed lookup logging
      }

      strapi.log.error('[candidate-exam-public.scoreLookup] unexpected error', error);
      return ctx.internalServerError('Failed to lookup candidate exam score');
    }
  },

  async sendScoreReport(ctx: any) {
    const body = ctx.request?.body && typeof ctx.request.body === 'object' ? ctx.request.body : {};
    const campaignCode = toText(body?.campaignCode);
    const studentCode = normalizeStudentCode(body?.studentCode);
    const applicationCode = normalizeApplicationCode(body?.applicationCode);

    if (!campaignCode || !studentCode || !applicationCode) {
      return ctx.badRequest(LOOKUP_NOT_FOUND_MESSAGE);
    }

    try {
      const tenant = await resolveTenantForPublicRequest(ctx);
      if (!tenant?.id) {
        return ctx.notFound(LOOKUP_NOT_FOUND_MESSAGE);
      }

      const context = await resolveScoreLookupContext({
        tenantId: tenant.id,
        campaignCode,
        studentCode,
        applicationCode,
      });

      if (!context?.campaign?.id || !context?.candidateExam?.id) {
        return ctx.badRequest(LOOKUP_NOT_FOUND_MESSAGE);
      }

      if (!context.registeredEmail || context.sentLog?.id) {
        return ctx.conflict(SCORE_REPORT_SEND_NOT_ALLOWED_MESSAGE);
      }

      const template = normalizeText((context.campaign as any)?.scoreReportTemplateHtml) || DEFAULT_SCORE_REPORT_TEMPLATE;
      const html = applyTemplate(template, buildScoreReportContext(context.candidateExam, context.campaign));
      const subject = `Báo điểm ${normalizeText(context.campaign?.name)} của ${normalizeText(context.candidateExam?.fullName)}`.trim();

      await enqueueMail({
        tenantId: tenant.id,
        mailType: 'candidate_exam_score_report',
        to: context.registeredEmail,
        subject,
        text:
          `Hoc sinh: ${normalizeText(context.candidateExam?.fullName)}\n` +
          `Ma hoc sinh: ${normalizeText(context.candidateExam?.studentCode)}\n` +
          `Ma ho so: ${normalizeText(context.candidateExam?.applicationCode)}\n` +
          `Tong diem: ${formatScore(context.candidateExam?.totalScore)}\n`,
        html,
        metadata: {
          source: 'candidate-exam-public.sendScoreReport',
          campaignCode: normalizeText(context.campaign?.code),
          candidateExamId: context.candidateExam.id,
          studentCode: normalizeText(context.candidateExam?.studentCode),
          applicationCode: normalizeText(context.candidateExam?.applicationCode),
        },
      });

      const sentAt = new Date().toISOString();
      await createCandidateExamLogEntry({
        tenant: tenant.id,
        admissionSeason: context.campaign.id,
        candidateExam: context.candidateExam.id,
        admissionApplication: context.admissionApplication?.id || null,
        action: 'score_report_sent',
        actionAt: sentAt,
        actorType: 'parent',
        ip: resolveRequestIp(ctx),
        userAgent: resolveRequestUserAgent(ctx),
        note: 'Đã gửi thư báo điểm',
        newValue: {
          email: context.registeredEmail,
          subject,
          source: 'PUBLIC_SCORE_REPORT_SEND',
        },
      });

      ctx.body = {
        success: true,
        data: {
          registeredEmail: context.registeredEmail,
          isSent: true,
          sentAt,
        },
      };
    } catch (error: any) {
      strapi.log.error('[candidate-exam-public.sendScoreReport] unexpected error', error);
      return ctx.internalServerError('Failed to send score report');
    }
  },
};