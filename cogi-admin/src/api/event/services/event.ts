import { mergeTenantWhere, toPositiveInt, toText, whereByParam } from '../../../utils/tenant-scope';

const EVENT_UID = 'api::event.event' as const;
const EVENT_REGISTRATION_UID = 'api::event-registration.event-registration' as const;
const COMMUNITY_GROUP_MEMBER_UID = 'api::community-group-member.community-group-member' as const;
const CLUB_MEMBERSHIP_UID = 'api::club-membership.club-membership' as const;
const SPORTS_PROFILE_UID = 'api::sports-profile.sports-profile' as const;

function httpError(status: number, message: string, code: string, details?: Record<string, unknown>) {
  const error = new Error(message) as Error & {
    status?: number;
    code?: string;
    details?: Record<string, unknown> | null;
  };
  error.status = status;
  error.code = code;
  error.details = details || null;
  throw error;
}

function normalizeText(value: unknown): string {
  return toText(value);
}

function normalizeRegistrationSettings(rawSettings: unknown): Record<string, unknown> {
  const source = rawSettings && typeof rawSettings === 'object' ? (rawSettings as Record<string, unknown>) : {};
  const capacityRaw = Number(source.capacity);
  const capacity = Number.isFinite(capacityRaw) && capacityRaw > 0 ? Math.floor(capacityRaw) : null;

  const eligibility = ['public', 'registered_users', 'group_members', 'club_members'].includes(normalizeText(source.eligibility).toLowerCase())
    ? normalizeText(source.eligibility).toLowerCase()
    : 'registered_users';

  const approvalMode = normalizeText(source.approvalMode).toLowerCase() === 'manual' ? 'manual' : 'auto';

  return {
    enabled: source.enabled !== false,
    openAt: source.openAt || null,
    closeAt: source.closeAt || null,
    capacity,
    eligibility,
    requireLogin: source.requireLogin !== false,
    approvalMode,
    allowCancellation: source.allowCancellation !== false,
    allowMultipleParticipants: Boolean(source.allowMultipleParticipants),
    customFields: Array.isArray(source.customFields) ? source.customFields : [],
    paymentSettings: source.paymentSettings || null,
  };
}

function toQuerySort(raw: unknown): Array<Record<string, 'asc' | 'desc'>> {
  if (!raw) return [{ startAt: 'desc' }, { createdAt: 'desc' }];

  if (typeof raw === 'string') {
    const [field, direction] = raw.split(':');
    const key = field.trim();
    if (!key) return [{ startAt: 'desc' }, { createdAt: 'desc' }];
    return [{ [key]: (direction === 'asc' ? 'asc' : 'desc') }];
  }

  return [{ startAt: 'desc' }, { createdAt: 'desc' }];
}

function toPublicEvent(event: any) {
  if (!event) return null;
  return {
    ...event,
    registrationSettings: normalizeRegistrationSettings(event.registrationSettings),
  };
}

async function getEventFromTenant(tenantId: number | string, ref: unknown) {
  const where = whereByParam(ref);
  if (!where) {
    return null;
  }

  return strapi.db.query(EVENT_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: {
      tenant: { select: ['id', 'name', 'code'] },
      group: { select: ['id', 'documentId', 'name', 'slug'] },
      club: { select: ['id', 'documentId', 'name', 'slug'] },
      coverImage: { select: ['id', 'name', 'url', 'mime'] },
    },
  });
}

async function loadMyRegistration(tenantId: number | string, eventId: number, userId: number) {
  return strapi.db.query(EVENT_REGISTRATION_UID).findOne({
    where: mergeTenantWhere({
      event: { id: { $eq: Number(eventId) } },
      user: { id: { $eq: Number(userId) } },
      status: { $in: ['pending', 'confirmed', 'cancelled', 'rejected'] },
    }, tenantId),
    populate: {
      user: { select: ['id', 'email', 'username', 'firstName', 'lastName'] },
      reviewedBy: { select: ['id', 'email', 'username'] },
    },
  });
}

