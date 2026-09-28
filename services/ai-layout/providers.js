// AI 编排：与大模型 HTTP 交互（三家 provider 请求、响应解析、JSON 修复、超时）
import {
  AI_LAYOUT_SELECTION_AUTO,
  AI_LAYOUT_FAMILIES,
  AI_LAYOUT_COLOR_PALETTES,
  AI_LAYOUT_ALLOWED_BLOCKS,
  AI_LAYOUT_SKILL_SYSTEM_LINES,
  AI_LAYOUT_OUTPUT_FIELDS,
  getAiLayoutBlockConstraintLines,
} from '../ai-layout-skill-bundle.js';
import { toText } from '../input-utils.js';
import {
  AI_PROVIDER_KINDS,
  ANTHROPIC_LAYOUT_MAX_TOKENS,
  AI_LAYOUT_DEFAULT_COLOR_PALETTE,
  AI_LAYOUT_SKILL_LIST,
  AI_WECHAT_SAFE_STYLE_PRIMITIVES,
  readProviderUsage,
  isRecord,
  toRecord,
  toAiLayoutBlocks,
  toAiImageRefs,
  coerceString,
  summarizeText,
} from './shared.js';
import {
  normalizeResolvedLayoutFamily,
  normalizeResolvedColorPalette,
  normalizeLayoutSelection,
  normalizeResolvedSelection,
  getLayoutFamilyById,
  getLayoutSkillById,
  getColorPaletteById,
  resolveLayoutSelection,
  extractMarkdownSignals,
} from './core.js';

/** @typedef {import('./shared.js').AiLayoutSkillManifest} AiLayoutSkillManifest */
/** @typedef {import('./shared.js').AiLayoutSelectionLike} AiLayoutSelectionLike */
/** @typedef {import('./shared.js').AiUsageLike} AiUsageLike */
/** @typedef {import('./shared.js').AiImageRefLike} AiImageRefLike */
/** @typedef {import('./shared.js').FetchLike} FetchLike */
/**
 * @typedef {{ provider: ReturnType<typeof import('./core.js').normalizeAiProvider>, title?: string, markdown: string, selection?: AiLayoutSelectionLike, stylePack?: string, imageRefs?: AiImageRefLike[], timeoutMs: number, abortTimeoutMs?: number, fetchImpl: FetchLike }} AiLayoutRequestOptions
 */

/** @returns {FetchLike | undefined} */
function getDefaultFetch() {
  const activeWindow = typeof window !== 'undefined' ? window : null;
  if (activeWindow && typeof activeWindow.fetch === 'function') {
    /** @type {FetchLike} */
    const fetchFromActiveWindow = (input, init) => activeWindow.fetch(input, init);
    return fetchFromActiveWindow;
  }
  return undefined;
}

/**
 * @param {() => void} callback
 * @param {number} delay
 * @returns {number | null}
 */
function setAiLayoutTimeout(callback, delay) {
  if (typeof window === 'undefined' || typeof window.setTimeout !== 'function') return null;
  return window.setTimeout(callback, delay);
}

/**
 * @param {number | null | undefined} timer
 */
function clearAiLayoutTimeout(timer) {
  if (!timer || typeof window === 'undefined' || typeof window.clearTimeout !== 'function') return;
  window.clearTimeout(timer);
}

class AiLayoutTimeoutError extends Error {
  constructor(timeoutMs) {
    const seconds = Math.max(1, Math.round(Number(timeoutMs || 0) / 1000));
    super(`AI 请求超时（${seconds}s）`);
    this.name = 'AiLayoutTimeoutError';
    this.code = 'ai-layout-timeout';
    this.timeoutMs = Number(timeoutMs || 0);
  }
}

function truncateMarkdownForPrompt(markdown = '', maxChars = 12000) {
  const content = String(markdown || '').trim();
  if (!content || content.length <= maxChars) return content;
  const headLength = Math.max(2000, Math.floor(maxChars * 0.72));
  const tailLength = Math.max(800, maxChars - headLength);
  const head = content.slice(0, headLength).trimEnd();
  const tail = content.slice(-tailLength).trimStart();
  return [
    head,
    '',
    '[内容已截断，为了控制请求规模，这里省略了中间部分正文。]',
    '',
    tail,
  ].join('\n');
}

