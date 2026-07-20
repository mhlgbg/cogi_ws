import { toText, resolveCurrentTenantId, mergeTenantWhere, whereByParam, extractRelationRef } from '../../../utils/tenant-scope';
import crypto from 'crypto';
import XLSX from 'xlsx';

const LUCKY_WHEEL_UID = 'api::lucky-wheel.lucky-wheel';
const PRIZE_UID = 'api::lucky-wheel-prize.lucky-wheel-prize';
const PARTICIPANT_UID = 'api::lucky-wheel-participant.lucky-wheel-participant';
const SPIN_UID = 'api::lucky-wheel-spin.lucky-wheel-spin';

function normalizeWheelCodeRaw(code) {
  if (!code) return '';
  const s = String(code).trim().toUpperCase();
  // keep alnum, dash, underscore
  return s.replace(/[^A-Z0-9_\-]/g, '');
}
async function generateVerificationCode(strapiInstance) {
  // VFyy-XXXX-XXXX using a safe alphabet and crypto.randomInt
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const seg = (len) => {
    let s = '';
    for (let i = 0; i < len; i += 1) {
      const idx = crypto.randomInt(0, alphabet.length);
      s += alphabet[idx];
    }
    return s;
  };

  const year = new Date().getFullYear().toString().slice(-2);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `VF${year}-${seg(4)}-${seg(4)}`;
    const exists = await strapiInstance.db.query(SPIN_UID).findOne({ where: { verificationCode: code } });
    if (!exists) return code;
  }
  const error = new Error('VERIFICATION_CODE_GENERATION_FAILED');
  error.status = 500;
  throw error;
}

async function generateUniqueRequestId(strapiInstance) {
  return crypto.randomUUID();
}

async function getAvailablePrizes(strapiInstance, wheelId, tenantId, trx) {
  const where = mergeTenantWhere({
    luckyWheel: { id: { $eq: wheelId } },
    isActive: { $eq: true },
    isDeleted: { $eq: false },
  }, tenantId);

  // allow either unlimited or remainingQuantity > 0
  const raw = await strapiInstance.db.query(PRIZE_UID).findMany({ where, transacting: trx });
  const filtered = (raw || []).filter((p) => {
    if (!p || Number(p.weight || 0) <= 0) return false;
    if (p.isUnlimited) return true;
    if (p.remainingQuantity === null || p.remainingQuantity === undefined) return false;
    return Number(p.remainingQuantity || 0) > 0;
  });
  return filtered;
}

function selectPrizeByWeight(prizes) {
  const weights = prizes.map((p) => Number(p.weight || 0));
  const totalWeight = weights.reduce((s, v) => s + v, 0);
  if (totalWeight <= 0) return { prize: null, randomValue: null, totalWeight: 0 };
  const rand = crypto.randomInt(0, totalWeight);
  let acc = 0;
  for (let i = 0; i < prizes.length; i += 1) {
    acc += Number(prizes[i].weight || 0);
    if (rand < acc) {
      return { prize: prizes[i], randomValue: rand, totalWeight };
    }
  }
  return { prize: prizes[prizes.length - 1], randomValue: totalWeight - 1, totalWeight };
}

function sanitizePublicWheel(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    name: toText(raw.name),
    code: toText(raw.code),
    description: toText(raw.description),
    publicMessage: toText(raw.publicMessage),
    resultNotice: toText(raw.resultNotice),
    status: toText(raw.status),
    startAt: raw.startAt || null,
    endAt: raw.endAt || null,
    participationMode: toText(raw.participationMode),
    identityField: toText(raw.identityField),
    participantFormConfig: raw.participantFormConfig || null,
  };
}

function getDocumentId(obj) {
  if (!obj) return null;
  return obj.documentId || obj.document_id || obj.externalDocumentId || null;
}

const ALLOWED_PARTICIPANT_KEYS = ['participantCode','fullName','phone','email','className'];

function defaultParticipantFormConfig(participationMode) {
  if (participationMode === 'open') {
    return {
      fields: [
        { key: 'participantCode', label: 'Mã tham gia', enabled: false, required: false, editable: false, placeholder: '' },
        { key: 'fullName', label: 'Họ và tên', enabled: true, required: false, editable: true, placeholder: '' },
        { key: 'phone', label: 'Số điện thoại', enabled: true, required: true, editable: true, placeholder: '' },
        { key: 'email', label: 'Email', enabled: false, required: false, editable: true, placeholder: '' },
        { key: 'className', label: 'Lớp', enabled: false, required: false, editable: true, placeholder: '' },
      ],
    };
  }
  // predefined
  return {
    fields: [
      { key: 'participantCode', label: 'Mã tham gia', enabled: true, required: true, editable: false, placeholder: '' },
      { key: 'fullName', label: 'Họ và tên', enabled: true, required: false, editable: false, placeholder: '' },
      { key: 'phone', label: 'Số điện thoại', enabled: false, required: false, editable: false, placeholder: '' },
      { key: 'email', label: 'Email', enabled: false, required: false, editable: false, placeholder: '' },
      { key: 'className', label: 'Lớp', enabled: false, required: false, editable: false, placeholder: '' },
    ],
  };
}

function normalizePhoneRaw(v) {
  if (!v && v !== 0) return null;
  const s = String(v || '').replace(/[^0-9+]/g, '');
  return s || null;
}

function normalizeEmailRaw(v) {
  if (!v && v !== 0) return null;
  const s = String(v || '').trim().toLowerCase();
  return s || null;
}

function normalizeTextRaw(v, maxLength = 255) {
  if (!v && v !== 0) return null;
  const s = String(v || '').trim();
  if (!s) return null;
  return s.slice(0, maxLength);
}