async function assertGroupMembership(tenantId: number | string, userId: number, groupId: number) {
  const member = await strapi.db.query(COMMUNITY_GROUP_MEMBER_UID).findOne({
    where: mergeTenantWhere({
      group: { id: { $eq: Number(groupId) } },
      user: { id: { $eq: Number(userId) } },
      status: { $eq: 'active' },
    }, tenantId),
    select: ['id'],
  });

  if (!member?.id) {
    httpError(403, 'Bạn không thuộc nhóm được phép tham gia sự kiện.', 'EVENT_GROUP_ELIGIBILITY_REQUIRED');
  }
}

async function assertClubMembership(tenantId: number | string, userId: number, clubId: number) {
  const profile = await strapi.db.query(SPORTS_PROFILE_UID).findOne({
    where: mergeTenantWhere({
      user: { id: { $eq: Number(userId) } },
      status: { $eq: 'active' },
    }, tenantId),
    select: ['id'],
  });

  if (!profile?.id) {
    httpError(403, 'Bạn chưa có hồ sơ thể thao để tham gia sự kiện theo CLB.', 'EVENT_CLUB_PROFILE_REQUIRED');
  }

  const membership = await strapi.db.query(CLUB_MEMBERSHIP_UID).findOne({
    where: mergeTenantWhere({
      club: { id: { $eq: Number(clubId) } },
      sportsProfile: { id: { $eq: Number(profile.id) } },
      status: { $in: ['active', 'pending'] },
    }, tenantId),
    select: ['id'],
  });

  if (!membership?.id) {
    httpError(403, 'Bạn chưa là thành viên CLB được phép tham gia sự kiện.', 'EVENT_CLUB_MEMBERSHIP_REQUIRED');
  }
}

async function assertEventEligibility(tenantId: number | string, event: any, userId: number) {
  const settings = normalizeRegistrationSettings(event.registrationSettings);
  const eligibility = normalizeText(settings.eligibility).toLowerCase();

  if (eligibility === 'registered_users') {
    return;
  }

  if (eligibility === 'public') {
    return;
  }

  if (eligibility === 'group_members') {
    if (!event.group?.id) {
      httpError(400, 'Sự kiện này chưa cấu hình nhóm tham gia.', 'EVENT_GROUP_NOT_CONFIGURED');
    }
    await assertGroupMembership(tenantId, userId, Number(event.group.id));
    return;
  }

  if (eligibility === 'club_members') {
    if (!event.club?.id) {
      httpError(400, 'Sự kiện này chưa cấu hình CLB tham gia.', 'EVENT_CLUB_NOT_CONFIGURED');
    }
    await assertClubMembership(tenantId, userId, Number(event.club.id));
    return;
  }

  throw new Error('Unsupported event eligibility policy');
}

async function ensureRegistrationWindow(event: any) {
  const settings = normalizeRegistrationSettings(event.registrationSettings);
  const now = Date.now();

  if (event.status !== 'published') {
    httpError(400, 'Sự kiện không được mở để đăng ký.', 'EVENT_NOT_OPEN');
  }

  if (settings.enabled === false) {
    httpError(400, 'Đăng ký sự kiện đã bị tắt.', 'EVENT_REGISTRATION_DISABLED');
  }

  const openAtValue = settings.openAt as string | Date | undefined;
  if (openAtValue && new Date(String(openAtValue)).getTime() > now) {
    httpError(400, 'Sự kiện chưa mở đăng ký.', 'EVENT_REGISTRATION_NOT_OPEN_YET');
  }

  const closeAtValue = settings.closeAt as string | Date | undefined;
  if (closeAtValue && new Date(String(closeAtValue)).getTime() < now) {
    httpError(400, 'Đã kết thúc thời gian đăng ký.', 'EVENT_REGISTRATION_CLOSED');
  }
}