function extractJsonPayload(text) {
  const content = String(text || '').trim();
  if (!content) throw new Error('AI 未返回内容');

  const fencedMatch = content.match(/```json\s*([\s\S]*?)```/i) || content.match(/```\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : content;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('AI 返回结果不是有效 JSON');
  }
  return candidate.slice(firstBrace, lastBrace + 1);
}

function sanitizeJsonStringLiteralControls(payload = '') {
  const raw = String(payload || '');
  if (!raw) return raw;
  let sanitized = '';
  let inString = false;
  let isEscaped = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const charCode = raw.charCodeAt(index);

    if (!inString) {
      sanitized += char;
      if (char === '"') inString = true;
      continue;
    }

    if (isEscaped) {
      sanitized += char;
      isEscaped = false;
      continue;
    }

    if (char === '\\') {
      sanitized += char;
      isEscaped = true;
      continue;
    }

    if (char === '"') {
      sanitized += char;
      inString = false;
      continue;
    }

    if (charCode <= 0x1F) {
      if (char === '\n') sanitized += '\\n';
      else if (char === '\r') sanitized += '\\r';
      else if (char === '\t') sanitized += '\\t';
      else sanitized += ' ';
      continue;
    }

    sanitized += char;
  }

  return sanitized;
}

/**
 * @param {unknown} rawBlock
 * @returns {string}
 */
function inferBlockType(rawBlock = {}) {
  if (!isRecord(rawBlock)) return '';
  const blockRecord = rawBlock;
  const explicitType = coerceString(
    blockRecord.type
    || blockRecord.blockType
    || blockRecord.block_type
    || blockRecord.kind
    || blockRecord.component
  );
  const allowedTypes = new Set(AI_LAYOUT_ALLOWED_BLOCKS.map((item) => item.type));
  if (allowedTypes.has(explicitType)) return explicitType;

  if ('sectionIndex' in blockRecord || 'paragraphs' in blockRecord || 'bulletGroups' in blockRecord) return 'section-block';
  if (Array.isArray(blockRecord.items)) return 'part-nav';
  if (typeof blockRecord.imageId === 'string') return 'phone-frame';
  if ('coverImageId' in blockRecord || 'eyebrow' in blockRecord || 'subtitle' in blockRecord || explicitType === 'cover') return 'hero';
  if ('buttonText' in blockRecord || 'body' in blockRecord) return 'cta-card';
  if ('text' in blockRecord || 'quote' in blockRecord) return 'lead-quote';
  if ('summary' in blockRecord || 'caseLabel' in blockRecord || 'bullets' in blockRecord || 'highlight' in blockRecord || 'imageIds' in blockRecord) return 'case-block';
  if (typeof blockRecord.title === 'string') return 'section-block';
  return '';
}

function repairRawLayoutPayload(rawLayout = {}) {
  if (!isRecord(rawLayout)) return rawLayout;
  const layoutRecord = rawLayout;
  const blocks = Array.isArray(layoutRecord.blocks) ? layoutRecord.blocks : null;
  if (!blocks) return rawLayout;
  const resolvedRecord = toRecord(layoutRecord.resolved);
  const legacyColorPalette = normalizeResolvedColorPalette(
    layoutRecord.stylePack || layoutRecord.colorPalette || resolvedRecord.colorPalette,
    AI_LAYOUT_DEFAULT_COLOR_PALETTE
  );
  const legacyLayoutFamily = normalizeResolvedLayoutFamily(
    layoutRecord.layoutFamily || resolvedRecord.layoutFamily,
    'tutorial-cards'
  );
  const selection = normalizeLayoutSelection(layoutRecord.selection, {
    layoutFamily: legacyLayoutFamily,
    colorPalette: legacyColorPalette,
  });
  const resolved = normalizeResolvedSelection(resolvedRecord, {
    layoutFamily: selection.layoutFamily === AI_LAYOUT_SELECTION_AUTO ? legacyLayoutFamily : selection.layoutFamily,
    colorPalette: selection.colorPalette === AI_LAYOUT_SELECTION_AUTO ? legacyColorPalette : selection.colorPalette,
  });
  return {
    ...layoutRecord,
    selection,
    resolved,
    recommendedLayoutFamily: normalizeResolvedLayoutFamily(
      layoutRecord.recommendedLayoutFamily || resolvedRecord.layoutFamily || legacyLayoutFamily,
      resolved.layoutFamily
    ),
    recommendedColorPalette: normalizeResolvedColorPalette(
      layoutRecord.recommendedColorPalette || resolvedRecord.colorPalette || legacyColorPalette,
      resolved.colorPalette
    ),
    stylePack: resolved.colorPalette,
    layoutFamily: resolved.layoutFamily,
    blocks: toAiLayoutBlocks(blocks).map((block) => {
      const blockRecord = block;
      const inferredType = inferBlockType(blockRecord);
      if (!inferredType) return blockRecord;
      const repaired = {
        ...blockRecord,
        type: inferredType,
      };
      delete repaired.blockType;
      delete repaired.block_type;
      delete repaired.kind;
      delete repaired.component;
      return repaired;
    }),
  };
}

/**
 * @param {{ title?: unknown, markdown?: unknown, selection?: AiLayoutSelectionLike, stylePack?: string, imageRefs?: AiImageRefLike[] }} params
 * @returns {Array<{ role: string, content: string }>}
 */
function buildLayoutMessages({ title, markdown, selection, stylePack, imageRefs = [] }) {
  const safeImageRefs = toAiImageRefs(imageRefs);
  const resolvedSelection = resolveLayoutSelection({
    requestedSelection: selection || { colorPalette: stylePack },
    rawLayout: { title },
    signals: extractMarkdownSignals(markdown),
    imageRefs: safeImageRefs,
  });
  const selectedLayoutFamily = selection?.layoutFamily || AI_LAYOUT_SELECTION_AUTO;
  const selectedColorPalette = selection?.colorPalette || AI_LAYOUT_SELECTION_AUTO;
  const selectedLayoutFamilyInfo = selectedLayoutFamily === AI_LAYOUT_SELECTION_AUTO
    ? { label: '自动推荐', description: '由 AI 根据文章内容推荐布局风格。' }
    : getLayoutFamilyById(selectedLayoutFamily);
  const selectedColorPaletteInfo = selectedColorPalette === AI_LAYOUT_SELECTION_AUTO
    ? { label: '自动推荐', description: '由 AI 根据文章内容推荐颜色。' }
    : getColorPaletteById(selectedColorPalette);
  const selectedSkill = selectedLayoutFamily === AI_LAYOUT_SELECTION_AUTO
    ? null
    : getLayoutSkillById(selectedLayoutFamily);
  const recommendedSkill = getLayoutSkillById(resolvedSelection.recommendedLayoutFamily);
  const signals = extractMarkdownSignals(markdown);
  const promptMarkdown = truncateMarkdownForPrompt(markdown);
  const imageSummary = safeImageRefs.length
    ? safeImageRefs.map((image) => {
      const imageRecord = toRecord(image);
      return `- ${coerceString(imageRecord.id)}: ${coerceString(imageRecord.caption || imageRecord.alt)}`;
    }).join('\n')
    : '- 无可用图片';
  const sectionSummary = signals.sectionTitles.length
    ? signals.sectionTitles.map((item, index) => `- ${index}: ${item}`).join('\n')
    : '- 无明显章节结构';
  const headingSummary = signals.sectionTitles.length
    ? signals.sectionTitles.map((item, index) => `${index + 1}. ${item}`).join('\n')
    : '- 无明显标题结构';
  const leadSummary = signals.leadParagraphs.length
    ? signals.leadParagraphs.map((item, index) => `${index + 1}. ${summarizeText(item, 90)}`).join('\n')
    : '- 无可提取导语';
  const bulletSummary = signals.bulletGroups.length
    ? signals.bulletGroups.slice(0, 2).map((group, groupIndex) => `组 ${groupIndex + 1}: ${group.slice(0, 4).join(' / ')}`).join('\n')
    : '- 无明显列表信息';
  const skillSummary = AI_LAYOUT_SKILL_LIST.map((skill) => {
    const manifest = /** @type {AiLayoutSkillManifest} */ (skill.manifest || {});
    return `- ${manifest.id}: ${manifest.label}（${manifest.description || '无描述'}）`;
  }).join('\n');
  const safeStyleNotes = Array.isArray(AI_WECHAT_SAFE_STYLE_PRIMITIVES.allowedCssNotes)
    ? AI_WECHAT_SAFE_STYLE_PRIMITIVES.allowedCssNotes.map((item) => `- ${coerceString(item)}`).join('\n')
    : '- 仅允许 inline style';
  const selectedSkillPrompt = selectedSkill?.prompt
    ? selectedSkill.prompt
    : '当前 layoutFamily 为 auto，请在内置 skill 中做选择，并给出最合适的 recommendedLayoutFamily。';
  const recommendedSkillPrompt = recommendedSkill?.prompt
    ? recommendedSkill.prompt
    : '';

  return [
    {
      role: 'system',
      content: AI_LAYOUT_SKILL_SYSTEM_LINES.join('\n'),
    },
    {
      role: 'user',
      content: [
        `文章标题：${toText(title || '未命名文章')}`,
        `布局选择：${selectedLayoutFamilyInfo.label}`,
        `布局说明：${selectedLayoutFamilyInfo.description}`,
        `颜色选择：${selectedColorPaletteInfo.label}`,
        `颜色说明：${selectedColorPaletteInfo.description}`,
        `推荐布局：${getLayoutFamilyById(resolvedSelection.recommendedLayoutFamily).label}`,
        `推荐颜色：${getColorPaletteById(resolvedSelection.recommendedColorPalette).label}`,
        '',
        '内置布局 skills：',
        skillSummary,
        '',
        selectedSkill ? `当前 skill：${selectedSkill.manifest.label}（${selectedSkill.manifest.version}）` : '当前 skill：自动推荐',
        '当前 skill 目标：',
        selectedSkillPrompt,
        recommendedSkillPrompt ? ['', '当前推荐 skill 参考：', recommendedSkillPrompt, ''] .join('\n') : '',
        '微信安全样式约束：',
        safeStyleNotes,
        '',
        '可用图片：',
        imageSummary,
        '',
        '可用正文 section：',
        sectionSummary,
        '',
        '文章结构摘要：',
        '标题大纲：',
        headingSummary,
        '导语候选：',
        leadSummary,
        '列表信息：',
        bulletSummary,
        '',
        '请输出一个 JSON 对象，包含：',
        ...AI_LAYOUT_OUTPUT_FIELDS.map((field) => `- ${field}`),
        '',
        'selection 规则：',
        `- layoutFamily 只能是 ${AI_LAYOUT_SELECTION_AUTO} / ${AI_LAYOUT_FAMILIES.join(' / ')}`,
        `- colorPalette 只能是 ${AI_LAYOUT_SELECTION_AUTO} / ${AI_LAYOUT_COLOR_PALETTES.join(' / ')}`,
        '- 当 selection.colorPalette = auto 时，请只从内置非 custom 颜色中推荐；custom 只在用户明确选择自定义时使用。',
        `- 当前 selection.layoutFamily = ${selectedLayoutFamily}`,
        `- 当前 selection.colorPalette = ${selectedColorPalette}`,
        '如果 selection 为 auto，请你给出 recommended* 并写入 resolved；如果不是 auto，请尊重用户选择。',
        '',
        'block 约束：',
        ...getAiLayoutBlockConstraintLines(),
        '',
        '正文主体请优先使用 section-block，并通过 sectionIndex 引用原文章节。',
        'sectionIndex 从 0 开始，对应上面“可用正文 section”的编号。',
        '默认只把 H2 级标题当作 major section；H3/H4 更适合留在对应 section-block 内部，作为 subsection 或段内层级。',
        '优先覆盖全文主要章节，不要只处理前半篇，也不要遗漏后半部分内容。',
        '不要机械地把每个小标题都升级成独立 block；结构清晰比 block 数量更多更重要。',
        'CTA 和 phone-frame 都是可选块，不要默认强加。',
        '',
        '原文如下：',
        promptMarkdown,
      ].filter(Boolean).join('\n'),
    },
  ];
}

/**
 * @param {unknown} data
 * @returns {string}
 */
function readChatCompletionContent(data) {
  const source = toRecord(data);
  const choices = Array.isArray(source.choices) ? source.choices : [];
  const firstChoice = toRecord(choices[0]);
  const message = toRecord(firstChoice.message);
  if (!message) throw new Error('AI 响应缺少 message');
  const content = message.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        const part = toRecord(item);
        return typeof part.text === 'string' ? part.text : '';
      })
      .join('')
      .trim();
  }
  throw new Error('AI 响应格式无法识别');
}

/**
 * @param {unknown} data
 * @returns {string}
 */
function readGeminiContent(data) {
  const source = toRecord(data);
  const candidates = Array.isArray(source.candidates) ? source.candidates : [];
  const candidate = toRecord(candidates[0]);
  const content = toRecord(candidate.content);
  const parts = Array.isArray(content.parts) ? content.parts : [];
  const text = parts
    .map((item) => {
      const part = toRecord(item);
      return typeof part.text === 'string' ? part.text : '';
    })
    .join('')
    .trim();
  if (text) return text;
  throw new Error('Gemini 响应缺少可解析文本');
}

/**
 * @param {unknown} data
 * @returns {string}
 */
function readAnthropicContent(data) {
  const source = toRecord(data);
  if (source.stop_reason === 'max_tokens') {
    throw new Error('Anthropic 响应达到 max_tokens 输出上限，排版 JSON 可能被截断。请缩短文章或减少图片后重试。');
  }
  const content = Array.isArray(source.content) ? source.content : [];
  const text = content
    .map((item) => {
      const part = toRecord(item);
      return part.type === 'text' && typeof part.text === 'string' ? part.text : '';
    })
    .join('')
    .trim();
  if (text) return text;
  throw new Error('Anthropic 响应缺少可解析文本');
}

/**
 * @param {Array<{ role?: string, content?: string }>} messages
 * @returns {string}
 */
function toPlainPromptFromMessages(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .map((message) => {
      const record = toRecord(message);
      const roleLabel = record.role === 'system' ? '系统要求' : '用户请求';
      return `${roleLabel}：\n${toText(record.content).trim()}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

/** @param {unknown} error */
function isAbortError(error) {
  return toRecord(error).name === 'AbortError';
}

/**
 * @param {string} jsonPayload
 * @returns {Record<string, unknown>}
 */
function parseAndRepairLayoutPayload(jsonPayload) {
  const parsedPayload = /** @type {unknown} */ (JSON.parse(jsonPayload));
  return /** @type {Record<string, unknown>} */ (repairRawLayoutPayload(parsedPayload));
}

/**
 * @param {AiLayoutRequestOptions} options
 * @returns {Promise<{ rawLayout: Record<string, unknown>, usage: AiUsageLike }>}
 */
async function requestOpenAICompatibleLayout({
  provider,
  title,
  markdown,
  selection,
  stylePack,
  imageRefs,
  timeoutMs,
  abortTimeoutMs,
  fetchImpl,
}) {
  const controller = new AbortController();
  const timer = setAiLayoutTimeout(() => controller.abort(), abortTimeoutMs || timeoutMs);

  try {
    const response = await fetchImpl(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.2,
        messages: buildLayoutMessages({ title, markdown, selection, stylePack, imageRefs }),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI 请求失败 (${response.status}): ${text || response.statusText}`);
    }

    const data = await response.json();
    const usage = readProviderUsage(AI_PROVIDER_KINDS.OPENAI_COMPATIBLE, data);
    const content = readChatCompletionContent(data);
    const jsonPayload = extractJsonPayload(content);
    try {
      return { rawLayout: parseAndRepairLayoutPayload(jsonPayload), usage };
    } catch (error) {
      const sanitizedPayload = sanitizeJsonStringLiteralControls(jsonPayload);
      if (sanitizedPayload !== jsonPayload) {
        return { rawLayout: parseAndRepairLayoutPayload(sanitizedPayload), usage };
      }
      throw error;
    }
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) {
      throw new AiLayoutTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    clearAiLayoutTimeout(timer);
  }
}

/**
 * @param {AiLayoutRequestOptions} options
 * @returns {Promise<{ rawLayout: Record<string, unknown>, usage: AiUsageLike }>}
 */
async function requestGeminiLayout({
  provider,
  title,
  markdown,
  selection,
  stylePack,
  imageRefs,
  timeoutMs,
  abortTimeoutMs,
  fetchImpl,
}) {
  const controller = new AbortController();
  const timer = setAiLayoutTimeout(() => controller.abort(), abortTimeoutMs || timeoutMs);

  try {
    const messages = buildLayoutMessages({ title, markdown, selection, stylePack, imageRefs });
    const systemInstruction = String(messages[0]?.content || '').trim();
    const userPrompt = String(messages[1]?.content || '').trim() || toPlainPromptFromMessages(messages);
    const endpoint = `${provider.baseUrl}/models/${encodeURIComponent(provider.model)}:generateContent`;
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': provider.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: systemInstruction
          ? {
            role: 'system',
            parts: [{ text: systemInstruction }],
          }
          : undefined,
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI 请求失败 (${response.status}): ${text || response.statusText}`);
    }

    const data = await response.json();
    const usage = readProviderUsage(AI_PROVIDER_KINDS.GEMINI, data);
    const content = readGeminiContent(data);
    const jsonPayload = extractJsonPayload(content);
    try {
      return { rawLayout: parseAndRepairLayoutPayload(jsonPayload), usage };
    } catch (error) {
      const sanitizedPayload = sanitizeJsonStringLiteralControls(jsonPayload);
      if (sanitizedPayload !== jsonPayload) {
        return { rawLayout: parseAndRepairLayoutPayload(sanitizedPayload), usage };
      }
      throw error;
    }
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) {
      throw new AiLayoutTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    clearAiLayoutTimeout(timer);
  }
}

/**
 * @param {AiLayoutRequestOptions} options
 * @returns {Promise<{ rawLayout: Record<string, unknown>, usage: AiUsageLike }>}
 */
async function requestAnthropicLayout({
  provider,
  title,
  markdown,
  selection,
  stylePack,
  imageRefs,
  timeoutMs,
  abortTimeoutMs,
  fetchImpl,
}) {
  const controller = new AbortController();
  const timer = setAiLayoutTimeout(() => controller.abort(), abortTimeoutMs || timeoutMs);

  try {
    const messages = buildLayoutMessages({ title, markdown, selection, stylePack, imageRefs });
    const systemInstruction = String(messages[0]?.content || '').trim();
    const userPrompt = String(messages[1]?.content || '').trim() || toPlainPromptFromMessages(messages);
    const response = await fetchImpl(`${provider.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: ANTHROPIC_LAYOUT_MAX_TOKENS,
        temperature: 0.2,
        system: systemInstruction,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI 请求失败 (${response.status}): ${text || response.statusText}`);
    }

    const data = await response.json();
    const usage = readProviderUsage(AI_PROVIDER_KINDS.ANTHROPIC, data);
    const content = readAnthropicContent(data);
    const jsonPayload = extractJsonPayload(content);
    try {
      return { rawLayout: parseAndRepairLayoutPayload(jsonPayload), usage };
    } catch (error) {
      const sanitizedPayload = sanitizeJsonStringLiteralControls(jsonPayload);
      if (sanitizedPayload !== jsonPayload) {
        return { rawLayout: parseAndRepairLayoutPayload(sanitizedPayload), usage };
      }
      throw error;
    }
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) {
      throw new AiLayoutTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    clearAiLayoutTimeout(timer);
  }
}

export {
  getDefaultFetch,
  AiLayoutTimeoutError,
  requestOpenAICompatibleLayout,
  requestGeminiLayout,
  requestAnthropicLayout,
};
