import { mergeTenantWhere, parseOptionalPositiveInt, resolveCurrentTenantId, toText } from '../../../utils/tenant-scope';
import { generateAssistantReply } from '../../public-chat/services/ai-chat';

const AI_ASSISTANT_UID = 'api::ai-assistant.ai-assistant';
const AI_KNOWLEDGE_UID = 'api::ai-knowledge.ai-knowledge';

class AiManagementError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function extractPayload(body: any): Record<string, unknown> {
  if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    return body.data as Record<string, unknown>;
  }

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }

  return {};
}

function toRequiredText(value: unknown, label: string): string {
  const text = toText(value);
  if (!text) {
    throw new AiManagementError(400, `${label} is required`);
  }
  return text;
}

function toNullableText(value: unknown): string | null {
  const text = toText(value);
  return text || null;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = toText(value).toLowerCase();
  if (!text) return fallback;
  return ['true', '1', 'yes', 'on'].includes(text);
}

function toProvider(value: unknown): 'OPENAI' | 'GEMINI' | 'ANTHROPIC' {
  const provider = toText(value).toUpperCase();
  if (provider === 'GEMINI' || provider === 'ANTHROPIC') return provider;
  return 'OPENAI';
}

function toKnowledgeStatus(value: unknown): 'ACTIVE' | 'INACTIVE' {
  return toText(value).toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
}

function toTemperature(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.3;
  return Math.min(2, Math.max(0, parsed));
}

function toMaxTokens(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return 800;
  return parsed;
}

function toPriority(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return 0;
  return parsed;
}

function normalizeAssistant(row: any) {
  if (!row?.id) return null;

  return {
    id: row.id,
    assistantName: row.assistantName || '',
    name: row.name || '',
    provider: row.provider || 'OPENAI',
    model: row.model || 'gpt-4o-mini',
    systemPrompt: row.systemPrompt || '',
    welcomeMessage: row.welcomeMessage || '',
    enabled: row.enabled === true,
    temperature: Number(row.temperature || 0.3) || 0.3,
    maxTokens: Number(row.maxTokens || 800) || 800,
    updatedAt: row.updatedAt || null,
    createdAt: row.createdAt || null,
  };
}

function buildProviderStatus(provider: unknown) {
  const normalizedProvider = toProvider(provider);
  const openAiApiKeyConfigured = Boolean(toText(process.env.OPENAI_API_KEY));

  return {
    provider: normalizedProvider,
    openAiApiKeyConfigured,
    endpointConfigured: normalizedProvider === 'OPENAI',
  };
}

function normalizeKnowledge(row: any) {
  if (!row?.id) return null;

  return {
    id: row.id,
    title: row.title || '',
    content: row.content || '',
    status: row.status || 'ACTIVE',
    priority: Number(row.priority || 0) || 0,
    updatedAt: row.updatedAt || null,
    createdAt: row.createdAt || null,
  };
}

async function findAssistantByIdOrThrow(id: unknown, tenantId: number | string) {
  const numericId = parseOptionalPositiveInt(id);
  if (!numericId) {
    throw new AiManagementError(404, 'AI assistant not found');
  }

  const assistant = await strapi.db.query(AI_ASSISTANT_UID).findOne({
    where: mergeTenantWhere({ id: { $eq: numericId } }, tenantId),
  });

  if (!assistant?.id) {
    throw new AiManagementError(404, 'AI assistant not found');
  }

  return assistant;
}

async function findPrimaryAssistant(tenantId: number | string) {
  const rows = await strapi.db.query(AI_ASSISTANT_UID).findMany({
    where: mergeTenantWhere({}, tenantId),
    orderBy: [{ enabled: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }],
    limit: 1,
  });

  return Array.isArray(rows) ? rows[0] || null : null;
}

async function findEnabledAssistant(tenantId: number | string) {
  const rows = await strapi.db.query(AI_ASSISTANT_UID).findMany({
    where: mergeTenantWhere({ enabled: true }, tenantId),
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    limit: 1,
  });

  return Array.isArray(rows) ? rows[0] || null : null;
}

async function disableOtherAssistants(tenantId: number | string, exceptId: number | string) {
  const rows = await strapi.db.query(AI_ASSISTANT_UID).findMany({
    where: mergeTenantWhere({ enabled: true }, tenantId),
    select: ['id', 'enabled'],
  });

  for (const row of rows || []) {
    if (String(row?.id || '') === String(exceptId || '')) continue;
    await strapi.db.query(AI_ASSISTANT_UID).update({
      where: { id: row.id },
      data: { enabled: false },
    });
  }
}

function buildAssistantMutationPayload(payload: Record<string, unknown>) {
  return {
    assistantName: toNullableText(payload.assistantName) || null,
    name: toRequiredText(payload.name, 'name'),
    provider: toProvider(payload.provider),
    model: toNullableText(payload.model) || 'gpt-4o-mini',
    systemPrompt: toNullableText(payload.systemPrompt),
    welcomeMessage: toNullableText(payload.welcomeMessage),
    enabled: toBoolean(payload.enabled, false),
    temperature: toTemperature(payload.temperature),
    maxTokens: toMaxTokens(payload.maxTokens),
  };
}