export async function listEvents(tenantId: number | string, query: Record<string, unknown> = {}) {
  const page = toPositiveInt(query.page, 1);
  const pageSize = toPositiveInt(query.pageSize, 20);
  const status = normalizeText(query.status);
  const search = normalizeText(query.search);

  const where: Record<string, unknown> = { tenant: { id: { $eq: tenantId } } } as Record<string, unknown>;
  if (status) {
    where.status = { $eq: status };
  }
  if (search) {
    where.$or = [
      { title: { $containsi: search } },
      { organizer: { $containsi: search } },
      { location: { $containsi: search } },
    ];
  }

  const total = await strapi.db.query(EVENT_UID).count({ where: mergeTenantWhere({ ...where }, tenantId) as any });
  const rows = await strapi.db.query(EVENT_UID).findMany({
    where: mergeTenantWhere({ ...where }, tenantId) as any,
    populate: {
      group: { select: ['id', 'name', 'slug'] },
      club: { select: ['id', 'name', 'slug'] },
      coverImage: { select: ['id', 'name', 'url', 'mime'] },
    },
    orderBy: toQuerySort(query.sort),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return {
    ok: true,
    data: rows,
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil((total || 0) / pageSize)),
    },
  };
}

export async function getEventDetail(tenantId: number | string, eventRef: unknown) {
  const event = await getEventFromTenant(tenantId, eventRef);
  if (!event?.id) {
    httpError(404, 'Không tìm thấy sự kiện.', 'EVENT_NOT_FOUND');
  }
  return { ok: true, data: toPublicEvent(event) };
}

export async function createEvent(tenantId: number | string, payload: Record<string, unknown>) {
  const title = normalizeText(payload.title);
  if (!title) {
    httpError(400, 'Tên sự kiện là bắt buộc.', 'EVENT_TITLE_REQUIRED');
  }

  const data: Record<string, unknown> = {
    tenant: Number(tenantId),
    title,
    slug: normalizeText(payload.slug) || title,
    description: payload.description || null,
    startAt: payload.startAt || new Date().toISOString(),
    endAt: payload.endAt || null,
    locationType: normalizeText(payload.locationType) || 'offline',
    location: payload.location || null,
    organizer: payload.organizer || null,
    status: normalizeText(payload.status) || 'draft',
    registrationSettings: normalizeRegistrationSettings(payload.registrationSettings),
  };

  if (payload.group) {
    data.group = Number((payload.group as any)?.id ?? payload.group ?? 0) || null;
  }

  if (payload.club) {
    data.club = Number((payload.club as any)?.id ?? payload.club ?? 0) || null;
  }

  if (payload.coverImage) {
    data.coverImage = Number((payload.coverImage as any)?.id ?? payload.coverImage ?? 0) || null;
  }

  const event = await strapi.db.query(EVENT_UID).create({ data });
  return { ok: true, data: event };
}

export async function updateEvent(tenantId: number | string, eventRef: unknown, payload: Record<string, unknown>) {
  const existing = await getEventFromTenant(tenantId, eventRef);
  if (!existing?.id) {
    httpError(404, 'Không tìm thấy sự kiện.', 'EVENT_NOT_FOUND');
  }

  const nextData: Record<string, unknown> = { ...payload };
  if (payload.title) {
    nextData.title = normalizeText(payload.title);
  }
  if (payload.slug) {
    nextData.slug = normalizeText(payload.slug);
  }
  if (payload.registrationSettings) {
    nextData.registrationSettings = normalizeRegistrationSettings(payload.registrationSettings);
  }
  if (payload.group) {
    nextData.group = Number((payload.group as any)?.id ?? payload.group ?? 0) || null;
  }
  if (payload.club) {
    nextData.club = Number((payload.club as any)?.id ?? payload.club ?? 0) || null;
  }
  if (payload.coverImage) {
    nextData.coverImage = Number((payload.coverImage as any)?.id ?? payload.coverImage ?? 0) || null;
  }

  const updated = await strapi.db.query(EVENT_UID).update({
    where: { id: Number(existing.id) },
    data: nextData,
  });

  return { ok: true, data: updated };
}