function isValidEmailAddress(v) {
  const text = String(v || '').trim();
  if (!text) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

function getPlayTokenSecret() {
  return process.env.PLAY_TOKEN_SECRET || (process.env.APP_KEYS ? String(process.env.APP_KEYS).split(',')[0] : null) || 'fallback_secret';
}

function signPlayTokenPayload(payload) {
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', getPlayTokenSecret()).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

function buildPlayTokenPayload({ tenantId, wheel, participant, expiresInSeconds = 600 }) {
  const now = Math.floor(Date.now() / 1000);
  return {
    purpose: 'lucky-wheel-play',
    tenantId: String(tenantId),
    luckyWheelId: String(wheel.id),
    luckyWheelDocumentId: getDocumentId(wheel) || null,
    participantId: String(participant.id),
    participantDocumentId: getDocumentId(participant) || null,
    iat: now,
    exp: now + Math.max(30, Number(expiresInSeconds) || 600),
    jti: crypto.randomUUID(),
  };
}

function buildPlayToken({ tenantId, wheel, participant, expiresInSeconds = 600 }) {
  return signPlayTokenPayload(buildPlayTokenPayload({ tenantId, wheel, participant, expiresInSeconds }));
}

function sanitizeParticipantForPublic(participant) {
  if (!participant) return null;
  return {
    id: participant.id,
    documentId: participant.documentId || participant.document_id || null,
    participantCode: participant.participantCode || null,
    fullName: participant.fullName || participant.fullname || null,
    phone: participant.phone || null,
    email: participant.email || null,
    className: participant.className || participant.classname || null,
    status: participant.status || null,
  };
}

function assertPublicWheelStatus(wheel) {
  const now = new Date();
  const status = String((wheel?.status || '').toLowerCase());
  if (status === 'closed') { const e = new Error('WHEEL_CLOSED'); e.status = 400; throw e; }
  if (status === 'cancelled') { const e = new Error('WHEEL_CANCELLED'); e.status = 400; throw e; }
  if (status !== 'opened') { const e = new Error('WHEEL_NOT_OPENED'); e.status = 400; throw e; }
  if (wheel?.startAt && new Date(wheel.startAt) > now) { const e = new Error('WHEEL_NOT_STARTED'); e.status = 400; throw e; }
  if (wheel?.endAt && new Date(wheel.endAt) < now) { const e = new Error('WHEEL_ENDED'); e.status = 400; throw e; }
}

function buildSpinResultFromPrize(prize) {
  if (!prize) return null;
  const prizeId = prize.id || null;
  const prizeDocumentId = getDocumentId(prize) || null;
  return {
    prizeId,
    prizeDocumentId,
    resultKey: String(prizeDocumentId || prizeId || ''),
    name: toText(prize.name),
    shortLabel: toText(prize.shortLabel) || toText(prize.name),
    description: toText(prize.description),
    resultMessage: toText(prize.resultMessage),
    isNoPrize: Boolean(prize.isNoPrize),
    displayColor: toText(prize.displayColor),
    textColor: toText(prize.textColor),
    image: prize.image || null,
  };
}

function buildSpinResultFromSnapshot(spin) {
  if (!spin) return null;
  const prizeId = spin.prizeIdSnapshot || null;
  const prizeDocumentId = spin.prizeDocumentIdSnapshot || null;
  return {
    prizeId,
    prizeDocumentId,
    resultKey: String(prizeDocumentId || prizeId || ''),
    name: toText(spin.prizeNameSnapshot),
    shortLabel: toText(spin.prizeNameSnapshot),
    description: toText(spin.prizeDescriptionSnapshot),
    resultMessage: toText(spin.prizeResultMessageSnapshot),
    isNoPrize: Boolean(spin.prizeIsNoPrizeSnapshot),
    displayColor: toText(spin.prizeDisplayColorSnapshot),
    textColor: toText(spin.prizeTextColorSnapshot),
    image: spin.prizeImageSnapshot || null,
  };
}

function sanitizeSpinForPublic(spin) {
  if (!spin) return null;
  return {
    id: spin.id || null,
    documentId: getDocumentId(spin) || null,
    requestId: spin.requestId || null,
    verificationCode: spin.verificationCode || null,
    status: spin.status || null,
    spunAt: spin.spunAt || null,
    claimStatus: spin.claimStatus || null,
  };
}

function sanitizeParticipantSpinState(participant) {
  if (!participant) return null;
  return {
    participantCode: participant.participantCode || null,
    fullName: participant.fullName || participant.fullname || null,
    status: participant.status || null,
    usedAt: participant.usedAt || null,
  };
}

function normalizeSpinRecord(record) {
  if (!record) return null;
  return {
    id: record.id,
    documentId: getDocumentId(record) || null,
    requestId: record.requestId || null,
    verificationCode: record.verificationCode || null,
    status: record.status || null,
    claimStatus: record.claimStatus || null,
    spunAt: record.spunAt || null,
    claimedAt: record.claimedAt || null,
    participantCode: record.participantCodeSnapshot || null,
    participantFullName: record.participantNameSnapshot || null,
    participantPhone: record.participantPhoneSnapshot || null,
    participantEmail: record.participantEmailSnapshot || null,
    participantClassName: record.participantClassNameSnapshot || null,
    prizeId: record.prizeIdSnapshot || null,
    prizeDocumentId: record.prizeDocumentIdSnapshot || null,
    prizeName: record.prizeNameSnapshot || null,
    prizeDescription: record.prizeDescriptionSnapshot || null,
    prizeResultMessage: record.prizeResultMessageSnapshot || null,
    prizeIsNoPrize: Boolean(record.prizeIsNoPrizeSnapshot),
    prizeDisplayColor: record.prizeDisplayColorSnapshot || null,
    prizeTextColor: record.prizeTextColorSnapshot || null,
    prizeImage: record.prizeImageSnapshot || null,
    randomValue: record.randomValue || null,
    participant: {
      participantCode: record.participantCodeSnapshot || null,
      fullName: record.participantNameSnapshot || null,
      phone: record.participantPhoneSnapshot || null,
      email: record.participantEmailSnapshot || null,
      className: record.participantClassNameSnapshot || null,
    },
    prize: {
      id: record.prizeIdSnapshot || null,
      documentId: record.prizeDocumentIdSnapshot || null,
      name: record.prizeNameSnapshot || null,
      description: record.prizeDescriptionSnapshot || null,
      resultMessage: record.prizeResultMessageSnapshot || null,
      isNoPrize: Boolean(record.prizeIsNoPrizeSnapshot),
      displayColor: record.prizeDisplayColorSnapshot || null,
      textColor: record.prizeTextColorSnapshot || null,
      image: record.prizeImageSnapshot || null,
    },
  };
}

function findField(cfg, key) {
  if (!cfg || !Array.isArray(cfg.fields)) return null;
  return cfg.fields.find(f => String(f.key) === String(key)) || null;
}

function validateAndNormalizeParticipantFormConfig(cfg, participationMode = 'predefined') {
  if (!cfg) return defaultParticipantFormConfig(participationMode);
  if (!cfg || typeof cfg !== 'object') throw new Error('INVALID_PARTICIPANT_FORM_CONFIG');
  const fields = Array.isArray(cfg.fields) ? cfg.fields : [];
  const normalized = { fields: [] };
  for (const f of fields) {
    if (!f || !f.key) continue;
    if (!ALLOWED_PARTICIPANT_KEYS.includes(f.key)) throw new Error('INVALID_PARTICIPANT_FORM_FIELD');
    const entry = {
      key: f.key,
      label: typeof f.label === 'string' ? f.label : (f.key || ''),
      enabled: Boolean(f.enabled),
      required: Boolean(f.required) && Boolean(f.enabled),
      editable: Boolean(f.editable),
      placeholder: typeof f.placeholder === 'string' ? f.placeholder : '',
    };
    normalized.fields.push(entry);
  }
  const missing = ALLOWED_PARTICIPANT_KEYS.filter(k => !normalized.fields.some(f => f.key === k));
  if (missing.length > 0) {
    const def = defaultParticipantFormConfig(participationMode);
    for (const k of missing) {
      const d = findField(def, k);
      if (d) normalized.fields.push(d);
    }
  }
  return normalized;
}

function extractParticipantFormConfig(wheel) {
  if (!wheel) return defaultParticipantFormConfig('predefined');
  if (wheel.participantFormConfig) return wheel.participantFormConfig;
  return defaultParticipantFormConfig(wheel.participationMode || 'predefined');
}

function resolveAbsoluteUrl(rawUrl) {
  if (!rawUrl) return null;
  const s = String(rawUrl || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  const backend = String(process.env.BACKEND_URL || (strapi?.config?.get?.('server.url') ?? '') || '').replace(/\/+$/, '') || null;
  if (backend) {
    try { return new URL(s, backend).toString(); } catch { return s; }
  }
  try { return new URL(s, 'http://localhost').toString(); } catch { return s; }
}

function normalizePrizeRecord(r) {
  if (!r) return null;
  const imageObj = r.image || (r.imageFile ? ({ id: r.imageFile.id, url: r.imageFile.url, provider: r.imageFile.provider }) : null);
  const resolvedUrl = imageObj && imageObj.url ? resolveAbsoluteUrl(imageObj.url) : null;
  const image = imageObj ? ({ ...imageObj, resolvedUrl }) : null;
  return {
    id: r.id,
    documentId: getDocumentId(r) || null,
    name: toText(r.name),
    shortLabel: toText(r.shortLabel),
    description: toText(r.description),
    resultMessage: toText(r.resultMessage),
    image,
    displayColor: toText(r.displayColor),
    textColor: toText(r.textColor),
    displayOrder: r.displayOrder || 0,
    quantity: r.quantity || null,
    remainingQuantity: r.remainingQuantity || null,
    isUnlimited: Boolean(r.isUnlimited),
    weight: Number(r.weight || 1),
    isNoPrize: Boolean(r.isNoPrize),
    isActive: Boolean(r.isActive),
    isDeleted: Boolean(r.isDeleted),
    createdAt: r.createdAt || null,
    updatedAt: r.updatedAt || null,
  };
}

async function checkParticipantForWheel(wheel, payload, tenantId) {
  const cfg = extractParticipantFormConfig(wheel);
  const where = { luckyWheel: wheel.id };
  if (payload.participantCode && findField(cfg, 'participantCode')?.enabled) where.participantCode = String(payload.participantCode).trim();
  if (payload.phone && findField(cfg, 'phone')?.enabled) where.phone = normalizePhoneRaw(payload.phone);
  const merged = mergeTenantWhere({ $and: [where, { $or: [{ isDeleted: false }, { isDeleted: { $null: true } }] }] }, tenantId);
  const participant = await strapi.db.query(PARTICIPANT_UID).findOne({ where: merged });
  return { participant, participantFormConfig: cfg };
}

async function prepareExistingParticipant(wheel, payload, tenantId, auth = null) {
  const cfg = extractParticipantFormConfig(wheel);
  if (!(wheel && wheel.id)) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }

  const allowedKeys = new Set(['participantCode', 'fullName', 'phone', 'email', 'className']);
  for (const key of Object.keys(payload || [])) {
    if (!allowedKeys.has(key)) { const e = new Error('FIELD_NOT_EDITABLE'); e.status = 400; e.field = key; throw e; }
  }

  const code = String(payload.participantCode || '').trim();
  if (!code) { const e = new Error('PARTICIPANT_CODE_REQUIRED'); e.status = 400; throw e; }

  const where = mergeTenantWhere({ luckyWheel: { id: { $eq: wheel.id } }, participantCode: code, isDeleted: { $eq: false } }, tenantId);
  const existing = await strapi.db.query(PARTICIPANT_UID).findOne({ where });
  if (!existing) { const e = new Error('PARTICIPANT_NOT_FOUND'); e.status = 404; throw e; }

  const status = String(existing.status || '').toLowerCase();
  if (status === 'blocked') { const e = new Error('PARTICIPANT_BLOCKED'); e.status = 403; throw e; }
  if (status === 'cancelled') { const e = new Error('PARTICIPANT_CANCELLED'); e.status = 400; throw e; }
  if (status === 'used') { const e = new Error('PARTICIPANT_ALREADY_USED'); e.status = 400; throw e; }

  const existingSpin = await strapi.db.query(SPIN_UID).findOne({ where: mergeTenantWhere({ luckyWheel: wheel.id, participant: existing.id, status: { $in: ['completed', 'claimed'] } }, tenantId) });
  if (existingSpin) { const e = new Error('PARTICIPANT_ALREADY_USED'); e.status = 400; throw e; }

  const fieldKeys = ['fullName', 'phone', 'email', 'className'];
  const updates = {};
  const nextParticipant = { ...existing, registeredAt: existing.registeredAt || new Date().toISOString() };

  for (const key of fieldKeys) {
    const fieldConfig = findField(cfg, key);
    if (!fieldConfig || !fieldConfig.enabled) continue;

    const incoming = payload[key];
    const currentValue = existing[key] ?? null;
    const currentText = currentValue === null || currentValue === undefined ? '' : String(currentValue).trim();

    if (!fieldConfig.editable) {
      if (incoming !== undefined) {
        const normalizedIncoming = key === 'phone' ? normalizePhoneRaw(incoming) : key === 'email' ? normalizeEmailRaw(incoming) : normalizeTextRaw(incoming);
        const normalizedCurrent = key === 'phone' ? normalizePhoneRaw(currentValue) : key === 'email' ? normalizeEmailRaw(currentValue) : normalizeTextRaw(currentValue);
        if (normalizedIncoming !== normalizedCurrent) { const e = new Error('FIELD_NOT_EDITABLE'); e.status = 400; e.field = key; throw e; }
      }
      continue;
    }

    let nextValue = currentText || null;
    if (incoming !== undefined) {
      if (typeof incoming === 'string' && !String(incoming).trim()) nextValue = null;
      else if (key === 'phone') nextValue = normalizePhoneRaw(incoming);
      else if (key === 'email') nextValue = normalizeEmailRaw(incoming);
      else nextValue = normalizeTextRaw(incoming);
    }

    if (fieldConfig.required && !nextValue) { const e = new Error('REQUIRED_PARTICIPANT_FIELD_MISSING'); e.status = 400; e.field = key; throw e; }
    if (key === 'email' && nextValue && !isValidEmailAddress(nextValue)) { const e = new Error('INVALID_EMAIL'); e.status = 400; e.field = key; throw e; }

    if (nextValue !== undefined && nextValue !== null) {
      updates[key] = key === 'email' ? normalizeEmailRaw(nextValue) : nextValue;
      nextParticipant[key] = updates[key];
    } else {
      updates[key] = null;
      nextParticipant[key] = null;
    }
  }

  if (!nextParticipant.registeredAt) {
    const nowIso = new Date().toISOString();
    updates.registeredAt = nowIso;
    nextParticipant.registeredAt = nowIso;
  }

  const shouldUpdate = Object.keys(updates).length > 0;
  const updated = shouldUpdate
    ? await strapi.db.query(PARTICIPANT_UID).update({ where: { id: existing.id }, data: updates })
    : existing;
  const refreshed = shouldUpdate
    ? await strapi.db.query(PARTICIPANT_UID).findOne({ where: { id: updated.id || existing.id } })
    : updated;
  const participant = refreshed || updated || existing;
  const playToken = buildPlayToken({ tenantId, wheel, participant, expiresInSeconds: 600 });

  return {
    participant: sanitizeParticipantForPublic(participant),
    playToken,
    expiresIn: 600,
  };
}

async function registerParticipantForWheel({ wheel, payload, tenantId, auth = null, trx = null }) {
  if ((wheel.participationMode || 'predefined') === 'predefined') {
    const err = new Error('REGISTRATION_NOT_ALLOWED'); err.status = 400; throw err;
  }
  const cfg = extractParticipantFormConfig(wheel);
  for (const f of (cfg.fields || [])) {
    if (f.enabled && f.required) {
      if (!payload[f.key]) { const e = new Error(`FIELD_REQUIRED:${f.key}`); e.status = 400; throw e; }
    }
  }
  const phone = findField(cfg, 'phone')?.enabled ? normalizePhoneRaw(payload.phone) : null;
  if (phone && findField(cfg, 'phone')?.required) {
    const exists = await strapi.db.query(PARTICIPANT_UID).findOne({ where: { luckyWheel: wheel.id, phone } });
    if (exists) { const e = new Error('DUPLICATE_PHONE'); e.status = 409; throw e; }
  }
  let participantCode = payload.participantCode || null;
  if (!participantCode) participantCode = await generateUniqueRequestId(strapi);
  const data = {
    tenant: tenantId,
    luckyWheel: wheel.id,
    participantCode,
    fullName: payload.fullName || null,
    phone: phone || null,
    email: findField(cfg, 'email')?.enabled ? (payload.email || null) : null,
    className: findField(cfg, 'className')?.enabled ? (payload.className || null) : null,
    source: 'self_registered',
    status: 'eligible',
    registeredAt: new Date().toISOString(),
    createdByUser: auth?.id || null,
  };
  const created = await strapi.db.query(PARTICIPANT_UID).create({ data, transacting: trx });
  return created;
}

module.exports = {
  normalizeWheelCode(code) {
    return normalizeWheelCodeRaw(code);
  },

  async getTenantContext(ctx) {
    return resolveCurrentTenantId(ctx);
  },

  async getPublicWheelByCode(code) {
    const normalized = normalizeWheelCodeRaw(code);
    if (!normalized) return null;
    return strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: { code: normalized, isDeleted: false } });
  },

  async getPublicWheelForTenant(code, tenantId) {
    const normalized = normalizeWheelCodeRaw(code);
    if (!normalized) return null;
    const wheel = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: { code: normalized, tenant: tenantId, isDeleted: false } });
    if (!wheel) return null;

    // fetch prizes for this wheel scoped to tenant
    const prizeWhere = mergeTenantWhere({ luckyWheel: { id: { $eq: wheel.id } }, isDeleted: { $eq: false }, isActive: { $eq: true } }, tenantId);
    const rawPrizes = await strapi.db.query(PRIZE_UID).findMany({ where: prizeWhere, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }], populate: ['image', 'imageFile'] });
    const prizes = (rawPrizes || []).map(normalizePrizeRecord).filter(Boolean);

    const publicObj = sanitizePublicWheel(wheel);
    publicObj.participantFormConfig = extractParticipantFormConfig(wheel);
    publicObj.prizes = prizes.map((p) => ({ id: p.id, documentId: p.documentId, name: p.name, shortLabel: p.shortLabel, image: p.image, displayColor: p.displayColor, textColor: p.textColor, displayOrder: p.displayOrder, isNoPrize: p.isNoPrize }));
    return publicObj;
  },

  async getPublicWheel(code) {
    const w = await this.getPublicWheelByCode(code);
    if (!w) return null;
    return sanitizePublicWheel(w);
  },
  checkParticipantForWheel: checkParticipantForWheel,
  assertPublicWheelStatus: assertPublicWheelStatus,
  prepareExistingParticipant: prepareExistingParticipant,
  registerParticipantForWheel: registerParticipantForWheel,
  validateAndNormalizeParticipantFormConfig: validateAndNormalizeParticipantFormConfig,
  extractParticipantFormConfig: extractParticipantFormConfig,

  async spinForPublic({ code, payload, ctx }) {
    const normalized = normalizeWheelCodeRaw(code);
    if (!normalized) {
      const error = new Error('WHEEL_NOT_FOUND');
      error.status = 404;
      throw error;
    }

    const tenantId = ctx?.state?.tenant?.id || null;
    if (!tenantId) {
      const error = new Error('TENANT_CONTEXT_REQUIRED');
      error.status = 400;
      throw error;
    }

    const wheel = await strapi.db.query(LUCKY_WHEEL_UID).findOne({
      where: { code: normalized, tenant: tenantId, isDeleted: false },
    });
    if (!wheel) {
      const error = new Error('WHEEL_NOT_FOUND');
      error.status = 404;
      throw error;
    }

    assertPublicWheelStatus(wheel);

    const playToken = toText(payload.playToken || payload.token || '');
    if (!playToken) {
      const error = new Error('INVALID_PLAY_TOKEN');
      error.status = 401;
      throw error;
    }

    const requestId = toText(payload.requestId || '');
    if (!requestId) {
      const error = new Error('REQUEST_ID_REQUIRED');
      error.status = 400;
      throw error;
    }

    try {
      const parts = String(playToken).split('.');
      if (parts.length !== 2 && parts.length !== 3) { const e = new Error('INVALID_PLAY_TOKEN'); e.status = 401; throw e; }
      const payloadB64 = parts[0];
      const signature = parts.length === 3 ? parts[1] : parts[1];
      const expectedSig = crypto.createHmac('sha256', getPlayTokenSecret()).update(payloadB64).digest('base64url');
      if (signature !== expectedSig) { const e = new Error('INVALID_PLAY_TOKEN'); e.status = 401; throw e; }
      const payloadObj = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
      const nowSec = Math.floor(Date.now() / 1000);
      if (!payloadObj.exp || Number(payloadObj.exp) < nowSec) { const e = new Error('PLAY_TOKEN_EXPIRED'); e.status = 401; throw e; }
      if (String(payloadObj.purpose || '') !== 'lucky-wheel-play') { const e = new Error('INVALID_PLAY_TOKEN'); e.status = 401; throw e; }

      const tokenTenant = String(payloadObj.tenantId || '');
      const tokenWheelId = String(payloadObj.luckyWheelId || '');
      const tokenWheelDocumentId = String(payloadObj.luckyWheelDocumentId || '');
      const tokenParticipantId = String(payloadObj.participantId || '');
      const tokenParticipantDocumentId = String(payloadObj.participantDocumentId || '');

      if (tokenTenant !== String(tenantId)) { const e = new Error('PLAY_TOKEN_SCOPE_MISMATCH'); e.status = 403; throw e; }
      if (tokenWheelId !== String(wheel.id) && tokenWheelDocumentId !== String(getDocumentId(wheel) || '')) {
        const e = new Error('PLAY_TOKEN_SCOPE_MISMATCH'); e.status = 403; throw e;
      }
      if (!tokenParticipantId && !tokenParticipantDocumentId) { const e = new Error('INVALID_PLAY_TOKEN'); e.status = 401; throw e; }

      payload._resolved = {
        participantId: tokenParticipantId || null,
        participantDocumentId: tokenParticipantDocumentId || null,
      };
    } catch (error) {
      if (error?.status) throw error;
      const wrapped = new Error('INVALID_PLAY_TOKEN');
      wrapped.status = 401;
      throw wrapped;
    }

    const result = await strapi.db.transaction(async ({ trx }) => {
      const participantWhere = mergeTenantWhere({
        luckyWheel: wheel.id,
        ...(payload._resolved?.participantId
          ? { id: Number(payload._resolved.participantId) }
          : { documentId: payload._resolved?.participantDocumentId }),
        $or: [{ isDeleted: false }, { isDeleted: { $null: true } }],
      }, tenantId);

      const participant = await strapi.db.query(PARTICIPANT_UID).findOne({ where: participantWhere, transacting: trx });
      if (!participant) {
        const error = new Error('PARTICIPANT_NOT_FOUND');
        error.status = 404;
        throw error;
      }

      const participantStatus = String(participant.status || '').toLowerCase();
      if (participantStatus === 'blocked') { const error = new Error('PARTICIPANT_BLOCKED'); error.status = 403; throw error; }
      if (participantStatus === 'cancelled') { const error = new Error('PARTICIPANT_CANCELLED'); error.status = 400; throw error; }
      if (participantStatus === 'used') { const error = new Error('PARTICIPANT_ALREADY_USED'); error.status = 400; throw error; }
      if (participantStatus !== 'eligible') { const error = new Error('PARTICIPANT_ALREADY_USED'); error.status = 400; throw error; }

      const existingByRequest = await strapi.db.query(SPIN_UID).findOne({
        where: mergeTenantWhere({ requestId }, tenantId),
        transacting: trx,
      });
      if (existingByRequest) {
        const sameParticipant = String(extractRelationRef(existingByRequest.participant)) === String(participant.id);
        const sameWheel = String(extractRelationRef(existingByRequest.luckyWheel)) === String(wheel.id);
        if (!sameParticipant || !sameWheel) {
          const error = new Error('REQUEST_ID_CONFLICT');
          error.status = 409;
          throw error;
        }
        return {
          replayed: true,
          spin: existingByRequest,
          result: buildSpinResultFromSnapshot(existingByRequest),
          participant: {
            participantCode: participant.participantCode || existingByRequest.participantCodeSnapshot || null,
            fullName: participant.fullName || existingByRequest.participantNameSnapshot || null,
            status: participant.status || 'used',
            usedAt: participant.usedAt || existingByRequest.spunAt || null,
          },
        };
      }

      const existingSpin = await strapi.db.query(SPIN_UID).findOne({
        where: mergeTenantWhere({
          participant: participant.id,
          luckyWheel: wheel.id,
          status: { $in: ['completed', 'claimed'] },
          $or: [{ isDeleted: false }, { isDeleted: { $null: true } }],
        }, tenantId),
        transacting: trx,
      });
      if (existingSpin) {
        return {
          replayed: true,
          spin: existingSpin,
          result: buildSpinResultFromSnapshot(existingSpin),
          participant: {
            participantCode: participant.participantCode || existingSpin.participantCodeSnapshot || null,
            fullName: participant.fullName || existingSpin.participantNameSnapshot || null,
            status: 'used',
            usedAt: participant.usedAt || existingSpin.spunAt || null,
          },
        };
      }

      const availablePrizes = (await getAvailablePrizes(strapi, wheel.id, tenantId, trx))
        .filter((prize) => !(wheel.allowNoPrize === false && prize.isNoPrize));
      if (!availablePrizes.length) {
        const error = new Error('NO_AVAILABLE_PRIZES');
        error.status = 409;
        throw error;
      }

      const { prize, randomValue } = selectPrizeByWeight(availablePrizes);
      if (!prize) {
        const error = new Error('NO_AVAILABLE_PRIZES');
        error.status = 409;
        throw error;
      }

      if (!prize.isUnlimited) {
        const currentRemaining = Number(prize.remainingQuantity || 0);
        if (currentRemaining <= 0) {
          const error = new Error('NO_AVAILABLE_PRIZES');
          error.status = 409;
          throw error;
        }
        await strapi.db.query(PRIZE_UID).update({
          where: { id: prize.id },
          data: { remainingQuantity: currentRemaining - 1 },
          transacting: trx,
        });
      }

      const spunAt = new Date().toISOString();
      const verificationCode = await generateVerificationCode(strapi);
      const claimStatus = prize.isNoPrize ? 'not_applicable' : 'unclaimed';
      const resultData = buildSpinResultFromPrize(prize);
      const spinData = {
        tenant: tenantId,
        luckyWheel: wheel.id,
        participant: participant.id,
        prize: prize.id,
        requestId,
        verificationCode,
        status: 'completed',
        claimStatus,
        spunAt,
        randomValue: String(randomValue),
        eligiblePrizesSnapshot: availablePrizes.map((item) => ({
          prizeId: item.id || null,
          name: item.name || null,
          weight: Number(item.weight || 0),
          remainingQuantity: item.isUnlimited ? null : Number(item.remainingQuantity || 0),
          isUnlimited: Boolean(item.isUnlimited),
          isNoPrize: Boolean(item.isNoPrize),
        })),
        participantCodeSnapshot: participant.participantCode || null,
        participantNameSnapshot: participant.fullName || null,
        participantPhoneSnapshot: participant.phone || null,
        participantEmailSnapshot: participant.email || null,
        participantClassNameSnapshot: participant.className || null,
        prizeIdSnapshot: String(resultData?.prizeId || ''),
        prizeDocumentIdSnapshot: resultData?.prizeDocumentId || null,
        prizeNameSnapshot: resultData?.name || null,
        prizeDescriptionSnapshot: resultData?.description || null,
        prizeResultMessageSnapshot: resultData?.resultMessage || null,
        prizeIsNoPrizeSnapshot: Boolean(resultData?.isNoPrize),
        prizeDisplayColorSnapshot: resultData?.displayColor || null,
        prizeTextColorSnapshot: resultData?.textColor || null,
        prizeImageSnapshot: resultData?.image || null,
        ipAddress: ctx.request?.ip || null,
        userAgent: ctx.request?.header?.['user-agent'] || null,
      };

      const spin = await strapi.db.query(SPIN_UID).create({ data: spinData, transacting: trx });
      await strapi.db.query(PARTICIPANT_UID).update({
        where: { id: participant.id },
        data: { status: 'used', usedAt: spunAt },
        transacting: trx,
      });

      return {
        replayed: false,
        spin: { ...spin, claimStatus },
        result: resultData,
        participant: {
          participantCode: participant.participantCode || null,
          fullName: participant.fullName || null,
          status: 'used',
          usedAt: spunAt,
        },
      };
    });

    return {
      replayed: Boolean(result.replayed),
      spin: sanitizeSpinForPublic(result.spin),
      result: result.replayed ? (result.result || buildSpinResultFromSnapshot(result.spin)) : result.result,
      participant: result.participant,
    };
  },

  async verifyByCode(verificationCode) {
    const spin = await strapi.db.query(SPIN_UID).findOne({ where: { verificationCode } });
    if (!spin) return null;
    return {
      valid: true,
      wheel: { name: spin.luckyWheel?.name || null },
      participant: { participantCode: spin.participantCodeSnapshot, fullName: spin.participantNameSnapshot },
      prize: { name: spin.prizeNameSnapshot, isNoPrize: spin.prizeIsNoPrizeSnapshot },
      verificationCode: spin.verificationCode,
      spunAt: spin.spunAt,
      status: spin.status,
      claimedAt: spin.claimedAt || null,
    };
  },
  getAvailablePrizes,
  // Admin APIs
  async listLuckyWheels(query = {}, tenantId) {
    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const pageSize = Number(query.pageSize) > 0 ? Number(query.pageSize) : 10;
    const q = toText(query.q || query.search || '');
    const status = toText(query.status || '');

    const whereClauses = [];
    // active records (not soft deleted)
    whereClauses.push({ $or: [{ isDeleted: false }, { isDeleted: { $null: true } }] });

    if (q) {
      whereClauses.push({ $or: [ { name: { $containsi: q } }, { code: { $containsi: q } } ] });
    }
    if (status) {
      whereClauses.push({ status: { $eq: status } });
    }

    const baseWhere = whereClauses.length === 1 ? whereClauses[0] : { $and: whereClauses };
    const where = mergeTenantWhere(baseWhere, tenantId);

    const offset = (page - 1) * pageSize;
    const rows = await strapi.db.query(LUCKY_WHEEL_UID).findMany({ where, limit: pageSize, offset, orderBy: [{ createdAt: 'desc' }] });
    const total = await strapi.db.query(LUCKY_WHEEL_UID).count({ where });

    const items = (rows || []).map((r) => ({
      id: r.id,
      documentId: getDocumentId(r) || null,
      name: toText(r.name),
      code: toText(r.code),
      description: toText(r.description),
      status: toText(r.status),
      participationMode: toText(r.participationMode),
      startAt: r.startAt || null,
      endAt: r.endAt || null,
      maxParticipants: r.maxParticipants || null,
      createdAt: r.createdAt || null,
      updatedAt: r.updatedAt || null,
    }));

    return {
      rows: items,
      pagination: { page, pageSize, pageCount: Math.ceil(total / pageSize) || 1, total },
    };
  },

  async createLuckyWheel(payload = {}, tenantId, auth = null) {
    const codeRaw = toText(payload.code || payload.codeRaw || '');
    const code = normalizeWheelCodeRaw(codeRaw) || null;
    if (!code) { const err = new Error('LUCKY_WHEEL_CODE_REQUIRED'); err.status = 400; throw err; }

    const name = toText(payload.name || '');
    if (!name) { const err = new Error('LUCKY_WHEEL_NAME_REQUIRED'); err.status = 400; throw err; }

    // participationMode validation
    const pm = toText(payload.participationMode) || 'predefined';
    if (pm !== 'predefined' && pm !== 'open') { const e = new Error('INVALID_PARTICIPATION_MODE'); e.status = 400; throw e; }

    // start/end time validation
    const startAt = payload.startAt ? new Date(payload.startAt) : null;
    const endAt = payload.endAt ? new Date(payload.endAt) : null;
    if (startAt && endAt && endAt <= startAt) { const e = new Error('INVALID_TIME_RANGE'); e.status = 400; throw e; }

    // check duplicate code in tenant
    const dup = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: mergeTenantWhere({ code }, tenantId) });
    if (dup) { const e = new Error('LUCKY_WHEEL_CODE_DUPLICATED'); e.status = 409; throw e; }

    const data = {
      tenant: tenantId,
      code,
      name,
      description: toText(payload.description || ''),
      publicMessage: null,
      resultNotice: null,
      status: 'draft',
      participationMode: pm,
      participantFormConfig: payload.participantFormConfig || null,
      allowNoPrize: true,
      maxParticipants: payload.maxParticipants || null,
      startAt: startAt ? startAt.toISOString() : null,
      endAt: endAt ? endAt.toISOString() : null,
      isDeleted: false,
      createdBy: auth?.id || null,
    };

    const created = await strapi.db.query(LUCKY_WHEEL_UID).create({ data });
    return created;
  },

  async getLuckyWheelDetail(idParam, tenantId) {
    const where = whereByParam(idParam);
    if (!where) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }
    const whereMerged = mergeTenantWhere({ $and: [where, { $or: [{ isDeleted: false }, { isDeleted: { $null: true } }] }] }, tenantId);
    const record = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: whereMerged });
    if (!record) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }

    return {
      id: record.id,
      documentId: getDocumentId(record) || null,
      name: toText(record.name),
      code: toText(record.code),
      description: toText(record.description),
      status: toText(record.status),
      participationMode: toText(record.participationMode),
      allowNoPrize: Boolean(record.allowNoPrize || false),
      maxParticipants: record.maxParticipants || null,
      participantFormConfig: record.participantFormConfig || null,
      publicMessage: toText(record.publicMessage),
      resultNotice: toText(record.resultNotice),
      startAt: record.startAt || null,
      endAt: record.endAt || null,
      openedAt: record.openedAt || null,
      closedAt: record.closedAt || null,
      cancelledAt: record.cancelledAt || null,
      createdAt: record.createdAt || null,
      updatedAt: record.updatedAt || null,
    };
  },

  async updateLuckyWheel(idParam, payload = {}, tenantId, auth = null) {
    const where = whereByParam(idParam);
    if (!where) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }
    const whereMerged = mergeTenantWhere({ $and: [where, { $or: [{ isDeleted: false }, { isDeleted: { $null: true } }] }] }, tenantId);
    const existing = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: whereMerged });
    if (!existing) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }

    // prevent changing tenant
    const updateData = {};
    if (payload.name !== undefined) updateData.name = toText(payload.name);
    if (payload.description !== undefined) updateData.description = payload.description || null;
    if (payload.publicMessage !== undefined) updateData.publicMessage = payload.publicMessage || null;
    if (payload.resultNotice !== undefined) updateData.resultNotice = payload.resultNotice || null;
    if (payload.participationMode !== undefined) updateData.participationMode = toText(payload.participationMode);
    if (payload.participantFormConfig !== undefined) updateData.participantFormConfig = payload.participantFormConfig || null;
    if (payload.allowNoPrize !== undefined) updateData.allowNoPrize = Boolean(payload.allowNoPrize);
    if (payload.maxParticipants !== undefined) updateData.maxParticipants = payload.maxParticipants || null;

    // normalize code if provided
    if (payload.code !== undefined) {
      const code = normalizeWheelCodeRaw(payload.code || '');
      if (!code) { const e = new Error('WHEEL_CODE_REQUIRED'); e.status = 400; throw e; }
      // check duplicate excluding current
      const dup = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: mergeTenantWhere({ code, id: { $ne: existing.id } }, tenantId) });
      if (dup) { const e = new Error('WHEEL_CODE_DUPLICATED'); e.status = 409; throw e; }
      updateData.code = code;
    }

    // disallow status change via this endpoint
    if (payload.status !== undefined) delete payload.status;

    if (Object.keys(updateData).length === 0) return existing;

    const updated = await strapi.db.query(LUCKY_WHEEL_UID).update({ where: { id: existing.id }, data: updateData });
    return updated;
  },

  async openLuckyWheel(idParam, tenantId, auth = null) {
    const where = whereByParam(idParam);
    if (!where) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }
    const whereMerged = mergeTenantWhere({ $and: [where, { $or: [{ isDeleted: false }, { isDeleted: { $null: true } }] }] }, tenantId);
    const existing = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: whereMerged });
    if (!existing) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }

    const currentStatus = String(existing.status || '').toLowerCase();
    if (currentStatus === 'opened') return existing;

    const nowIso = new Date().toISOString();
    const data = { status: 'opened', openedAt: nowIso, closedAt: null, cancelledAt: null };
    const updated = await strapi.db.query(LUCKY_WHEEL_UID).update({ where: { id: existing.id }, data });
    return updated;
  },

  // Prize management (tenant-scoped, nested under a wheel)
  async listPrizes(wheelIdParam, tenantId) {
    const whereWheel = whereByParam(wheelIdParam);
    if (!whereWheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }
    const wheel = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: mergeTenantWhere(whereWheel, tenantId) });
    if (!wheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }

    const where = mergeTenantWhere({ luckyWheel: wheel.id, $or: [{ isDeleted: false }, { isDeleted: { $null: true } }] }, tenantId);
    const rows = await strapi.db.query(PRIZE_UID).findMany({ where, orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }], populate: ['image', 'imageFile'] });
    return (rows || []).map((r) => normalizePrizeRecord(r));
  },

  async createPrize(wheelIdParam, payload = {}, tenantId, auth = null) {
    const whereWheel = whereByParam(wheelIdParam);
    if (!whereWheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }
    const wheel = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: mergeTenantWhere(whereWheel, tenantId) });
    if (!wheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }

    const name = toText(payload.name || '');
    if (!name) { const e = new Error('PRIZE_NAME_REQUIRED'); e.status = 400; throw e; }

    const isUnlimited = Boolean(payload.isUnlimited);
    const quantity = isUnlimited ? null : (Number(payload.quantity || payload.remainingQuantity || 0));
    const remainingQuantity = isUnlimited ? null : (Number(payload.remainingQuantity !== undefined ? payload.remainingQuantity : (payload.quantity !== undefined ? payload.quantity : 0)));

    const data = {
      tenant: tenantId,
      luckyWheel: wheel.id,
      name,
      shortLabel: toText(payload.shortLabel || ''),
      description: payload.description || null,
      resultMessage: payload.resultMessage || null,
      // payload.image may be a tenant storage fileAsset id (number) or media object
      image: null,
      imageFile: payload.image ? payload.image : null,
      displayColor: toText(payload.displayColor || ''),
      textColor: toText(payload.textColor || ''),
      displayOrder: Number(payload.displayOrder || 0),
      quantity: quantity,
      remainingQuantity: remainingQuantity,
      isUnlimited,
      weight: Number(payload.weight || 1),
      isNoPrize: Boolean(payload.isNoPrize),
      isActive: payload.isActive === undefined ? true : Boolean(payload.isActive),
      isDeleted: false,
      createdBy: auth?.id || null,
    };

    const created = await strapi.db.query(PRIZE_UID).create({ data });
    const populated = await strapi.db.query(PRIZE_UID).findOne({ where: { id: created.id }, populate: ['image', 'imageFile'] });
    return normalizePrizeRecord(populated);
  },

  async updatePrize(wheelIdParam, prizeIdParam, payload = {}, tenantId, auth = null) {
    const whereWheel = whereByParam(wheelIdParam);
    if (!whereWheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }
    const wheel = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: mergeTenantWhere(whereWheel, tenantId) });
    if (!wheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }

    const prizeWhere = whereByParam(prizeIdParam);
    if (!prizeWhere) { const e = new Error('PRIZE_NOT_FOUND'); e.status = 404; throw e; }
    const prize = await strapi.db.query(PRIZE_UID).findOne({ where: mergeTenantWhere({ $and: [prizeWhere, { luckyWheel: wheel.id, $or: [{ isDeleted: false }, { isDeleted: { $null: true } }] }] }, tenantId) });
    if (!prize) { const e = new Error('PRIZE_NOT_FOUND'); e.status = 404; throw e; }

    const updateData = {};
    if (payload.name !== undefined) updateData.name = toText(payload.name);
    if (payload.shortLabel !== undefined) updateData.shortLabel = toText(payload.shortLabel || '');
    if (payload.description !== undefined) updateData.description = payload.description || null;
    if (payload.resultMessage !== undefined) updateData.resultMessage = payload.resultMessage || null;
    if (payload.image !== undefined) {
      // support passing a tenant fileAsset id to `image`
      updateData.image = null;
      updateData.imageFile = payload.image || null;
    }
    if (payload.displayColor !== undefined) updateData.displayColor = toText(payload.displayColor || '');
    if (payload.textColor !== undefined) updateData.textColor = toText(payload.textColor || '');
    if (payload.displayOrder !== undefined) updateData.displayOrder = Number(payload.displayOrder || 0);
    if (payload.isUnlimited !== undefined) updateData.isUnlimited = Boolean(payload.isUnlimited);
    if (payload.quantity !== undefined) updateData.quantity = payload.quantity === null ? null : Number(payload.quantity);
    if (payload.remainingQuantity !== undefined) updateData.remainingQuantity = payload.remainingQuantity === null ? null : Number(payload.remainingQuantity);
    if (payload.weight !== undefined) updateData.weight = Number(payload.weight || 1);
    if (payload.isNoPrize !== undefined) updateData.isNoPrize = Boolean(payload.isNoPrize);
    if (payload.isActive !== undefined) updateData.isActive = Boolean(payload.isActive);

    if (Object.keys(updateData).length === 0) return prize;

    await strapi.db.query(PRIZE_UID).update({ where: { id: prize.id }, data: updateData });
    const populated = await strapi.db.query(PRIZE_UID).findOne({ where: { id: prize.id }, populate: ['image', 'imageFile'] });
    return normalizePrizeRecord(populated);
  },

  async softDeletePrize(wheelIdParam, prizeIdParam, tenantId, auth = null) {
    const whereWheel = whereByParam(wheelIdParam);
    if (!whereWheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }
    const wheel = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: mergeTenantWhere(whereWheel, tenantId) });
    if (!wheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }

    const prizeWhere = whereByParam(prizeIdParam);
    if (!prizeWhere) { const e = new Error('PRIZE_NOT_FOUND'); e.status = 404; throw e; }
    const prize = await strapi.db.query(PRIZE_UID).findOne({ where: mergeTenantWhere({ $and: [prizeWhere, { luckyWheel: wheel.id, $or: [{ isDeleted: false }, { isDeleted: { $null: true } }] }] }, tenantId) });
    if (!prize) { const e = new Error('PRIZE_NOT_FOUND'); e.status = 404; throw e; }

    const now = new Date().toISOString();
    await strapi.db.query(PRIZE_UID).update({ where: { id: prize.id }, data: { isDeleted: true, deletedAt: now, deletedBy: auth?.id || null } });
    const populated = await strapi.db.query(PRIZE_UID).findOne({ where: { id: prize.id }, populate: ['image', 'imageFile'] });
    return normalizePrizeRecord(populated);
  },

  // Participant management (tenant-scoped, nested under a wheel)
  async listParticipants(wheelIdParam, query = {}, tenantId) {
    const whereWheel = whereByParam(wheelIdParam);
    if (!whereWheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }
    const wheel = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: mergeTenantWhere(whereWheel, tenantId) });
    if (!wheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }

    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const pageSize = Number(query.pageSize) > 0 ? Number(query.pageSize) : 100;
    const offset = (page - 1) * pageSize;

    const baseWhere = mergeTenantWhere({ luckyWheel: wheel.id, $or: [{ isDeleted: false }, { isDeleted: { $null: true } }] }, tenantId);
    const rows = await strapi.db.query(PARTICIPANT_UID).findMany({ where: baseWhere, limit: pageSize, offset, orderBy: [{ createdAt: 'desc' }] });
    const total = await strapi.db.query(PARTICIPANT_UID).count({ where: baseWhere });

    const items = (rows || []).map((r) => ({
      id: r.id,
      participantCode: r.participantCode || null,
      fullName: r.fullName || null,
      phone: r.phone || null,
      email: r.email || null,
      className: r.className || null,
      status: r.status || null,
      source: r.source || null,
      registeredAt: r.registeredAt || null,
      createdAt: r.createdAt || null,
      updatedAt: r.updatedAt || null,
      isDeleted: Boolean(r.isDeleted),
    }));

    return { rows: items, pagination: { page, pageSize, pageCount: Math.ceil(total / pageSize) || 1, total } };
  },

  async createParticipant(wheelIdParam, payload = {}, tenantId, auth = null) {
    const whereWheel = whereByParam(wheelIdParam);
    if (!whereWheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }
    const wheel = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: mergeTenantWhere(whereWheel, tenantId) });
    if (!wheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }

    const data = {
      tenant: tenantId,
      luckyWheel: wheel.id,
      participantCode: payload.participantCode || null,
      fullName: payload.fullName || null,
      phone: payload.phone ? normalizePhoneRaw(payload.phone) : null,
      email: payload.email || null,
      className: payload.className || null,
      source: payload.source || 'admin',
      status: payload.status || 'eligible',
      registeredAt: payload.registeredAt || new Date().toISOString(),
      createdBy: auth?.id || null,
      isDeleted: false,
    };

    const created = await strapi.db.query(PARTICIPANT_UID).create({ data });
    return created;
  },

  async updateParticipant(wheelIdParam, participantIdParam, payload = {}, tenantId, auth = null) {
    const whereWheel = whereByParam(wheelIdParam);
    if (!whereWheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }
    const wheel = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: mergeTenantWhere(whereWheel, tenantId) });
    if (!wheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }

    const participantWhere = whereByParam(participantIdParam);
    if (!participantWhere) { const e = new Error('PARTICIPANT_NOT_FOUND'); e.status = 404; throw e; }
    const participant = await strapi.db.query(PARTICIPANT_UID).findOne({ where: mergeTenantWhere({ $and: [participantWhere, { luckyWheel: wheel.id, $or: [{ isDeleted: false }, { isDeleted: { $null: true } }] }] }, tenantId) });
    if (!participant) { const e = new Error('PARTICIPANT_NOT_FOUND'); e.status = 404; throw e; }

    const updateData = {};
    if (payload.participantCode !== undefined) updateData.participantCode = payload.participantCode || null;
    if (payload.fullName !== undefined) updateData.fullName = payload.fullName || null;
    if (payload.phone !== undefined) updateData.phone = payload.phone ? normalizePhoneRaw(payload.phone) : null;
    if (payload.email !== undefined) updateData.email = payload.email || null;
    if (payload.className !== undefined) updateData.className = payload.className || null;
    if (payload.status !== undefined) updateData.status = payload.status || null;

    if (Object.keys(updateData).length === 0) return participant;

    await strapi.db.query(PARTICIPANT_UID).update({ where: { id: participant.id }, data: updateData });
    const updated = await strapi.db.query(PARTICIPANT_UID).findOne({ where: { id: participant.id } });
    return updated;
  },

  async blockParticipant(wheelIdParam, participantIdParam, tenantId, auth = null) {
    const whereWheel = whereByParam(wheelIdParam);
    if (!whereWheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }
    const wheel = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: mergeTenantWhere(whereWheel, tenantId) });
    if (!wheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }

    const participantWhere = whereByParam(participantIdParam);
    if (!participantWhere) { const e = new Error('PARTICIPANT_NOT_FOUND'); e.status = 404; throw e; }
    const participant = await strapi.db.query(PARTICIPANT_UID).findOne({ where: mergeTenantWhere({ $and: [participantWhere, { luckyWheel: wheel.id }] }, tenantId) });
    if (!participant) { const e = new Error('PARTICIPANT_NOT_FOUND'); e.status = 404; throw e; }

    await strapi.db.query(PARTICIPANT_UID).update({ where: { id: participant.id }, data: { status: 'blocked' } });
    const updated = await strapi.db.query(PARTICIPANT_UID).findOne({ where: { id: participant.id } });
    return updated;
  },

  async unblockParticipant(wheelIdParam, participantIdParam, tenantId, auth = null) {
    const whereWheel = whereByParam(wheelIdParam);
    if (!whereWheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }
    const wheel = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: mergeTenantWhere(whereWheel, tenantId) });
    if (!wheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }

    const participantWhere = whereByParam(participantIdParam);
    if (!participantWhere) { const e = new Error('PARTICIPANT_NOT_FOUND'); e.status = 404; throw e; }
    const participant = await strapi.db.query(PARTICIPANT_UID).findOne({ where: mergeTenantWhere({ $and: [participantWhere, { luckyWheel: wheel.id }] }, tenantId) });
    if (!participant) { const e = new Error('PARTICIPANT_NOT_FOUND'); e.status = 404; throw e; }

    await strapi.db.query(PARTICIPANT_UID).update({ where: { id: participant.id }, data: { status: 'eligible' } });
    const updated = await strapi.db.query(PARTICIPANT_UID).findOne({ where: { id: participant.id } });
    return updated;
  },

  async previewImportParticipants(wheelIdParam, rows = [], tenantId) {
    const whereWheel = whereByParam(wheelIdParam);
    if (!whereWheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }
    const wheel = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: mergeTenantWhere(whereWheel, tenantId) });
    if (!wheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }

    // rows: array of objects with keys: participantCode, fullName, phone, email, className
    const preview = [];
    for (const r of (rows || [])) {
      const row = r || {};
      const code = toText(row.participantCode || row.code || '');
      const fullName = toText(row.fullName || row.fullname || '');
      const phone = row.phone ? normalizePhoneRaw(row.phone) : null;
      const email = toText(row.email || '');
      const className = toText(row.className || row.classname || '');
      const errors = [];
      // participantCode required for predefined mode; otherwise optional
      if ((wheel.participationMode || 'predefined') === 'predefined' && !code) errors.push('participantCode required');
      // basic phone format check
      if (phone && !/^[0-9+\- ]+$/.test(phone)) errors.push('phone invalid');

      preview.push({ raw: row, participantCode: code || null, fullName: fullName || null, phone: phone || null, email: email || null, className: className || null, valid: errors.length === 0, errors });
    }
    return preview;
  },

  async importParticipants(wheelIdParam, rows = [], tenantId, auth = null) {
    const whereWheel = whereByParam(wheelIdParam);
    if (!whereWheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }
    const wheel = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: mergeTenantWhere(whereWheel, tenantId) });
    if (!wheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }

    const created = [];
    await strapi.db.transaction(async ({ trx }) => {
      for (const r of (rows || [])) {
        const row = r || {};
        const code = toText(row.participantCode || row.code || '');
        const fullName = toText(row.fullName || row.fullname || '');
        const phone = row.phone ? normalizePhoneRaw(row.phone) : null;
        const email = toText(row.email || '');
        const className = toText(row.className || row.classname || '');

        const data = {
          tenant: tenantId,
          luckyWheel: wheel.id,
          participantCode: code || null,
          fullName: fullName || null,
          phone: phone || null,
          email: email || null,
          className: className || null,
          source: 'import',
          status: 'eligible',
          registeredAt: new Date().toISOString(),
          createdBy: auth?.id || null,
          isDeleted: false,
        };
        const c = await strapi.db.query(PARTICIPANT_UID).create({ data, transacting: trx });
        created.push(c);
      }
    });
    return created;
  },

  async generateParticipantCodes(wheelIdParam, payload = {}, tenantId, auth = null) {
    const whereWheel = whereByParam(wheelIdParam);
    if (!whereWheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }
    const wheel = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: mergeTenantWhere(whereWheel, tenantId) });
    if (!wheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }

    const count = Number(payload.count || 0);
    const prefix = payload.prefix ? String(payload.prefix) : '';
    const suffixLength = Number(payload.suffixLength || payload.length || 6);
    if (!count || count <= 0) return [];
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    function makeSuffix(len) {
      let s = '';
      for (let i = 0; i < len; i += 1) s += alphabet[crypto.randomInt(0, alphabet.length)];
      return s;
    }

    // fetch existing codes for this wheel+tenant to avoid collisions
    const existing = await strapi.db.query(PARTICIPANT_UID).findMany({ where: mergeTenantWhere({ luckyWheel: { id: { $eq: wheel.id } } }, tenantId) });
    const existingSet = new Set((existing || []).map((r) => String(r.participantCode || '').toUpperCase()).filter(Boolean));

    const created = [];
    await strapi.db.transaction(async ({ trx }) => {
      let attempts = 0;
      while (created.length < count && attempts < count * 10) {
        attempts += 1;
        const suffix = makeSuffix(suffixLength);
        const code = (prefix || '') + suffix;
        if (existingSet.has(code.toUpperCase())) continue;
        // ensure DB uniqueness one more time
        const exists = await strapi.db.query(PARTICIPANT_UID).findOne({ where: mergeTenantWhere({ participantCode: { $eq: code }, luckyWheel: { id: { $eq: wheel.id } } }, tenantId), transacting: trx });
        if (exists) { existingSet.add(code.toUpperCase()); continue; }
        const data = {
          tenant: tenantId,
          luckyWheel: wheel.id,
          participantCode: code,
          fullName: null,
          phone: null,
          email: null,
          className: null,
          source: 'generated',
          status: 'eligible',
          registeredAt: new Date().toISOString(),
          createdBy: auth?.id || null,
          isDeleted: false,
        };
        const rec = await strapi.db.query(PARTICIPANT_UID).create({ data, transacting: trx });
        created.push(rec);
        existingSet.add(code.toUpperCase());
      }
    });
    return created;
  },

  async exportParticipants(wheelIdParam, tenantId, params = {}) {
    const whereWheel = whereByParam(wheelIdParam);
    if (!whereWheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }
    const wheel = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: mergeTenantWhere(whereWheel, tenantId) });
    if (!wheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }

    const where = mergeTenantWhere({ luckyWheel: { id: { $eq: wheel.id } }, isDeleted: { $eq: false } }, tenantId);
    const rows = await strapi.db.query(PARTICIPANT_UID).findMany({ where, orderBy: { createdAt: 'asc' } });

    const data = (rows || []).map((r) => ({
      participantCode: r.participantCode || null,
      fullName: r.fullName || r.fullname || null,
      phone: r.phone || null,
      email: r.email || null,
      className: r.className || r.classname || null,
      status: r.status || null,
      source: r.source || null,
      registeredAt: r.registeredAt || r.createdAt || null,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'participants');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return { buffer: buf, filename: `participants-${wheel.id}.xlsx` };
  },

  async listResults(wheelIdParam, query = {}, tenantId) {
    const whereWheel = whereByParam(wheelIdParam);
    if (!whereWheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }
    const wheel = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: mergeTenantWhere(whereWheel, tenantId) });
    if (!wheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }

    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const pageSize = Number(query.pageSize) > 0 ? Number(query.pageSize) : 100;
    const offset = (page - 1) * pageSize;
    const search = toText(query.search || query.q || '');
    const claimStatus = toText(query.claimStatus || '');
    const status = toText(query.status || '');

    const whereClauses = [
      { luckyWheel: wheel.id },
      { $or: [{ isDeleted: false }, { isDeleted: { $null: true } }] },
    ];
    if (status) whereClauses.push({ status: { $eq: status } });
    if (claimStatus) whereClauses.push({ claimStatus: { $eq: claimStatus } });
    if (search) {
      whereClauses.push({
        $or: [
          { verificationCode: { $containsi: search } },
          { participantCodeSnapshot: { $containsi: search } },
          { participantNameSnapshot: { $containsi: search } },
          { participantPhoneSnapshot: { $containsi: search } },
          { participantEmailSnapshot: { $containsi: search } },
          { participantClassNameSnapshot: { $containsi: search } },
          { prizeNameSnapshot: { $containsi: search } },
        ],
      });
    }

    const baseWhere = mergeTenantWhere({ $and: whereClauses }, tenantId);
    const rows = await strapi.db.query(SPIN_UID).findMany({
      where: baseWhere,
      limit: pageSize,
      offset,
      orderBy: [{ spunAt: 'desc' }, { id: 'desc' }],
    });
    const total = await strapi.db.query(SPIN_UID).count({ where: baseWhere });

    return {
      rows: (rows || []).map((record) => normalizeSpinRecord(record)),
      pagination: { page, pageSize, pageCount: Math.ceil(total / pageSize) || 1, total },
    };
  },

  async exportResults(wheelIdParam, tenantId, params = {}) {
    const result = await this.listResults(wheelIdParam, { ...params, page: 1, pageSize: 5000 }, tenantId);
    const rows = (result.rows || []).map((record) => ({
      spunAt: record.spunAt || null,
      verificationCode: record.verificationCode || null,
      status: record.status || null,
      claimStatus: record.claimStatus || null,
      participantCode: record.participantCode || null,
      fullName: record.participantFullName || null,
      phone: record.participantPhone || null,
      email: record.participantEmail || null,
      className: record.participantClassName || null,
      prizeName: record.prizeName || null,
      prizeDescription: record.prizeDescription || null,
      resultMessage: record.prizeResultMessage || null,
      isNoPrize: record.prizeIsNoPrize ? 'Yes' : 'No',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'results');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return { buffer: buf, filename: `results-${wheelIdParam}.xlsx` };
  },

  async softDeleteLuckyWheel(idParam, tenantId, auth = null) {
    const where = whereByParam(idParam);
    if (!where) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }
    const whereMerged = mergeTenantWhere({ $and: [where, { $or: [{ isDeleted: false }, { isDeleted: { $null: true } }] }] }, tenantId);
    const existing = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: whereMerged });
    if (!existing) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }

    // check existing spins
    const spinCount = await strapi.db.query(SPIN_UID).count({ where: mergeTenantWhere({ luckyWheel: existing.id }, tenantId) });
    if (spinCount > 0) { const e = new Error('WHEEL_HAS_SPINS'); e.status = 400; throw e; }

    const now = new Date().toISOString();
    const updated = await strapi.db.query(LUCKY_WHEEL_UID).update({ where: { id: existing.id }, data: { isDeleted: true, deletedAt: now, deletedBy: auth?.id || null } });
    return updated;
  },

  async restoreLuckyWheel(idParam, tenantId, auth = null) {
    const where = whereByParam(idParam);
    if (!where) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }
    const whereMerged = mergeTenantWhere({ $and: [where, { isDeleted: true }] }, tenantId);
    const existing = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: whereMerged });
    if (!existing) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }

    const updated = await strapi.db.query(LUCKY_WHEEL_UID).update({ where: { id: existing.id }, data: { isDeleted: false, deletedAt: null, restoredBy: auth?.id || null } });
    return updated;
  },

  async getLuckyWheelSummary(idParam, tenantId) {
    const where = whereByParam(idParam);
    if (!where) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }
    const whereMerged = mergeTenantWhere({ $and: [where, { $or: [{ isDeleted: false }, { isDeleted: { $null: true } }] }] }, tenantId);
    const wheel = await strapi.db.query(LUCKY_WHEEL_UID).findOne({ where: whereMerged });
    if (!wheel) { const e = new Error('WHEEL_NOT_FOUND'); e.status = 404; throw e; }

    // statistics
    const totalPrizes = await strapi.db.query(PRIZE_UID).count({ where: mergeTenantWhere({ luckyWheel: wheel.id, $or: [{ isDeleted: false }, { isDeleted: { $null: true } }] }, tenantId) });
    const activePrizes = await strapi.db.query(PRIZE_UID).count({ where: mergeTenantWhere({ luckyWheel: wheel.id, isActive: { $eq: true }, $or: [{ isDeleted: false }, { isDeleted: { $null: true } }] }, tenantId) });
    const totalParticipants = await strapi.db.query(PARTICIPANT_UID).count({ where: mergeTenantWhere({ luckyWheel: wheel.id, $or: [{ isDeleted: false }, { isDeleted: { $null: true } }] }, tenantId) });
    const eligibleParticipants = await strapi.db.query(PARTICIPANT_UID).count({ where: mergeTenantWhere({ luckyWheel: wheel.id, status: { $eq: 'eligible' }, $or: [{ isDeleted: false }, { isDeleted: { $null: true } }] }, tenantId) });
    const usedParticipants = await strapi.db.query(PARTICIPANT_UID).count({ where: mergeTenantWhere({ luckyWheel: wheel.id, status: { $eq: 'used' }, $or: [{ isDeleted: false }, { isDeleted: { $null: true } }] }, tenantId) });
    const blockedParticipants = await strapi.db.query(PARTICIPANT_UID).count({ where: mergeTenantWhere({ luckyWheel: wheel.id, status: { $eq: 'blocked' }, $or: [{ isDeleted: false }, { isDeleted: { $null: true } }] }, tenantId) });

    const totalSpins = await strapi.db.query(SPIN_UID).count({ where: mergeTenantWhere({ luckyWheel: wheel.id }, tenantId) });
    const noPrizeSpins = await strapi.db.query(SPIN_UID).count({ where: mergeTenantWhere({ luckyWheel: wheel.id, prizeIsNoPrizeSnapshot: true }, tenantId) });
    const winningSpins = totalSpins - noPrizeSpins;
    const claimedPrizes = await strapi.db.query(SPIN_UID).count({ where: mergeTenantWhere({ luckyWheel: wheel.id, status: { $eq: 'claimed' } }, tenantId) });
    const unclaimedPrizes = await strapi.db.query(SPIN_UID).count({ where: mergeTenantWhere({ luckyWheel: wheel.id, status: { $ne: 'claimed' } }, tenantId) });

    return {
      wheel: {
        id: wheel.id,
        name: toText(wheel.name),
        code: toText(wheel.code),
        status: toText(wheel.status),
        startAt: wheel.startAt || null,
        endAt: wheel.endAt || null,
        participationMode: toText(wheel.participationMode),
      },
      statistics: {
        totalPrizes,
        activePrizes,
        totalParticipants,
        eligibleParticipants,
        usedParticipants,
        blockedParticipants,
        totalSpins,
        winningSpins,
        noPrizeSpins,
        claimedPrizes,
        unclaimedPrizes,
      },
    };
  },
};