function buildKnowledgeMutationPayload(payload: Record<string, unknown>) {
  return {
    title: toRequiredText(payload.title, 'title'),
    content: toRequiredText(payload.content, 'content'),
    status: toKnowledgeStatus(payload.status),
    priority: toPriority(payload.priority),
  };
}

async function findKnowledgeByIdOrThrow(id: unknown, tenantId: number | string) {
  const numericId = parseOptionalPositiveInt(id);
  if (!numericId) {
    throw new AiManagementError(404, 'AI knowledge not found');
  }

  const knowledge = await strapi.db.query(AI_KNOWLEDGE_UID).findOne({
    where: mergeTenantWhere({ id: { $eq: numericId } }, tenantId),
  });

  if (!knowledge?.id) {
    throw new AiManagementError(404, 'AI knowledge not found');
  }

  return knowledge;
}

export function getTenantIdFromContext(ctx: any) {
  return resolveCurrentTenantId(ctx);
}

export async function getAiAssistant(tenantId: number | string) {
  const assistant = await findPrimaryAssistant(tenantId);
  return {
    ...(normalizeAssistant(assistant) || {}),
    providerStatus: buildProviderStatus(assistant?.provider),
  };
}

export async function saveAiAssistant(body: any, tenantId: number | string) {
  const payload = extractPayload(body);
  const mutation = buildAssistantMutationPayload(payload);

  let assistant = null;
  const assistantId = parseOptionalPositiveInt(payload.id);
  if (assistantId) {
    assistant = await findAssistantByIdOrThrow(assistantId, tenantId);
  } else {
    assistant = await findPrimaryAssistant(tenantId);
  }

  const saved = assistant?.id
    ? await strapi.db.query(AI_ASSISTANT_UID).update({
        where: { id: assistant.id },
        data: mutation,
      })
    : await strapi.db.query(AI_ASSISTANT_UID).create({
        data: {
          ...mutation,
          tenant: tenantId,
        },
      });

  if (saved?.id && mutation.enabled === true) {
    await disableOtherAssistants(tenantId, saved.id);
  }

  return {
    ...(normalizeAssistant(saved) || {}),
    providerStatus: buildProviderStatus(saved?.provider),
  };
}

export async function testAiAssistant(tenantId: number | string) {
  const assistant = await findEnabledAssistant(tenantId);
  if (!assistant?.id) {
    throw new AiManagementError(400, 'Chưa bật AI Assistant cho tenant này.');
  }

  const apiKey = toText(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    throw new AiManagementError(400, 'Thiếu OPENAI_API_KEY trên server.');
  }

  const provider = toProvider(assistant?.provider);
  if (provider !== 'OPENAI') {
    throw new AiManagementError(400, `Provider ${provider} chưa được hỗ trợ ở giai đoạn hiện tại.`);
  }

  const result = await generateAssistantReply({
    tenantId,
    session: null,
    messages: [],
    userMessage: 'VitaminFun là trung tâm gì?',
  });

  if (!result?.content) {
    throw new AiManagementError(400, 'OpenAI connection error');
  }

  return {
    response: result.content,
    provider: result.provider,
    model: result.model,
  };
}

export async function listAiKnowledge(query: any, tenantId: number | string) {
  const keyword = toText(query?.keyword || query?.q).toLowerCase();
  const status = toText(query?.status).toUpperCase();

  const whereClauses: Array<Record<string, unknown>> = [];
  if (keyword) {
    whereClauses.push({
      $or: [
        { title: { $containsi: keyword } },
        { content: { $containsi: keyword } },
      ],
    });
  }
  if (status === 'ACTIVE' || status === 'INACTIVE') {
    whereClauses.push({ status });
  }

  const where = whereClauses.length > 1 ? { $and: whereClauses } : (whereClauses[0] || {});
  const rows = await strapi.db.query(AI_KNOWLEDGE_UID).findMany({
    where: mergeTenantWhere(where, tenantId),
    orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }],
  });

  return {
    data: (rows || []).map((row: any) => normalizeKnowledge(row)).filter(Boolean),
  };
}

export async function getAiKnowledgeDetail(id: unknown, tenantId: number | string) {
  const knowledge = await findKnowledgeByIdOrThrow(id, tenantId);
  return normalizeKnowledge(knowledge);
}

export async function createAiKnowledge(body: any, tenantId: number | string) {
  const payload = extractPayload(body);
  const created = await strapi.db.query(AI_KNOWLEDGE_UID).create({
    data: {
      ...buildKnowledgeMutationPayload(payload),
      tenant: tenantId,
    },
  });

  return normalizeKnowledge(created);
}

export async function updateAiKnowledge(id: unknown, body: any, tenantId: number | string) {
  const knowledge = await findKnowledgeByIdOrThrow(id, tenantId);
  const payload = extractPayload(body);

  const updated = await strapi.db.query(AI_KNOWLEDGE_UID).update({
    where: { id: knowledge.id },
    data: buildKnowledgeMutationPayload(payload),
  });

  return normalizeKnowledge(updated);
}

export async function deleteAiKnowledge(id: unknown, tenantId: number | string) {
  const knowledge = await findKnowledgeByIdOrThrow(id, tenantId);
  await strapi.db.query(AI_KNOWLEDGE_UID).delete({
    where: { id: knowledge.id },
  });

  return { id: knowledge.id };
}