export async function updateRegistrationSettings(tenantId: number | string, eventRef: unknown, payload: Record<string, unknown>) {
  const event = await getEventFromTenant(tenantId, eventRef);
  if (!event?.id) {
    httpError(404, 'Không tìm thấy sự kiện.', 'EVENT_NOT_FOUND');
  }

  const updated = await strapi.db.query(EVENT_UID).update({
    where: { id: Number(event.id) },
    data: {
      registrationSettings: normalizeRegistrationSettings(payload.registrationSettings ?? payload),
    },
  });

  return { ok: true, data: updated };
}

export async function listRegistrations(tenantId: number | string, eventRef: unknown, query: Record<string, unknown> = {}) {
  const event = await getEventFromTenant(tenantId, eventRef);
  if (!event?.id) {
    httpError(404, 'Không tìm thấy sự kiện.', 'EVENT_NOT_FOUND');
  }

  const status = normalizeText(query.status);
  const search = normalizeText(query.search);
  const where: Record<string, unknown> = {
    tenant: { id: { $eq: tenantId } },
    event: { id: { $eq: Number(event.id) } },
  } as Record<string, unknown>;

  if (status) {
    where.status = { $eq: status };
  }

  if (search) {
    where.$or = [
      { registrationCode: { $containsi: search } },
      { note: { $containsi: search } },
    ];
  }

  const rows = await strapi.db.query(EVENT_REGISTRATION_UID).findMany({
    where: mergeTenantWhere(where, tenantId) as any,
    populate: {
      user: { select: ['id', 'email', 'username', 'firstName', 'lastName'] },
      reviewedBy: { select: ['id', 'email', 'username'] },
    },
    orderBy: [{ registeredAt: 'desc' }, { createdAt: 'desc' }],
  });

  return { ok: true, data: rows };
}

export async function getEventStats(tenantId: number | string, eventRef: unknown) {
  const event = await getEventFromTenant(tenantId, eventRef);
  if (!event?.id) {
    httpError(404, 'Không tìm thấy sự kiện.', 'EVENT_NOT_FOUND');
  }

  const rows = await strapi.db.query(EVENT_REGISTRATION_UID).findMany({
    where: mergeTenantWhere({ event: { id: { $eq: Number(event.id) } } }, tenantId),
    select: ['status'],
  });

  const stats = {
    total: rows.length,
    pending: 0,
    confirmed: 0,
    cancelled: 0,
    rejected: 0,
  };

  for (const row of rows) {
    const status = normalizeText(row.status);
    if (status && stats[status as keyof typeof stats] !== undefined) {
      stats[status as keyof typeof stats] += 1;
    }
  }

  return { ok: true, data: { eventId: Number(event.id), ...stats } };
}

