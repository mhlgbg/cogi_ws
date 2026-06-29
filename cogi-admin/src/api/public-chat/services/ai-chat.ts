const AI_ASSISTANT_UID = 'api::ai-assistant.ai-assistant';
const AI_KNOWLEDGE_UID = 'api::ai-knowledge.ai-knowledge';

const DEFAULT_SYSTEM_PROMPT = [
  'Bạn là trợ lý tư vấn của đơn vị giáo dục.',
  'Nhiệm vụ của bạn là hỗ trợ khách truy cập website, trả lời ngắn gọn, lịch sự, dễ hiểu.',
  'Không bịa thông tin.',
  'Nếu chưa đủ thông tin, hãy xin tên, số điện thoại hoặc email để nhân viên tư vấn liên hệ.',
  'Nếu khách có nhu cầu học tập, tuyển sinh, đăng ký hoặc tư vấn, hãy khuyến khích để lại số điện thoại.',
  'Không hứa chắc những thông tin chưa có trong dữ liệu được cung cấp.',
].join('\n');

const DEFAULT_RESPONSE_RULES = [
  'Trả lời bằng tiếng Việt tự nhiên, lịch sự và ngắn gọn.',
  'Chỉ dùng thông tin có trong system prompt, knowledge và lịch sử hội thoại được cung cấp.',
  'Nếu chưa đủ dữ liệu, nói rõ là chưa đủ thông tin và mời khách để lại số điện thoại hoặc email.',
  'Nếu khách hỏi về học tập, tuyển sinh, đăng ký hoặc tư vấn, ưu tiên khuyến khích để lại số điện thoại.',
  'Không nhắc đến việc bạn là AI trừ khi được hỏi trực tiếp.',
];

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeTemperature(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.3;
  return Math.min(2, Math.max(0, parsed));
}

function normalizeMaxTokens(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return 800;
  return parsed;
}

function normalizeHistoryMessages(messages: any[], userMessage: unknown) {
  const normalizedUserMessage = toText(userMessage);
  const rows = (Array.isArray(messages) ? messages : [])
    .map((item) => ({
      role: toText(item?.role || item?.senderType).toLowerCase(),
      content: toText(item?.content),
    }))
    .filter((item) => item.content && ['user', 'assistant', 'admin'].includes(item.role));

  if (normalizedUserMessage && rows.length > 0) {
    const last = rows[rows.length - 1];
    if (last?.role === 'user' && last.content === normalizedUserMessage) {
      rows.pop();
    }
  }

  return rows.slice(-12);
}

function buildKnowledgeSection(knowledgeRows: any[]) {
  const rows = (Array.isArray(knowledgeRows) ? knowledgeRows : [])
    .map((item, index) => {
      const title = toText(item?.title) || `Kiến thức ${index + 1}`;
      const content = toText(item?.content);
      if (!content) return '';
      return `# ${title}\n${content}`;
    })
    .filter(Boolean);

  return rows.length > 0 ? rows.join('\n\n') : 'Không có knowledge active nào được cấu hình.';
}

function buildConversationSection(session: any, historyMessages: any[]) {
  const lines: string[] = [];
  const sourcePage = toText(session?.sourcePage);
  const visitorName = toText(session?.visitorName);
  const visitorPhone = toText(session?.visitorPhone);
  const visitorEmail = toText(session?.visitorEmail);

  if (sourcePage) lines.push(`Trang nguồn: ${sourcePage}`);
  if (visitorName) lines.push(`Khách đã cung cấp tên: ${visitorName}`);
  if (visitorPhone) lines.push(`Khách đã cung cấp số điện thoại: ${visitorPhone}`);
  if (visitorEmail) lines.push(`Khách đã cung cấp email: ${visitorEmail}`);

  if (historyMessages.length === 0) {
    lines.push('Chưa có lịch sử hội thoại trước đó.');
  } else {
    lines.push('Lịch sử hội thoại gần nhất:');
    historyMessages.forEach((item) => {
      const speaker = item.role === 'user'
        ? 'Khách'
        : item.role === 'assistant'
          ? 'Trợ lý'
          : 'Nhân viên';
      lines.push(`- ${speaker}: ${item.content}`);
    });
  }

  return lines.join('\n');
}

function buildPromptMessages(input: {
  assistant: any;
  session: any;
  knowledgeRows: any[];
  historyMessages: any[];
  userMessage: unknown;
}) {
  const systemPrompt = toText(input.assistant?.systemPrompt) || DEFAULT_SYSTEM_PROMPT;
  const knowledgeSection = buildKnowledgeSection(input.knowledgeRows);
  const conversationSection = buildConversationSection(input.session, input.historyMessages);
  const normalizedUserMessage = toText(input.userMessage);

  return [
    { role: 'system', content: systemPrompt },
    { role: 'system', content: `Knowledge active của tenant:\n${knowledgeSection}` },
    { role: 'system', content: `Quy tắc trả lời:\n${DEFAULT_RESPONSE_RULES.join('\n')}` },
    { role: 'system', content: conversationSection },
    { role: 'user', content: normalizedUserMessage },
  ];
}

async function findEnabledAssistant(tenantId: number) {
  const rows = await strapi.db.query(AI_ASSISTANT_UID).findMany({
    where: {
      tenant: {
        id: {
          $eq: tenantId,
        },
      },
      enabled: true,
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    limit: 1,
  });

  return Array.isArray(rows) ? rows[0] || null : null;
}

async function findAnyAssistant(tenantId: number) {
  const rows = await strapi.db.query(AI_ASSISTANT_UID).findMany({
    where: {
      tenant: {
        id: {
          $eq: tenantId,
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    limit: 1,
  });

  return Array.isArray(rows) ? rows[0] || null : null;
}

async function findActiveKnowledge(tenantId: number) {
  return strapi.db.query(AI_KNOWLEDGE_UID).findMany({
    where: {
      tenant: {
        id: {
          $eq: tenantId,
        },
      },
      status: 'ACTIVE',
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    limit: 20,
  });
}

async function callOpenAiChatCompletion(input: {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  messages: Array<{ role: string; content: string }>;
}) {
  type OpenAiChatCompletionResponse = {
    choices?: Array<{
      message?: {
        content?: string | null;
      } | null;
    }>;
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
        messages: input.messages,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      throw new Error(`OpenAI request failed with status ${response.status}: ${responseText}`);
    }

    const payload = await response.json() as OpenAiChatCompletionResponse;
    const content = toText(payload?.choices?.[0]?.message?.content);
    return content || null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateAssistantReply(input: {
  tenantId: unknown;
  session?: any;
  messages?: any[];
  userMessage?: unknown;
}) {
  try {
    const tenantId = toPositiveInt(input?.tenantId);
    const userMessage = toText(input?.userMessage);

    if (!tenantId || !userMessage) {
      return null;
    }

    const assistant = await findEnabledAssistant(tenantId);
    if (!assistant?.id) {
      const configuredAssistant = await findAnyAssistant(tenantId);
      if (configuredAssistant?.id) {
        strapi.log.info('[ai-chat] assistant disabled, fallback to scripted reply');
      }
      return null;
    }

    const provider = toText(assistant?.provider).toUpperCase() || 'OPENAI';
    if (provider !== 'OPENAI') {
      strapi.log.info(`[ai-chat] provider ${provider} is not implemented yet; skip AI reply`);
      return null;
    }

    const apiKey = toText(process.env.OPENAI_API_KEY);
    if (!apiKey) {
      strapi.log.warn('OPENAI_API_KEY is missing, fallback to scripted reply');
      return null;
    }

    const knowledgeRows = await findActiveKnowledge(tenantId);
    const historyMessages = normalizeHistoryMessages(input?.messages || [], userMessage);
    const promptMessages = buildPromptMessages({
      assistant,
      session: input?.session || null,
      knowledgeRows,
      historyMessages,
      userMessage,
    });

    const model = toText(assistant?.model) || toText(process.env.OPENAI_DEFAULT_MODEL) || 'gpt-4o-mini';
    const content = await callOpenAiChatCompletion({
      apiKey,
      model,
      temperature: normalizeTemperature(assistant?.temperature),
      maxTokens: normalizeMaxTokens(assistant?.maxTokens),
      messages: promptMessages,
    });

    if (!content) {
      return null;
    }

    return {
      content,
      provider,
      model,
    };
  } catch (error) {
    strapi.log.error('[ai-chat.generateAssistantReply] failed', error);
    return null;
  }
}