export async function registerForEvent(tenantId: number | string, eventRef: unknown, user: { id: number } | null, payload: Record<string, unknown> = {}) {
  if (!user?.id) {
    httpError(401, 'Vui lòng đăng nhập để đăng ký sự kiện.', 'EVENT_LOGIN_REQUIRED');
  }

  const event = await getEventFromTenant(tenantId, eventRef);
  if (!event?.id) {
    httpError(404, 'Không tìm thấy sự kiện.', 'EVENT_NOT_FOUND');
  }

  await ensureRegistrationWindow(event);
  await assertEventEligibility(tenantId, event, Number(user.id));

  const activeRegistration = await loadMyRegistration(tenantId, Number(event.id), Number(user.id));
  if (activeRegistration?.id && ['pending', 'confirmed'].includes(normalizeText(activeRegistration.status))) {
    httpError(409, 'Bạn đã có hồ sơ đăng ký còn hiệu lực cho sự kiện này.', 'EVENT_ALREADY_REGISTERED');
  }

  const settings = normalizeRegistrationSettings(event.registrationSettings);
  const capacity = Number(settings.capacity ?? 0);

  if (capacity > 0) {
    const currentCount = await strapi.db.query(EVENT_REGISTRATION_UID).count({
      where: mergeTenantWhere({
        event: { id: { $eq: Number(event.id) } },
        status: { $in: ['pending', 'confirmed'] },
      }, tenantId),
    });

    if (Number(currentCount) >= capacity) {
      httpError(400, 'Sự kiện đã đủ số lượng đăng ký.', 'EVENT_CAPACITY_FULL');
    }
  }

  const registrationCode = `EV-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const approvalMode = normalizeText(settings.approvalMode).toLowerCase();

  const registration = await strapi.db.query(EVENT_REGISTRATION_UID).create({
    data: {
      tenant: Number(tenantId),
      event: Number(event.id),
      user: Number(user.id),
      registrationCode,
      registeredAt: new Date().toISOString(),
      status: approvalMode === 'manual' ? 'pending' : 'confirmed',
      participantCount: Number(payload.participantCount || 1),
      note: payload.note || null,
      metadata: payload.metadata || {},
    },
  });

  return { ok: true, data: registration };
}

export async function getMyRegistration(tenantId: number | string, eventRef: unknown, user: { id: number } | null) {
  if (!user?.id) {
    httpError(401, 'Vui lòng đăng nhập để xem hồ sơ đăng ký.', 'EVENT_LOGIN_REQUIRED');
  }

  const event = await getEventFromTenant(tenantId, eventRef);
  if (!event?.id) {
    httpError(404, 'Không tìm thấy sự kiện.', 'EVENT_NOT_FOUND');
  }

  const registration = await loadMyRegistration(tenantId, Number(event.id), Number(user.id));
  return { ok: true, data: registration || null };
}

export async function cancelRegistration(tenantId: number | string, eventRef: unknown, user: { id: number } | null, payload: Record<string, unknown> = {}) {
  if (!user?.id) {
    httpError(401, 'Vui lòng đăng nhập để hủy đăng ký.', 'EVENT_LOGIN_REQUIRED');
  }

  const event = await getEventFromTenant(tenantId, eventRef);
  if (!event?.id) {
    httpError(404, 'Không tìm thấy sự kiện.', 'EVENT_NOT_FOUND');
  }

  const registration = await loadMyRegistration(tenantId, Number(event.id), Number(user.id));
  if (!registration?.id) {
    httpError(404, 'Không tìm thấy hồ sơ đăng ký của bạn.', 'EVENT_REGISTRATION_NOT_FOUND');
  }

  const settings = normalizeRegistrationSettings(event.registrationSettings);
  if (settings.allowCancellation === false) {
    httpError(400, 'Sự kiện này không cho phép hủy đăng ký.', 'EVENT_CANCELLATION_DISABLED');
  }

  const updated = await strapi.db.query(EVENT_REGISTRATION_UID).update({
    where: { id: Number(registration.id) },
    data: {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      note: payload.note || registration.note || null,
    },
  });

  return { ok: true, data: updated };
}

export async function cancelRegistrationById(tenantId: number | string, registrationId: unknown, user: { id: number } | null) {
  if (!user?.id) {
    httpError(401, 'Unauthorized', 'EVENT_LOGIN_REQUIRED');
  }

  const registration = await strapi.db.query(EVENT_REGISTRATION_UID).findOne({
    where: mergeTenantWhere({ id: Number(registrationId) }, tenantId),
    populate: { event: { select: ['id', 'status', 'registrationSettings'] }, user: { select: ['id'] } },
  });

  if (!registration?.id) {
    httpError(404, 'Không tìm thấy hồ sơ đăng ký.', 'EVENT_REGISTRATION_NOT_FOUND');
  }

  if (Number(registration.user?.id) !== Number(user.id)) {
    httpError(403, 'Bạn chỉ được thao tác trên hồ sơ riêng của mình.', 'EVENT_REGISTRATION_FORBIDDEN');
  }

  const event = registration.event as any;
  const settings = normalizeRegistrationSettings(event?.registrationSettings);
  if (settings.allowCancellation === false) {
    httpError(400, 'Sự kiện này không cho phép hủy đăng ký.', 'EVENT_CANCELLATION_DISABLED');
  }

  const updated = await strapi.db.query(EVENT_REGISTRATION_UID).update({
    where: { id: Number(registration.id) },
    data: { status: 'cancelled', cancelledAt: new Date().toISOString() },
  });

  return { ok: true, data: updated };
}
