// AI 编排：选择解析 / 归一化 / 缓存条目 / settings / Markdown 结构提取 / 兜底与结果构建
import {
  AI_LAYOUT_SELECTION_AUTO,
  getAiLayoutSkillById,
  validateAiLayoutPayload,
} from '../ai-layout-skill-bundle.js';
import {
  createHtmlContainer,
  getActiveDocument,
} from '../dom-utils.js';
import { toText } from '../input-utils.js';
import {
  AI_LAYOUT_SCHEMA_VERSION,
  AI_PROVIDER_KINDS,
  MAX_LAYOUT_BLOCKS,
  MAX_PART_NAV_ITEMS,
  MAX_CASE_BLOCK_BULLETS,
  MAX_CASE_BLOCK_IMAGE_IDS,
  DEFAULT_AI_REQUEST_TIMEOUT_MS,
  AI_LAYOUT_DEFAULT_FAMILY,
  AI_LAYOUT_DEFAULT_COLOR_PALETTE,
  AI_LAYOUT_IMPLEMENTED_FAMILIES,
  AI_LAYOUT_RESERVED_FAMILY_FALLBACKS,
  AI_LAYOUT_FAMILY_DEFS,
  AI_COLOR_PALETTES,
  AI_WECHAT_SAFE_STYLE_PRIMITIVES,
  AI_PROVIDER_KIND_DEFAULTS,
  AI_USAGE_EMPTY,
  toTokenCount,
  normalizeAiUsage,
  isRecord,
  toSelectionRecord,
  toRecord,
  toAiLayoutBlocks,
  toAiImageRefs,
  clampNumber,
  normalizeHexColor,
  coerceString,
  normalizeTitleKey,
  summarizeText,
} from './shared.js';

/** @typedef {import('./shared.js').AiLayoutColorPalette} AiLayoutColorPalette */
/** @typedef {import('./shared.js').AiLayoutSkill} AiLayoutSkill */
/** @typedef {import('./shared.js').AiLayoutSelectionLike} AiLayoutSelectionLike */
/** @typedef {import('./shared.js').AiLayoutResolvedSelectionLike} AiLayoutResolvedSelectionLike */
/** @typedef {import('./shared.js').AiProviderLike} AiProviderLike */
/** @typedef {import('./shared.js').AiColorPaletteOverride} AiColorPaletteOverride */
/** @typedef {import('./shared.js').AiLayoutSchemaValidationLike} AiLayoutSchemaValidationLike */
/** @typedef {import('./shared.js').AiLayoutBlockOriginLike} AiLayoutBlockOriginLike */
/** @typedef {import('./shared.js').AiUsageLike} AiUsageLike */
/** @typedef {import('./shared.js').AiUsageTotalsLike} AiUsageTotalsLike */
/** @typedef {import('./shared.js').AiLayoutGenerationMetaLike} AiLayoutGenerationMetaLike */
/** @typedef {import('./shared.js').AiLayoutStateLike} AiLayoutStateLike */
/** @typedef {import('./shared.js').AiLayoutBlockLike} AiLayoutBlockLike */
/** @typedef {import('./shared.js').AiLayoutSubsectionLike} AiLayoutSubsectionLike */
/** @typedef {import('./shared.js').AiLayoutSourceSectionLike} AiLayoutSourceSectionLike */
/** @typedef {import('./shared.js').MarkdownSignals} MarkdownSignals */
/** @typedef {import('./shared.js').MarkdownHeading} MarkdownHeading */
/** @typedef {import('./shared.js').MarkdownCallout} MarkdownCallout */
/** @typedef {import('./shared.js').MarkdownSubsection} MarkdownSubsection */
/** @typedef {import('./shared.js').MarkdownSection} MarkdownSection */
/** @typedef {import('./shared.js').MarkdownStructure} MarkdownStructure */
/** @typedef {import('./shared.js').AiImageRefLike} AiImageRefLike */
/** @typedef {import('./shared.js').AiLayoutJsonLike} AiLayoutJsonLike */
/** @typedef {import('./shared.js').AiLayoutCacheEntryLike} AiLayoutCacheEntryLike */
/**
 * @typedef {{ enabled: boolean, defaultProviderId: string, layoutModel?: string, defaultLayoutFamily: string, defaultColorPalette: string, defaultStylePack?: string, customColor: string, includeImagesInLayout: boolean, requestTimeoutMs: number, providers: ReturnType<typeof normalizeAiProvider>[], articleLayoutsByPath: Record<string, AiLayoutCacheEntryLike>, usageTotals?: AiUsageTotalsLike, usagePricePerMillion?: { input: number, output: number } }} AiSettingsLike
 */

/**
 * @param {unknown} [raw={}]
 * @returns {AiUsageTotalsLike}
 */
function normalizeAiUsageTotals(raw = {}) {
  const source = toRecord(raw);
  const usage = normalizeAiUsage(source);
  return {
    requests: toTokenCount(source.requests),
    ...usage,
    updatedAt: clampNumber(source.updatedAt, 0, 0, 9999999999999),
  };
}

/**
 * 累加一次编排的用量（纯函数，返回新对象）。
 * @param {AiUsageTotalsLike | null | undefined} totals
 * @param {AiUsageLike | null | undefined} usage
 * @param {number} [now=Date.now()]
 * @returns {AiUsageTotalsLike}
 */
function addAiUsageToTotals(totals, usage, now = Date.now()) {
  const base = normalizeAiUsageTotals(totals);
  const delta = normalizeAiUsage(usage);
  return {
    requests: base.requests + 1,
    promptTokens: base.promptTokens + delta.promptTokens,
    completionTokens: base.completionTokens + delta.completionTokens,
    totalTokens: base.totalTokens + delta.totalTokens,
    updatedAt: now,
  };
}

/**
 * 按「元 / 百万 tokens」估算费用；单价未填（0）返回 null。
 * @param {AiUsageLike | AiUsageTotalsLike | null | undefined} usage
 * @param {{ input?: number, output?: number } | null | undefined} pricePerMillion
 * @returns {number | null}
 */
function estimateAiUsageCost(usage, pricePerMillion) {
  const u = normalizeAiUsage(usage);
  const price = toRecord(pricePerMillion);
  const input = Number(price.input);
  const output = Number(price.output);
  if (!(input > 0) && !(output > 0)) return null;
  const cost = (u.promptTokens * (input > 0 ? input : 0) + u.completionTokens * (output > 0 ? output : 0)) / 1_000_000;
  return Math.round(cost * 10000) / 10000;
}

/**
 * 缓存的排版是否由旧版技能生成（技能随插件版本更新后，旧缓存建议重新生成）。
 * @param {AiLayoutStateLike | null | undefined} state
 * @returns {boolean}
 */
function isLayoutStateSkillOutdated(state) {
  const source = toRecord(state);
  const family = getArticleLayoutFamilyCacheKey(/** @type {AiLayoutStateLike} */ (source));
  const current = getLayoutFamilyById(family)?.version || '';
  const recorded = coerceString(source.skillVersion || toRecord(source.generationMeta).skillVersion);
  return Boolean(current && recorded && recorded !== current);
}

/**
 * @returns {AiSettingsLike}
 */
function createDefaultAiSettings() {
  return {
    enabled: true,
    defaultProviderId: '',
    // AI 编排使用的模型质量（覆盖 provider.model；当前 DeepSeek：v4 pro / v4 flash(lite)）
    layoutModel: 'deepseek-v4-pro',
    defaultLayoutFamily: AI_LAYOUT_SELECTION_AUTO,
    defaultColorPalette: AI_LAYOUT_SELECTION_AUTO,
    customColor: '#7c3aed',
    includeImagesInLayout: true,
    requestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
    providers: [],
    articleLayoutsByPath: {},
    // 3.12.0：本机累计用量与单价（元 / 百万 tokens，0 = 只显示 token 数不估算费用）
    usageTotals: normalizeAiUsageTotals({}),
    usagePricePerMillion: { input: 0, output: 0 },
  };
}

/**
 * @param {unknown} hex
 * @returns {{ r: number, g: number, b: number }}
 */
function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex).slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

/**
 * @param {{ r: number, g: number, b: number }} rgb
 * @returns {string}
 */
function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((channel) => {
    const clamped = Math.max(0, Math.min(255, Math.round(channel)));
    return clamped.toString(16).padStart(2, '0');
  }).join('')}`;
}

/**
 * @param {unknown} color
 * @param {unknown} target
 * @param {number} amount
 * @returns {string}
 */
function mixHexColor(color, target, amount) {
  const sourceRgb = hexToRgb(color);
  const targetRgb = hexToRgb(target);
  return rgbToHex({
    r: sourceRgb.r + (targetRgb.r - sourceRgb.r) * amount,
    g: sourceRgb.g + (targetRgb.g - sourceRgb.g) * amount,
    b: sourceRgb.b + (targetRgb.b - sourceRgb.b) * amount,
  });
}

/**
 * @param {unknown} accentColor
 * @param {{ id?: string, label?: string }} [options={}]
 * @returns {AiLayoutColorPalette}
 */
function createColorPaletteFromAccent(accentColor, { id = 'custom', label = '自定义' } = {}) {
  const accent = normalizeHexColor(accentColor);
  return {
    id,
    label,
    description: 'AI 编排独立自定义色，会根据你选择的颜色自动派生深色、浅底和边框。',
    recommendedFor: ['custom'],
    tokens: {
      accent,
      accentDeep: mixHexColor(accent, '#000000', 0.28),
      accentSoft: mixHexColor(accent, '#ffffff', 0.9),
      text: mixHexColor(accent, '#1f2937', 0.78),
      muted: mixHexColor(accent, '#6b7280', 0.72),
      border: mixHexColor(accent, '#ffffff', 0.78),
      surface: '#ffffff',
      surfaceSoft: mixHexColor(accent, '#ffffff', 0.96),
      quoteBg: mixHexColor(accent, '#ffffff', 0.93),
    },
  };
}

/**
 * @param {string | null | undefined} value
 * @param {string} [fallback=AI_LAYOUT_SELECTION_AUTO]
 * @returns {string}
 */
function normalizeLayoutFamily(value, fallback = AI_LAYOUT_SELECTION_AUTO) {
  const normalized = coerceString(value);
  if (normalized === AI_LAYOUT_SELECTION_AUTO) return AI_LAYOUT_SELECTION_AUTO;
  return AI_LAYOUT_FAMILY_DEFS[normalized] ? normalized : fallback;
}

/**
 * @param {string | null | undefined} value
 * @param {string} [fallback=AI_LAYOUT_SELECTION_AUTO]
 * @returns {string}
 */
function normalizeColorPalette(value, fallback = AI_LAYOUT_SELECTION_AUTO) {
  const normalized = coerceString(value);
  if (normalized === AI_LAYOUT_SELECTION_AUTO) return AI_LAYOUT_SELECTION_AUTO;
  return AI_COLOR_PALETTES[normalized] ? normalized : fallback;
}

/**
 * @param {string | null | undefined} value
 * @param {string} [fallback=AI_LAYOUT_DEFAULT_FAMILY]
 * @returns {string}
 */
function normalizeResolvedLayoutFamily(value, fallback = AI_LAYOUT_DEFAULT_FAMILY) {
  const normalized = coerceString(value);
  if (!normalized) return fallback;
  if (AI_LAYOUT_IMPLEMENTED_FAMILIES.has(normalized)) return normalized;
  if (AI_LAYOUT_RESERVED_FAMILY_FALLBACKS[normalized]) {
    return AI_LAYOUT_RESERVED_FAMILY_FALLBACKS[normalized];
  }
  return AI_LAYOUT_IMPLEMENTED_FAMILIES.has(fallback) ? fallback : AI_LAYOUT_DEFAULT_FAMILY;
}

/**
 * @param {string | null | undefined} value
 * @param {string} [fallback=AI_LAYOUT_DEFAULT_COLOR_PALETTE]
 * @returns {string}
 */
function normalizeResolvedColorPalette(value, fallback = AI_LAYOUT_DEFAULT_COLOR_PALETTE) {
  const normalized = coerceString(value);
  if (AI_COLOR_PALETTES[normalized]) return normalized;
  return AI_COLOR_PALETTES[fallback] ? fallback : AI_LAYOUT_DEFAULT_COLOR_PALETTE;
}

/**
 * @param {string | null | undefined} value
 * @param {string} [fallback=AI_LAYOUT_DEFAULT_COLOR_PALETTE]
 * @returns {string}
 */
function normalizeAutoRecommendedColorPalette(value, fallback = AI_LAYOUT_DEFAULT_COLOR_PALETTE) {
  const normalized = normalizeResolvedColorPalette(value, fallback);
  if (normalized === 'custom') {
    const fallbackPalette = normalizeResolvedColorPalette(fallback, AI_LAYOUT_DEFAULT_COLOR_PALETTE);
    return fallbackPalette === 'custom' ? AI_LAYOUT_DEFAULT_COLOR_PALETTE : fallbackPalette;
  }
  return normalized;
}

/**
 * @param {AiLayoutSelectionLike | string | null | undefined} [raw={}]
 * @param {AiLayoutSelectionLike | string | null | undefined} [fallback={}]
 * @returns {{ layoutFamily: string, colorPalette: string }}
 */
function normalizeLayoutSelection(raw = {}, fallback = {}) {
  const candidate = (typeof raw === 'string')
    ? (AI_COLOR_PALETTES[raw]
      ? { colorPalette: raw }
      : (AI_LAYOUT_FAMILY_DEFS[raw] ? { layoutFamily: raw } : {}))
    : toSelectionRecord(raw);
  const fallbackRecord = toSelectionRecord(fallback);
  return {
    layoutFamily: normalizeLayoutFamily(
      candidate.layoutFamily ?? candidate.layout ?? candidate.family ?? fallbackRecord.layoutFamily,
      normalizeLayoutFamily(fallbackRecord.layoutFamily, AI_LAYOUT_SELECTION_AUTO)
    ),
    colorPalette: normalizeColorPalette(
      candidate.colorPalette ?? candidate.palette ?? candidate.stylePack ?? fallbackRecord.colorPalette,
      normalizeColorPalette(fallbackRecord.colorPalette, AI_LAYOUT_SELECTION_AUTO)
    ),
  };
}

/**
 * @param {AiLayoutResolvedSelectionLike | AiLayoutSelectionLike | string | null | undefined} [raw={}]
 * @param {AiLayoutResolvedSelectionLike | AiLayoutSelectionLike | string | null | undefined} [fallback={}]
 * @returns {{ layoutFamily: string, colorPalette: string }}
 */
function normalizeResolvedSelection(raw = {}, fallback = {}) {
  const candidate = (typeof raw === 'string')
    ? (AI_COLOR_PALETTES[raw]
      ? { colorPalette: raw }
      : (AI_LAYOUT_FAMILY_DEFS[raw] ? { layoutFamily: raw } : {}))
    : toSelectionRecord(raw);
  const fallbackRecord = toSelectionRecord(fallback);
  return {
    layoutFamily: normalizeResolvedLayoutFamily(
      candidate.layoutFamily ?? candidate.layout ?? candidate.family ?? fallbackRecord.layoutFamily,
      normalizeResolvedLayoutFamily(fallbackRecord.layoutFamily, AI_LAYOUT_DEFAULT_FAMILY)
    ),
    colorPalette: normalizeResolvedColorPalette(
      candidate.colorPalette ?? candidate.palette ?? candidate.stylePack ?? fallbackRecord.colorPalette,
      normalizeResolvedColorPalette(fallbackRecord.colorPalette, AI_LAYOUT_DEFAULT_COLOR_PALETTE)
    ),
  };
}

/**
 * @param {AiLayoutSelectionLike | string | null | undefined} [selection={}]
 * @returns {string}
 */
function getArticleLayoutSelectionKey(selection = {}) {
  const normalized = normalizeLayoutSelection(selection);
  return `${normalized.layoutFamily || AI_LAYOUT_SELECTION_AUTO}::${normalized.colorPalette || AI_LAYOUT_SELECTION_AUTO}`;
}

/**
 * @param {{ includeAuto?: boolean, includeReserved?: boolean }} [options={}]
 * @returns {{ value: string, label: string, description?: string }[]}
 */
function getLayoutFamilyList({ includeAuto = true, includeReserved = false } = {}) {
  const list = [];
  if (includeAuto) {
    list.push({
      value: AI_LAYOUT_SELECTION_AUTO,
      label: '自动推荐',
      description: '由 AI 根据文章内容自动推荐布局。',
    });
  }
  Object.values(AI_LAYOUT_FAMILY_DEFS).forEach((family) => {
    if (!includeReserved && !AI_LAYOUT_IMPLEMENTED_FAMILIES.has(family.id)) return;
    list.push({
      value: family.id,
      label: family.label,
      description: family.description,
    });
  });
  return list;
}

/**
 * @param {string | null | undefined} id
 * @returns {AiLayoutSkill}
 */
function getLayoutFamilyById(id) {
  const normalizedId = normalizeResolvedLayoutFamily(id, AI_LAYOUT_DEFAULT_FAMILY);
  return AI_LAYOUT_FAMILY_DEFS[normalizedId] || AI_LAYOUT_FAMILY_DEFS[AI_LAYOUT_DEFAULT_FAMILY];
}

/**
 * @param {string | null | undefined} id
 * @returns {AiLayoutSkill}
 */
function getLayoutSkillById(id) {
  const normalizedId = normalizeResolvedLayoutFamily(id, AI_LAYOUT_DEFAULT_FAMILY);
  return getAiLayoutSkillById(normalizedId) || getAiLayoutSkillById(AI_LAYOUT_DEFAULT_FAMILY);
}

/**
 * @param {string | null | undefined} layoutFamilyId
 * @returns {Record<string, unknown>}
 */
function getWechatSafeRenderProfile(layoutFamilyId) {
  const normalizedId = normalizeResolvedLayoutFamily(layoutFamilyId, AI_LAYOUT_DEFAULT_FAMILY);
  const profiles = AI_WECHAT_SAFE_STYLE_PRIMITIVES.profiles || {};
  return toRecord(profiles[normalizedId] || profiles[AI_LAYOUT_DEFAULT_FAMILY] || {});
}

/**
 * @param {{ includeAuto?: boolean }} [options={}]
 * @returns {{ value: string, label: string, description?: string }[]}
 */
function getColorPaletteList({ includeAuto = true } = {}) {
  const list = [];
  if (includeAuto) {
    list.push({
      value: AI_LAYOUT_SELECTION_AUTO,
      label: '自动推荐',
      description: '由 AI 根据文章内容自动推荐颜色。',
    });
  }
  Object.values(AI_COLOR_PALETTES).forEach((pack) => {
    list.push({
      value: pack.id,
      label: pack.label,
      description: pack.description,
    });
  });
  return list;
}

/**
 * @param {string | null | undefined} id
 * @returns {AiLayoutColorPalette}
 */
function getColorPaletteById(id) {
  return AI_COLOR_PALETTES[normalizeResolvedColorPalette(id)] || AI_COLOR_PALETTES[AI_LAYOUT_DEFAULT_COLOR_PALETTE];
}

/**
 * @param {string | null | undefined} id
 * @param {AiColorPaletteOverride} [override={}]
 * @returns {AiLayoutColorPalette}
 */
function resolveColorPaletteForRender(id, override = {}) {
  const normalizedId = normalizeResolvedColorPalette(id);
  const customColor = normalizeHexColor(
    override?.customColor || override?.accentColor || override?.accent || '',
    ''
  );
  if (normalizedId === 'custom' && customColor) {
    return createColorPaletteFromAccent(customColor, {
      id: 'custom',
      label: getColorPaletteById('custom')?.label || '自定义',
    });
  }
  return getColorPaletteById(normalizedId);
}

/**
 * @param {{ requestedSelection?: AiLayoutSelectionLike | string, rawLayout?: AiLayoutStateLike | Record<string, unknown>, signals?: Record<string, unknown> | null, imageRefs?: unknown[] }} [options={}]
 * @returns {{ selection: { layoutFamily: string, colorPalette: string }, resolved: { layoutFamily: string, colorPalette: string }, recommendedLayoutFamily: string, recommendedColorPalette: string }}
 */
function resolveLayoutSelection({
  requestedSelection = {},
  rawLayout = {},
  signals = null,
  imageRefs = [],
} = {}) {
  const selection = normalizeLayoutSelection(requestedSelection);
  const rawLayoutRecord = toRecord(rawLayout);
  const rawResolved = toSelectionRecord(rawLayoutRecord.resolved);
  const inferredLayoutFamily = recommendLayoutFamily({ rawLayout, signals, imageRefs });
  const inferredColorPalette = recommendColorPalette({ rawLayout, signals });
  const recommendedLayoutFamily = normalizeResolvedLayoutFamily(
    rawLayoutRecord.recommendedLayoutFamily || rawResolved.layoutFamily || rawLayoutRecord.layoutFamily,
    inferredLayoutFamily
  );
  const recommendedColorPalette = normalizeAutoRecommendedColorPalette(
    rawLayoutRecord.recommendedColorPalette || rawResolved.colorPalette || rawLayoutRecord.stylePack,
    inferredColorPalette
  );
  const resolved = {
    layoutFamily: selection.layoutFamily === AI_LAYOUT_SELECTION_AUTO
      ? recommendedLayoutFamily
      : normalizeResolvedLayoutFamily(selection.layoutFamily, recommendedLayoutFamily),
    colorPalette: selection.colorPalette === AI_LAYOUT_SELECTION_AUTO
      ? recommendedColorPalette
      : normalizeResolvedColorPalette(selection.colorPalette, recommendedColorPalette),
  };

  return {
    selection,
    resolved,
    recommendedLayoutFamily,
    recommendedColorPalette,
  };
}

/**
 * @param {AiProviderLike} [raw={}]
 * @returns {{ id: string, name: string, kind: string, baseUrl: string, apiKey: string, model: string, enabled: boolean }}
 */
function normalizeAiProvider(raw = {}) {
  const source = toRecord(raw);
  const id = typeof source.id === 'string' && source.id.trim()
    ? source.id.trim()
    : `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const kind = typeof source.kind === 'string' && source.kind.trim()
    ? source.kind.trim()
    : AI_PROVIDER_KINDS.OPENAI_COMPATIBLE;
  const defaults = AI_PROVIDER_KIND_DEFAULTS[kind] || AI_PROVIDER_KIND_DEFAULTS[AI_PROVIDER_KINDS.OPENAI_COMPATIBLE];
  return {
    id,
    name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : '未命名 Provider',
    kind,
    baseUrl: typeof source.baseUrl === 'string' && source.baseUrl.trim()
      ? source.baseUrl.trim().replace(/\/+$/, '')
      : defaults.baseUrl,
    apiKey: typeof source.apiKey === 'string' ? source.apiKey : '',
    model: typeof source.model === 'string' && source.model.trim() ? source.model.trim() : defaults.model,
    enabled: source.enabled !== false,
  };
}

/** @param {unknown} baseUrl */
function isAllowedAiProviderBaseUrl(baseUrl) {
  try {
    const parsed = new URL(toText(baseUrl));
    if (parsed.protocol === 'https:') return true;
    if (parsed.protocol !== 'http:') return false;

    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
    if (/^10\./.test(hostname)) return true;
    if (/^192\.168\./.test(hostname)) return true;

    const private172 = hostname.match(/^172\.(\d+)\./);
    if (private172) {
      const secondOctet = Number(private172[1]);
      return secondOctet >= 16 && secondOctet <= 31;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * @param {AiProviderLike} [provider={}]
 * @returns {string[]}
 */
function getAiProviderIssues(provider = {}) {
  const source = toRecord(provider);
  const issues = [];
  const baseUrl = coerceString(source.baseUrl);
  const apiKey = coerceString(source.apiKey);
  const model = coerceString(source.model);

  if (!baseUrl) {
    issues.push('missing-base-url');
  } else if (!isAllowedAiProviderBaseUrl(baseUrl)) {
    issues.push('invalid-base-url');
  }

  if (!apiKey) issues.push('missing-api-key');
  if (!model) issues.push('missing-model');
  if (source.enabled === false) issues.push('disabled');

  return issues;
}

/**
 * @param {AiProviderLike} [provider={}]
 * @returns {boolean}
 */
function isAiProviderRunnable(provider = {}) {
  const issues = getAiProviderIssues(provider);
  return !issues.some((issue) => issue !== 'disabled');
}

/**
 * @param {AiProviderLike} [provider={}]
 * @returns {string}
 */
function summarizeAiProviderIssues(provider = {}) {
  const issues = getAiProviderIssues(provider);
  if (!issues.length) return '配置完整';

  /** @type {Record<string, string>} */
  const labels = {
    'missing-base-url': '缺少 Base URL',
    'invalid-base-url': 'Base URL 必须是 HTTPS，或指向本机/局域网的 HTTP 地址',
    'missing-api-key': '缺少 API Key',
    'missing-model': '缺少模型名',
    disabled: '已停用',
  };
  return issues.map((issue) => labels[issue] || issue).join(' / ');
}

function getLayoutBlockLabel(block = {}) {
  const source = toRecord(block);
  return coerceString(
    source.title
    || source.caseLabel
    || source.text
    || source.caption
    || source.buttonText
    || source.imageId
    || source.type
  );
}

function getLayoutBlockKey(block = {}) {
  const source = toRecord(block);
  return `${coerceString(source.type)}:${getLayoutBlockLabel(source)}`;
}

/**
 * @param {AiLayoutBlockOriginLike | null | undefined} [raw={}]
 * @param {number} [fallbackIndex=0]
 * @returns {{ index: number, type: string, source: 'ai' | 'fallback', label: string } | null}
 */
function normalizeGenerationBlockOrigin(raw = {}, fallbackIndex = 0) {
  const rawRecord = toRecord(raw);
  if (!Object.keys(rawRecord).length) return null;
  const source = rawRecord.source === 'fallback' ? 'fallback' : 'ai';
  const type = coerceString(rawRecord.type);
  if (!type) return null;
  return {
    index: clampNumber(rawRecord.index, fallbackIndex, 0, 99),
    type,
    source,
    label: coerceString(rawRecord.label || type),
  };
}

/**
 * @param {AiLayoutGenerationMetaLike | null | undefined} [raw={}]
 * @param {Record<string, unknown> | null} [layoutJson=null]
 * @returns {AiLayoutGenerationMetaLike}
 */
function normalizeLayoutGenerationMeta(raw = {}, layoutJson = null) {
  const source = toRecord(raw);
  const layoutJsonRecord = toRecord(layoutJson);
  const blocks = toAiLayoutBlocks(layoutJsonRecord.blocks);
  const rawBlockOrigins = Array.isArray(source.blockOrigins) ? /** @type {unknown[]} */ (source.blockOrigins) : [];
  const blockOrigins = rawBlockOrigins.length
    ? rawBlockOrigins
      .map((item, index) => normalizeGenerationBlockOrigin(item, index))
      .filter(Boolean)
    : [];
  const derivedFallbackCount = blockOrigins.filter((item) => item.source === 'fallback').length;
  const finalBlockCount = clampNumber(
    source.finalBlockCount,
    blocks.length || blockOrigins.length || 0,
    0,
    99
  );
  const fallbackBlockCount = clampNumber(
    source.fallbackBlockCount,
    derivedFallbackCount,
    0,
    finalBlockCount
  );

  return {
    providerName: coerceString(source.providerName),
    providerModel: coerceString(source.providerModel),
    skillId: coerceString(source.skillId),
    skillLabel: coerceString(source.skillLabel),
    skillVersion: coerceString(source.skillVersion),
    executionMode: coerceString(source.executionMode),
    layoutFamilyLabel: coerceString(source.layoutFamilyLabel),
    colorPaletteLabel: coerceString(source.colorPaletteLabel),
    stylePackLabel: coerceString(source.stylePackLabel),
    recommendedLayoutFamilyLabel: coerceString(source.recommendedLayoutFamilyLabel),
    recommendedColorPaletteLabel: coerceString(source.recommendedColorPaletteLabel),
    headingCount: clampNumber(source.headingCount, 0, 0, 999),
    sectionCount: clampNumber(source.sectionCount, 0, 0, 999),
    leadParagraphCount: clampNumber(source.leadParagraphCount, 0, 0, 999),
    bulletGroupCount: clampNumber(source.bulletGroupCount, 0, 0, 999),
    imageCount: clampNumber(source.imageCount, 0, 0, 999),
    aiBlockCount: clampNumber(source.aiBlockCount, Math.max(0, finalBlockCount - fallbackBlockCount), 0, 99),
    finalBlockCount,
    fallbackUsed: source.fallbackUsed === true || fallbackBlockCount > 0,
    fallbackBlockCount,
    fallbackBlockTypes: Array.isArray(source.fallbackBlockTypes)
      ? source.fallbackBlockTypes.map((item) => coerceString(item)).filter(Boolean).slice(0, 6)
      : [],
    schemaValidation: normalizeSchemaValidation(source.schemaValidation),
    usage: normalizeAiUsage(source.usage),
    blockOrigins,
  };
}

/**
 * @param {AiLayoutSchemaValidationLike | null | undefined} [raw={}]
 * @returns {AiLayoutSchemaValidationLike}
 */
function normalizeSchemaValidation(raw = {}) {
  const source = toRecord(raw);
  const issues = Array.isArray(source.issues)
    ? source.issues
      .map((item) => {
        const issue = toRecord(item);
        return {
          path: coerceString(issue.path),
          message: coerceString(issue.message),
          fatal: issue.fatal === true,
        };
      })
      .filter((item) => item.path || item.message)
      .slice(0, 12)
    : [];
  const issueCount = clampNumber(source.issueCount, issues.length, 0, 99);
  const fatal = source.fatal === true || issues.some((item) => item.fatal);
  return {
    isValid: source.isValid === true && issueCount === 0,
    fatal,
    issueCount,
    issues,
  };
}

class AiLayoutSchemaError extends Error {
  /**
   * @param {string} message
   * @param {unknown} schemaValidation
   * @param {AiLayoutGenerationMetaLike | null} [generationMeta=null]
   */
  constructor(message, schemaValidation, generationMeta = null) {
    super(message);
    this.name = 'AiLayoutSchemaError';
    this.code = 'ai-layout-schema-invalid';
    this.schemaValidation = normalizeSchemaValidation(schemaValidation);
    this.generationMeta = generationMeta;
  }
}

/**
 * @param {AiLayoutStateLike | null | undefined} [raw={}]
 * @returns {AiLayoutStateLike | null}
 */
function normalizeArticleLayoutState(raw = {}) {
  const source = toRecord(raw);
  if (!Object.keys(source).length) return null;
  const layoutJson = isRecord(source.layoutJson) ? source.layoutJson : null;
  if (!layoutJson) return null;
  const selection = normalizeLayoutSelection(
    source.selection || layoutJson.selection || {
      layoutFamily: source.layoutFamily || layoutJson.layoutFamily || 'tutorial-cards',
      colorPalette: source.colorPalette || source.stylePack || layoutJson.stylePack || AI_LAYOUT_DEFAULT_COLOR_PALETTE,
    },
    {
      layoutFamily: 'tutorial-cards',
      colorPalette: AI_LAYOUT_DEFAULT_COLOR_PALETTE,
    }
  );
  const resolved = normalizeResolvedSelection(
    source.resolved || layoutJson.resolved || {
      layoutFamily: source.resolvedLayoutFamily || source.layoutFamily || layoutJson.layoutFamily || 'tutorial-cards',
      colorPalette: source.resolvedColorPalette || source.colorPalette || source.stylePack || layoutJson.stylePack || AI_LAYOUT_DEFAULT_COLOR_PALETTE,
    },
    {
      layoutFamily: AI_LAYOUT_DEFAULT_FAMILY,
      colorPalette: AI_LAYOUT_DEFAULT_COLOR_PALETTE,
    }
  );
  const dismissedBlockKeys = Array.isArray(source.dismissedBlockKeys)
    ? source.dismissedBlockKeys.map((item) => coerceString(item)).filter(Boolean).slice(0, 128)
    : [];
  return {
    version: clampNumber(source.version, AI_LAYOUT_SCHEMA_VERSION, 1, 999),
    updatedAt: clampNumber(source.updatedAt, Date.now(), 0, 9999999999999),
    sourceHash: typeof source.sourceHash === 'string' ? source.sourceHash : '',
    providerId: typeof source.providerId === 'string' ? source.providerId : '',
    model: typeof source.model === 'string' ? source.model : '',
    skillId: coerceString(source.skillId || source.layoutFamily || resolved.layoutFamily),
    skillVersion: coerceString(source.skillVersion || toRecord(source.generationMeta).skillVersion || getLayoutFamilyById(resolved.layoutFamily)?.version),
    selection,
    resolved,
    recommendedLayoutFamily: normalizeResolvedLayoutFamily(
      source.recommendedLayoutFamily || layoutJson.recommendedLayoutFamily,
      resolved.layoutFamily
    ),
    recommendedColorPalette: normalizeResolvedColorPalette(
      source.recommendedColorPalette || layoutJson.recommendedColorPalette || source.stylePack || layoutJson.stylePack,
      resolved.colorPalette
    ),
    stylePack: resolved.colorPalette,
    layoutFamily: resolved.layoutFamily,
    status: source.status === 'schema-error' ? 'schema-error' : (source.status === 'error' ? 'error' : 'ready'),
    lastError: typeof source.lastError === 'string' ? source.lastError : '',
    lastAttemptStatus: source.lastAttemptStatus === 'schema-error'
      ? 'schema-error'
      : (source.lastAttemptStatus === 'error' ? 'error' : (source.lastAttemptStatus === 'success' ? 'success' : 'idle')),
    lastAttemptError: typeof source.lastAttemptError === 'string' ? source.lastAttemptError : '',
    lastAttemptAt: clampNumber(source.lastAttemptAt, 0, 0, 9999999999999),
    lastAttemptSchemaValidation: normalizeSchemaValidation(source.lastAttemptSchemaValidation),
    dismissedBlockKeys,
    generationMeta: normalizeLayoutGenerationMeta(source.generationMeta, layoutJson),
    layoutJson,
  };
}

/**
 * @param {AiLayoutStateLike | null | undefined} [state={}]
 * @param {string} [fallback=AI_LAYOUT_DEFAULT_FAMILY]
 * @returns {string}
 */
function getArticleLayoutFamilyCacheKey(state = {}, fallback = AI_LAYOUT_DEFAULT_FAMILY) {
  const layoutJson = toRecord(state?.layoutJson);
  const resolved = toRecord(state?.resolved);
  return normalizeResolvedLayoutFamily(
    resolved.layoutFamily
    || state?.layoutFamily
    || toRecord(layoutJson.resolved).layoutFamily
    || layoutJson.layoutFamily
    || fallback,
    AI_LAYOUT_DEFAULT_FAMILY
  );
}

/**
 * @param {AiLayoutStateLike | null} [currentState=null]
 * @param {AiLayoutStateLike | null} [nextState=null]
 * @returns {boolean}
 */
function shouldReplaceArticleLayoutFamilyState(currentState = null, nextState = null) {
  if (!currentState) return true;
  if (!nextState) return false;
  /** @param {AiLayoutStateLike} state */
  const scoreState = (state) => {
    const hasBlocks = Array.isArray(state?.layoutJson?.blocks) && state.layoutJson.blocks.length > 0;
    return [
      state?.status === 'ready' ? 4 : 0,
      hasBlocks ? 2 : 0,
      state?.lastAttemptStatus === 'success' ? 1 : 0,
    ].reduce((sum, value) => sum + value, 0);
  };
  const currentScore = scoreState(currentState);
  const nextScore = scoreState(nextState);
  if (nextScore !== currentScore) return nextScore > currentScore;
  return Number(nextState.updatedAt || 0) > Number(currentState.updatedAt || 0);
}

/**
 * @param {AiLayoutCacheEntryLike | AiLayoutStateLike | null | undefined} [raw={}]
 * @returns {AiLayoutCacheEntryLike | null}
 */
function normalizeArticleLayoutCacheEntry(raw = {}) {
  if (!isRecord(raw)) return null;

  /** @type {Record<string, AiLayoutStateLike>} */
  const familyStates = {};
  let lastFamilyFromInput = '';

  /**
   * @param {unknown} value
   * @param {AiLayoutSelectionLike} [fallbackSelection={}]
   * @param {{ markLast?: boolean, overwrite?: boolean }} [options={}]
   */
  const ingestState = (value, fallbackSelection = {}, options = {}) => {
    const normalizedState = normalizeArticleLayoutState(value);
    if (!normalizedState) return;
    const effectiveSelection = normalizeLayoutSelection(normalizedState.selection, fallbackSelection);
    const resolvedLayoutFamily = getArticleLayoutFamilyCacheKey(normalizedState, effectiveSelection.layoutFamily);
    const resolved = normalizeResolvedSelection(normalizedState.resolved, {
      layoutFamily: resolvedLayoutFamily,
      colorPalette: normalizedState.stylePack || effectiveSelection.colorPalette,
    });
    const stylePack = normalizeResolvedColorPalette(normalizedState.stylePack || resolved.colorPalette);
    const layoutJson = {
      ...toRecord(normalizedState.layoutJson),
      selection: {
        ...toRecord(toRecord(normalizedState.layoutJson).selection),
        ...effectiveSelection,
      },
      resolved: {
        ...toRecord(toRecord(normalizedState.layoutJson).resolved),
        layoutFamily: resolvedLayoutFamily,
        colorPalette: stylePack,
      },
      layoutFamily: resolvedLayoutFamily,
      stylePack,
    };
    const nextState = {
      ...normalizedState,
      selection: effectiveSelection,
      resolved: {
        ...resolved,
        layoutFamily: resolvedLayoutFamily,
        colorPalette: stylePack,
      },
      stylePack,
      layoutFamily: resolvedLayoutFamily,
      layoutJson,
    };
    if (options.markLast) lastFamilyFromInput = resolvedLayoutFamily;
    if (options.overwrite === false && familyStates[resolvedLayoutFamily]) return;
    if (shouldReplaceArticleLayoutFamilyState(familyStates[resolvedLayoutFamily], nextState)) {
      familyStates[resolvedLayoutFamily] = nextState;
    }
  };

  const legacyState = normalizeArticleLayoutState(raw);
  if (legacyState) {
    ingestState(legacyState, legacyState.selection, { markLast: true });
  }

  if (isRecord(raw.familyStates)) {
    for (const [layoutFamilyId, value] of Object.entries(toRecord(raw.familyStates))) {
      const valueState = normalizeArticleLayoutState(value);
      ingestState(value, {
        layoutFamily: layoutFamilyId || AI_LAYOUT_DEFAULT_FAMILY,
        colorPalette: valueState?.selection?.colorPalette || valueState?.stylePack || AI_LAYOUT_DEFAULT_COLOR_PALETTE,
      }, { markLast: layoutFamilyId === raw.lastLayoutFamily });
    }
  }

  if (isRecord(raw.selectionStates)) {
    for (const [selectionKey, value] of Object.entries(toRecord(raw.selectionStates))) {
      const [layoutFamilyFromKey, colorPaletteFromKey] = String(selectionKey || '').split('::');
      ingestState(value, {
        layoutFamily: layoutFamilyFromKey || 'tutorial-cards',
        colorPalette: colorPaletteFromKey || AI_LAYOUT_DEFAULT_COLOR_PALETTE,
      }, { markLast: selectionKey === raw.lastSelectionKey });
    }
  }

  if (isRecord(raw.stylePackStates)) {
    for (const [stylePackId, value] of Object.entries(toRecord(raw.stylePackStates))) {
      ingestState(value, {
        layoutFamily: 'tutorial-cards',
        colorPalette: stylePackId || AI_LAYOUT_DEFAULT_COLOR_PALETTE,
      }, { overwrite: false, markLast: stylePackId === raw.lastStylePack });
    }
  }

  const familyKeys = Object.keys(familyStates);
  if (!familyKeys.length) return null;
  const requestedLastLayoutFamily = coerceString(raw.lastLayoutFamily);
  const rawLastLayoutFamily = AI_LAYOUT_IMPLEMENTED_FAMILIES.has(requestedLastLayoutFamily)
    ? requestedLastLayoutFamily
    : '';
  const lastLayoutFamily = familyStates[rawLastLayoutFamily]
    ? rawLastLayoutFamily
    : (familyStates[lastFamilyFromInput] ? lastFamilyFromInput : familyKeys[0]);
  const requestedLastAutoResolvedFamily = coerceString(raw.lastAutoResolvedFamily);
  const rawLastAutoResolvedFamily = AI_LAYOUT_IMPLEMENTED_FAMILIES.has(requestedLastAutoResolvedFamily)
    ? requestedLastAutoResolvedFamily
    : '';
  const lastAutoResolvedFamily = familyStates[rawLastAutoResolvedFamily]
    ? rawLastAutoResolvedFamily
    : (familyStates[lastFamilyFromInput]?.selection?.layoutFamily === AI_LAYOUT_SELECTION_AUTO ? lastFamilyFromInput : '');
  /** @type {Record<string, AiLayoutStateLike>} */
  const selectionStates = {};
  /** @type {Record<string, AiLayoutStateLike>} */
  const stylePackStates = {};
  Object.entries(familyStates).forEach(([layoutFamilyId, state]) => {
    const selectionKey = getArticleLayoutSelectionKey({
      layoutFamily: layoutFamilyId,
      colorPalette: state.selection?.colorPalette || AI_LAYOUT_SELECTION_AUTO,
    });
    selectionStates[selectionKey] = state;
    const stylePack = normalizeResolvedColorPalette(state.stylePack || state.resolved?.colorPalette);
    if (!stylePackStates[stylePack]) stylePackStates[stylePack] = state;
  });
  const lastState = familyStates[lastLayoutFamily] || null;
  const lastSelectionKey = getArticleLayoutSelectionKey({
    layoutFamily: lastLayoutFamily,
    colorPalette: lastState?.selection?.colorPalette || AI_LAYOUT_SELECTION_AUTO,
  });
  return {
    lastLayoutFamily,
    lastAutoResolvedFamily,
    familyStates,
    lastSelectionKey,
    selectionStates,
    lastStylePack: lastState?.stylePack || AI_LAYOUT_DEFAULT_COLOR_PALETTE,
    stylePackStates,
  };
}

/**
 * @param {{ enabled?: boolean, defaultProviderId?: string, defaultLayoutFamily?: string, defaultColorPalette?: string, defaultStylePack?: string, customColor?: string, includeImagesInLayout?: boolean, requestTimeoutMs?: number, providers?: AiProviderLike[], articleLayoutsByPath?: Record<string, AiLayoutCacheEntryLike | AiLayoutStateLike> }} [raw={}]
 */
/**
 * @param {{ enabled?: boolean, defaultProviderId?: string, defaultLayoutFamily?: string, defaultColorPalette?: string, defaultStylePack?: string, customColor?: string, includeImagesInLayout?: boolean, requestTimeoutMs?: number, providers?: AiProviderLike[], articleLayoutsByPath?: Record<string, AiLayoutCacheEntryLike | AiLayoutStateLike> }} [raw={}]
 * @returns {AiSettingsLike}
 */
function normalizeAiSettings(raw = {}) {
  const source = toRecord(raw);
  const defaults = createDefaultAiSettings();
  const providers = Array.isArray(source.providers) ? source.providers.map(normalizeAiProvider) : defaults.providers;
  /** @type {Record<string, AiLayoutCacheEntryLike>} */
  const articleLayoutsByPath = {};
  if (isRecord(source.articleLayoutsByPath)) {
    for (const [path, value] of Object.entries(source.articleLayoutsByPath)) {
      if (!path || typeof path !== 'string') continue;
      const normalized = normalizeArticleLayoutCacheEntry(value);
      if (normalized) {
        articleLayoutsByPath[path] = normalized;
      }
    }
  }

  let defaultProviderId = typeof source.defaultProviderId === 'string' ? source.defaultProviderId : defaults.defaultProviderId;
  if (defaultProviderId && !providers.some((provider) => provider.id === defaultProviderId && provider.enabled !== false)) {
    defaultProviderId = '';
  }

  return {
    enabled: Object.prototype.hasOwnProperty.call(source, 'enabled')
      ? source.enabled === true
      : defaults.enabled,
    defaultProviderId,
    layoutModel: typeof source.layoutModel === 'string' && source.layoutModel.trim()
      ? source.layoutModel.trim()
      : defaults.layoutModel,
    defaultLayoutFamily: normalizeLayoutFamily(source.defaultLayoutFamily, AI_LAYOUT_SELECTION_AUTO),
    defaultColorPalette: normalizeColorPalette(
      source.defaultColorPalette ?? source.defaultStylePack,
      AI_LAYOUT_SELECTION_AUTO
    ),
    defaultStylePack: normalizeResolvedColorPalette(source.defaultStylePack, AI_LAYOUT_DEFAULT_COLOR_PALETTE),
    customColor: normalizeHexColor(source.customColor, defaults.customColor),
    includeImagesInLayout: source.includeImagesInLayout !== false,
    requestTimeoutMs: clampNumber(source.requestTimeoutMs, defaults.requestTimeoutMs, 5000, 180000),
    providers,
    articleLayoutsByPath,
    usageTotals: normalizeAiUsageTotals(source.usageTotals),
    usagePricePerMillion: {
      input: clampNumber(toRecord(source.usagePricePerMillion).input, 0, 0, 100000),
      output: clampNumber(toRecord(source.usagePricePerMillion).output, 0, 0, 100000),
    },
  };
}

/**
 * @param {AiLayoutCacheEntryLike | AiLayoutStateLike | null | undefined} entry
 * @param {AiLayoutSelectionLike | string | null | undefined} [selection={}]
 * @param {AiLayoutSelectionLike | string | null | undefined} [defaults={}]
 * @returns {AiLayoutStateLike | null}
 */
function getArticleLayoutSelectionState(entry, selection = {}, defaults = {}) {
  const normalizedEntry = normalizeArticleLayoutCacheEntry(entry);
  if (!normalizedEntry) return null;
  const normalizedSelection = normalizeLayoutSelection(selection, defaults);
  const requestedLayoutFamily = normalizeLayoutFamily(normalizedSelection.layoutFamily, AI_LAYOUT_SELECTION_AUTO);
  const familyStates = normalizedEntry.familyStates || {};
  const familyKeys = Object.keys(familyStates);
  if (!familyKeys.length) return null;

  if (requestedLayoutFamily !== AI_LAYOUT_SELECTION_AUTO) {
    const requestedResolvedLayoutFamily = normalizeResolvedLayoutFamily(requestedLayoutFamily, AI_LAYOUT_DEFAULT_FAMILY);
    return familyStates[requestedResolvedLayoutFamily] || null;
  }

  if (normalizedEntry.lastAutoResolvedFamily && familyStates[normalizedEntry.lastAutoResolvedFamily]) {
    return familyStates[normalizedEntry.lastAutoResolvedFamily];
  }
  if (normalizedEntry.lastLayoutFamily && familyStates[normalizedEntry.lastLayoutFamily]) {
    return familyStates[normalizedEntry.lastLayoutFamily];
  }
  return familyStates[familyKeys[0]] || null;
}

/**
 * @param {AiLayoutStateLike | null | undefined} state
 * @param {AiLayoutSelectionLike | string | null | undefined} [selection={}]
 * @param {AiLayoutSelectionLike | string | null | undefined} [defaults={}]
 * @returns {AiLayoutStateLike | null}
 */
function deriveArticleLayoutStateForSelection(state, selection = {}, defaults = {}) {
  const normalizedState = normalizeArticleLayoutState(state);
  if (!normalizedState?.layoutJson?.blocks?.length) return null;
  if (normalizedState.status !== 'ready') return null;

  const requestedSelection = normalizeLayoutSelection(selection, {
    layoutFamily: normalizedState.selection?.layoutFamily || toSelectionRecord(defaults).layoutFamily || AI_LAYOUT_SELECTION_AUTO,
    colorPalette: normalizedState.selection?.colorPalette || toSelectionRecord(defaults).colorPalette || AI_LAYOUT_SELECTION_AUTO,
  });
  const requestedColorPalette = normalizeColorPalette(
    requestedSelection.colorPalette,
    normalizedState.selection?.colorPalette || toSelectionRecord(defaults).colorPalette || AI_LAYOUT_SELECTION_AUTO
  );
  if (!requestedColorPalette || requestedColorPalette === AI_LAYOUT_SELECTION_AUTO) return null;

  const baseResolvedLayoutFamily = normalizeResolvedLayoutFamily(
    normalizedState.resolved?.layoutFamily || normalizedState.layoutFamily,
    AI_LAYOUT_DEFAULT_FAMILY
  );
  const baseSelectedLayoutFamily = normalizeLayoutFamily(
    normalizedState.selection?.layoutFamily,
    AI_LAYOUT_SELECTION_AUTO
  );
  const requestedLayoutFamily = normalizeLayoutFamily(
    requestedSelection.layoutFamily,
    normalizedState.selection?.layoutFamily || toSelectionRecord(defaults).layoutFamily || AI_LAYOUT_SELECTION_AUTO
  );
  const isCompatibleLayout = (
    requestedLayoutFamily === AI_LAYOUT_SELECTION_AUTO
    || requestedLayoutFamily === baseSelectedLayoutFamily
    || requestedLayoutFamily === baseResolvedLayoutFamily
  );
  if (!isCompatibleLayout) return null;

  const nextResolvedColorPalette = normalizeResolvedColorPalette(
    requestedColorPalette,
    normalizedState.resolved?.colorPalette || AI_LAYOUT_DEFAULT_COLOR_PALETTE
  );
  const nextColorPaletteLabel = getColorPaletteById(nextResolvedColorPalette)?.label || nextResolvedColorPalette;
  const nextSelection = {
    layoutFamily: requestedLayoutFamily || normalizedState.selection?.layoutFamily || AI_LAYOUT_SELECTION_AUTO,
    colorPalette: requestedColorPalette,
  };
  const nextLayoutJson = {
    ...toRecord(normalizedState.layoutJson),
    selection: {
      ...toRecord(toRecord(normalizedState.layoutJson).selection),
      ...nextSelection,
    },
    resolved: {
      ...toRecord(toRecord(normalizedState.layoutJson).resolved),
      layoutFamily: baseResolvedLayoutFamily,
      colorPalette: nextResolvedColorPalette,
    },
    recommendedLayoutFamily: normalizedState.recommendedLayoutFamily,
    recommendedColorPalette: normalizedState.recommendedColorPalette,
    stylePack: nextResolvedColorPalette,
    layoutFamily: baseResolvedLayoutFamily,
  };
  const nextGenerationMeta = normalizeLayoutGenerationMeta({
    ...(normalizedState.generationMeta || {}),
    colorPaletteLabel: nextColorPaletteLabel,
    stylePackLabel: nextColorPaletteLabel,
  }, nextLayoutJson);

  return normalizeArticleLayoutState({
    ...normalizedState,
    selection: nextSelection,
    resolved: {
      layoutFamily: baseResolvedLayoutFamily,
      colorPalette: nextResolvedColorPalette,
    },
    recommendedLayoutFamily: normalizedState.recommendedLayoutFamily,
    recommendedColorPalette: normalizedState.recommendedColorPalette,
    stylePack: nextResolvedColorPalette,
    layoutFamily: baseResolvedLayoutFamily,
    generationMeta: nextGenerationMeta,
    layoutJson: nextLayoutJson,
  });
}


/**
 * @param {AiSettingsLike | { providers?: AiProviderLike[] }} [aiSettings={}]
 * @returns {ReturnType<typeof normalizeAiProvider>[]}
 */
function listEnabledAiProviders(aiSettings = {}) {
  return Array.isArray(aiSettings.providers)
    ? aiSettings.providers.map(normalizeAiProvider).filter((provider) => provider.enabled !== false && isAiProviderRunnable(provider))
    : [];
}

/**
 * @param {AiSettingsLike | { providers?: AiProviderLike[], defaultProviderId?: string }} [aiSettings={}]
 * @param {string} [providerId='']
 * @returns {ReturnType<typeof normalizeAiProvider> | null}
 */
function resolveAiProvider(aiSettings = {}, providerId = '') {
  const providers = listEnabledAiProviders(aiSettings);
  if (providerId) {
    const matched = providers.find((provider) => provider.id === providerId);
    if (matched) return matched;
  }
  if (aiSettings.defaultProviderId) {
    const matched = providers.find((provider) => provider.id === aiSettings.defaultProviderId);
    if (matched) return matched;
  }
  return providers[0] || null;
}

/**
 * @param {unknown} value
 * @param {number} [fallback=-1]
 * @returns {number}
 */
function toSectionIndex(value, fallback = -1) {
  if (Number.isInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = parseInt(value.trim(), 10);
    return parsed >= 0 ? parsed : fallback;
  }
  return fallback;
}

/**
 * @param {unknown} value
 * @param {number} [limit=6]
 * @returns {string[]}
 */
function toTextArray(value, limit = 6) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => coerceString(item))
    .filter(Boolean)
    .slice(0, limit);
}

/**
 * @param {unknown} value
 * @param {Set<string>} imageIds
 * @param {number} [limit=4]
 * @returns {string[]}
 */
function toImageIdArray(value, imageIds, limit = 4) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => coerceString(item))
    .filter((item) => imageIds.has(item))
    .slice(0, limit);
}

/**
 * @param {AiLayoutSourceSectionLike | null | undefined} section
 * @param {{ imageIds?: string[], fallbackIndex?: number }} [options={}]
 * @returns {AiLayoutBlockLike | null}
 */
function buildSectionBlockFromSource(section, {
  imageIds = [],
  fallbackIndex = 0,
} = {}) {
  if (!section || typeof section !== 'object') return null;
  const sectionRecord = /** @type {AiLayoutSourceSectionLike} */ (section);
  const title = coerceString(sectionRecord.title || sectionRecord.heading || '');
  const paragraphs = Array.isArray(section.paragraphs)
    ? section.paragraphs.map((item) => coerceString(item)).filter(Boolean)
    : [];
  const bulletGroups = Array.isArray(section.bulletGroups)
    ? section.bulletGroups
      .map((group) => Array.isArray(group) ? group.map((item) => coerceString(item)).filter(Boolean).slice(0, 10) : [])
      .filter((group) => group.length)
    : [];
  const callouts = Array.isArray(section.callouts)
    ? section.callouts
      .map((callout) => ({
        type: coerceString(callout?.type),
        title: coerceString(callout?.title),
        body: coerceString(callout?.body),
      }))
      .filter((callout) => callout.title || callout.body || callout.type)
    : [];
  const normalizedImageIds = Array.isArray(imageIds)
    ? imageIds.map((item) => coerceString(item)).filter(Boolean).slice(0, 3)
    : [];
  const subsections = Array.isArray(section.subsections)
    ? section.subsections.map((subsection) => ({
      title: coerceString(subsection?.title || subsection?.heading || ''),
      level: Number.isInteger(subsection?.level) ? subsection.level : 3,
      paragraphs: Array.isArray(subsection?.paragraphs)
        ? subsection.paragraphs.map((item) => coerceString(item)).filter(Boolean)
        : [],
      bulletGroups: Array.isArray(subsection?.bulletGroups)
        ? subsection.bulletGroups
          .map((group) => Array.isArray(group) ? group.map((item) => coerceString(item)).filter(Boolean).slice(0, 10) : [])
          .filter((group) => group.length)
        : [],
      callouts: Array.isArray(subsection?.callouts)
        ? subsection.callouts
          .map((callout) => ({
            type: coerceString(callout?.type),
            title: coerceString(callout?.title),
            body: coerceString(callout?.body),
          }))
          .filter((callout) => callout.title || callout.body || callout.type)
        : [],
    })).filter((subsection) => subsection.title || subsection.paragraphs.length || subsection.bulletGroups.length || subsection.callouts.length)
    : [];
  if (!title && !paragraphs.length && !bulletGroups.length && !callouts.length) return null;
  return {
    type: 'section-block',
    sectionIndex: toSectionIndex(sectionRecord.index, fallbackIndex),
    sectionLabel: (sectionRecord.level || 2) >= 3 ? `SUB ${String(fallbackIndex + 1).padStart(2, '0')}` : `PART ${String(fallbackIndex + 1).padStart(2, '0')}`,
    headingLevel: Number.isInteger(sectionRecord.level) ? sectionRecord.level : 2,
    title,
    paragraphs,
    bulletGroups,
    callouts,
    imageIds: normalizedImageIds,
    subsections,
  };
}

/**
 * @param {AiLayoutBlockLike[]} [blocks=[]]
 * @param {number} [maxSectionBlocks=0]
 * @returns {AiLayoutBlockLike[]}
 */
function mergeSectionBlocksByBudget(blocks = [], maxSectionBlocks = 0) {
  if (!Number.isInteger(maxSectionBlocks) || maxSectionBlocks <= 0) return blocks.slice();
  let sectionCount = 0;
  /** @type {AiLayoutBlockLike[]} */
  const merged = [];

  /** @returns {AiLayoutBlockLike | null} */
  const getLastSectionBlock = () => {
    for (let index = merged.length - 1; index >= 0; index -= 1) {
      if (merged[index]?.type === 'section-block') return merged[index];
    }
    return null;
  };

  blocks.forEach((block) => {
    if (!block || block.type !== 'section-block') {
      merged.push(block);
      return;
    }

    if (sectionCount < maxSectionBlocks) {
      merged.push({
        ...block,
        paragraphs: Array.isArray(block.paragraphs) ? block.paragraphs.slice() : [],
        bulletGroups: Array.isArray(block.bulletGroups) ? block.bulletGroups.map((group) => Array.isArray(group) ? group.slice() : []).filter((group) => group.length) : [],
        callouts: Array.isArray(block.callouts) ? block.callouts.map((callout) => ({ ...callout })) : [],
        imageIds: Array.isArray(block.imageIds) ? block.imageIds.slice() : [],
        subsections: Array.isArray(block.subsections) ? block.subsections.map((subsection) => ({
          ...subsection,
          paragraphs: Array.isArray(subsection.paragraphs) ? subsection.paragraphs.slice() : [],
          bulletGroups: Array.isArray(subsection.bulletGroups) ? subsection.bulletGroups.map((group) => Array.isArray(group) ? group.slice() : []).filter((group) => group.length) : [],
          callouts: Array.isArray(subsection.callouts) ? subsection.callouts.map((callout) => ({ ...callout })) : [],
        })) : [],
      });
      sectionCount += 1;
      return;
    }

    const lastSectionBlock = getLastSectionBlock();
    if (!lastSectionBlock) {
      merged.push(block);
      return;
    }

    /** @type {AiLayoutSubsectionLike} */
    const promotedSubsection = {
      title: coerceString(block.title || block.sectionLabel || `Section ${sectionCount + 1}`),
      level: Math.max(3, Number.isInteger(block.headingLevel) ? block.headingLevel : 2),
      paragraphs: Array.isArray(block.paragraphs) ? block.paragraphs.slice() : [],
      bulletGroups: Array.isArray(block.bulletGroups)
        ? block.bulletGroups.map((group) => Array.isArray(group) ? group.slice() : []).filter((group) => group.length)
        : [],
      callouts: Array.isArray(block.callouts) ? block.callouts.map((callout) => ({ ...callout })) : [],
    };
    /** @type {AiLayoutSubsectionLike[]} */
    const nestedSubsections = Array.isArray(block.subsections)
      ? block.subsections.map((subsection) => ({
        title: coerceString(subsection?.title || ''),
        level: Math.max(3, Number.isInteger(subsection?.level) ? subsection.level : 3),
        paragraphs: Array.isArray(subsection?.paragraphs) ? subsection.paragraphs.slice() : [],
        bulletGroups: Array.isArray(subsection?.bulletGroups)
          ? subsection.bulletGroups.map((group) => Array.isArray(group) ? group.slice() : []).filter((group) => group.length)
          : [],
        callouts: Array.isArray(subsection?.callouts) ? subsection.callouts.map((callout) => ({ ...callout })) : [],
      })).filter((subsection) => subsection.title || subsection.paragraphs.length || subsection.bulletGroups.length || subsection.callouts.length)
      : [];

    lastSectionBlock.subsections = (Array.isArray(lastSectionBlock.subsections) ? lastSectionBlock.subsections : [])
      .concat([promotedSubsection], nestedSubsections);
    if (Array.isArray(block.imageIds) && block.imageIds.length) {
      lastSectionBlock.imageIds = Array.from(new Set([...(Array.isArray(lastSectionBlock.imageIds) ? lastSectionBlock.imageIds : []), ...block.imageIds])).slice(0, 3);
    }
  });

  return merged;
}

/**
 * @param {AiLayoutSourceSectionLike[]} [sourceSections=[]]
 * @param {unknown} [title='']
 * @returns {AiLayoutSourceSectionLike | null}
 */
function findSourceSectionByTitle(sourceSections = [], title = '') {
  const expectedKey = normalizeTitleKey(title);
  if (!expectedKey) return null;
  return sourceSections.find((section) => normalizeTitleKey(section?.title) === expectedKey) || null;
}

/**
 * @param {AiLayoutBlockLike | Record<string, unknown> | null | undefined} block
 * @param {Set<string>} imageIds
 * @param {AiLayoutSourceSectionLike[]} sourceSections
 * @param {number} index
 * @returns {AiLayoutBlockLike | null}
 */
function normalizeLayoutBlock(block, imageIds, sourceSections, index) {
  if (!block || typeof block !== 'object') return null;
  const type = coerceString(block.type);
  if (!type) return null;

  if (type === 'hero') {
    return {
      type,
      eyebrow: coerceString(block.eyebrow),
      title: coerceString(block.title),
      subtitle: coerceString(block.subtitle),
      coverImageId: imageIds.has(coerceString(block.coverImageId)) ? coerceString(block.coverImageId) : '',
      variant: ['cover-right', 'cover-left'].includes(block.variant) ? block.variant : 'cover-right',
    };
  }

  if (type === 'part-nav') {
    const items = Array.isArray(block.items)
      ? block.items.map((item, itemIndex) => {
        const itemRecord = toRecord(item);
        return {
          label: coerceString(itemRecord.label || `PART ${String(itemIndex + 1).padStart(2, '0')}`),
          text: coerceString(itemRecord.text || itemRecord.title),
        };
      }).filter((item) => item.text).slice(0, MAX_PART_NAV_ITEMS)
      : [];
    return items.length ? { type, items } : null;
  }

  if (type === 'lead-quote') {
    const text = coerceString(block.text || block.quote);
    if (!text) return null;
    return {
      type,
      text,
      note: coerceString(block.note),
    };
  }

  if (type === 'case-block') {
    const title = coerceString(block.title);
    const summary = coerceString(block.summary);
    if (!title && !summary) return null;
    const matchedSection = findSourceSectionByTitle(sourceSections, title);
    if (matchedSection) {
      return buildSectionBlockFromSource(matchedSection, {
        imageIds: toImageIdArray(block.imageIds, imageIds, MAX_CASE_BLOCK_IMAGE_IDS),
        fallbackIndex: toSectionIndex(matchedSection.index, index),
      });
    }
    return {
      type,
      caseLabel: coerceString(block.caseLabel || `CASE ${String(index + 1).padStart(2, '0')}`),
      title,
      summary,
      bullets: toTextArray(block.bullets, MAX_CASE_BLOCK_BULLETS),
      imageIds: toImageIdArray(block.imageIds, imageIds, MAX_CASE_BLOCK_IMAGE_IDS),
      highlight: coerceString(block.highlight),
    };
  }

  if (type === 'section-block') {
    const sectionIndex = toSectionIndex(block.sectionIndex, -1);
    const sourceSection = sectionIndex >= 0 ? sourceSections.find((item) => toSectionIndex(item?.index, -1) === sectionIndex) : null;
    if (!sourceSection) return null;
    return buildSectionBlockFromSource(sourceSection, {
      imageIds: toImageIdArray(block.imageIds, imageIds, 3),
      fallbackIndex: sectionIndex,
    });
  }

  if (type === 'phone-frame') {
    const imageId = coerceString(block.imageId);
    if (!imageIds.has(imageId)) return null;
    return {
      type,
      imageId,
      caption: coerceString(block.caption),
    };
  }

  if (type === 'cta-card') {
    const title = coerceString(block.title);
    const body = coerceString(block.body);
    if (!title && !body) return null;
    return {
      type,
      title,
      body,
      buttonText: coerceString(block.buttonText || '继续阅读'),
      note: coerceString(block.note),
    };
  }

  return null;
}

function looksLikeScreenshotRef(image = {}) {
  const signature = [
    image.id,
    image.alt,
    image.caption,
    image.src,
  ].map((item) => coerceString(item).toLowerCase()).join(' ');
  if (!signature) return false;
  return /(截图|界面|对话|聊天|微信|面板|后台|screenshot|screen|cleanshot|dialog|chat|ui)/i.test(signature);
}

function stripFrontmatterBlock(markdown = '') {
  const content = String(markdown || '').replace(/^\uFEFF/, '');
  if (!content.startsWith('---')) return content;
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
  return match ? content.slice(match[0].length) : content;
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]+]\([^)]+\)/g, '$1')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/[*_~#>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMarkdownCalloutStart(line = '') {
  const quoteLine = String(line || '').trim();
  const match = quoteLine.match(/^>\s*\[!\s*([^\]\r\n]+?)\s*\](?:\s*(.*))?$/u);
  if (!match) return null;
  return {
    type: coerceString(match[1]).toLowerCase(),
    title: stripMarkdown(match[2] || ''),
  };
}

function serializeClonedNodes(nodes = []) {
  const activeDocument = getActiveDocument();
  if (!activeDocument) return '';
  const container = activeDocument.createElement('div');
  trimTrailingDecorativeNodes(nodes).forEach((node) => {
    if (!node) return;
    container.appendChild(node.cloneNode(true));
  });
  return container.innerHTML.trim();
}

/**
 * @param {unknown} node
 * @returns {boolean}
 */
function hasMeaningfulNodeContent(node) {
  const currentNode = /** @type {Node | null} */ (node || null);
  if (!currentNode) return false;
  if (currentNode.nodeType === Node.TEXT_NODE) return /\S/.test(currentNode.textContent || '');
  if (currentNode.nodeType !== Node.ELEMENT_NODE) return false;

  const element = /** @type {HTMLElement} */ (currentNode);
  const tagName = String(element.tagName || '').toUpperCase();
  if (['IMG', 'TABLE', 'PRE', 'UL', 'OL', 'BLOCKQUOTE', 'FIGURE', 'SVG', 'VIDEO', 'AUDIO', 'CANVAS'].includes(tagName)) {
    return true;
  }
  if (element.querySelector('img,table,pre,ul,ol,blockquote,figure,svg,video,audio,canvas')) {
    return true;
  }
  return /\S/.test((element.textContent || '').replace(/\u00a0/g, ''));
}

/**
 * @param {unknown} node
 * @returns {boolean}
 */
function isTrailingDecorativeNode(node) {
  const currentNode = /** @type {Node | null} */ (node || null);
  if (!currentNode) return true;
  if (currentNode.nodeType === Node.TEXT_NODE) return !/\S/.test(currentNode.textContent || '');
  if (currentNode.nodeType !== Node.ELEMENT_NODE) return true;

  const tagName = String(/** @type {HTMLElement} */ (currentNode).tagName || '').toUpperCase();
  if (tagName === 'HR') return true;
  if (['P', 'DIV', 'SECTION'].includes(tagName) && !hasMeaningfulNodeContent(node)) {
    return true;
  }
  return false;
}

/**
 * @param {unknown[]} nodes
 * @returns {Node[]}
 */
function trimTrailingDecorativeNodes(nodes = []) {
  /** @type {Node[]} */
  const trimmed = [];
  if (Array.isArray(nodes)) {
    nodes.forEach((node) => {
      if (node instanceof Node) trimmed.push(node);
    });
  }
  while (trimmed.length && isTrailingDecorativeNode(trimmed[trimmed.length - 1])) {
    trimmed.pop();
  }
  return trimmed;
}

/**
 * @param {string} html
 * @returns {{ sections: AiLayoutSourceSectionLike[] }}
 */
function extractRenderedSectionFragments(html = '') {
  if (!html) {
    return { sections: [] };
  }

  const container = createHtmlContainer('div', String(html || ''));
  if (!container) return { sections: [] };
  const root = container.children.length === 1 ? container.firstElementChild : container;
  const childNodes = Array.from(root?.childNodes || []).filter((node) => (
    node.nodeType !== 3 || /\S/.test(node.textContent || '')
  ));
  /** @type {AiLayoutSourceSectionLike[]} */
  const sections = [];
  /** @type {{ title: string, titleKey: string, leadNodes: Node[], subsections: Array<{ title: string, titleKey: string, nodes: Node[] }> } | null} */
  let currentSection = null;
  /** @type {{ title: string, titleKey: string, nodes: Node[] } | null} */
  let currentSubsection = null;

  const finalizeSection = () => {
    if (!currentSection) return;
    sections.push({
      index: sections.length,
      title: currentSection.title,
      titleKey: currentSection.titleKey,
      leadHtml: serializeClonedNodes(currentSection.leadNodes),
      subsections: currentSection.subsections.map((subsection, subsectionIndex) => ({
        index: subsectionIndex,
        title: subsection.title,
        titleKey: subsection.titleKey,
        contentHtml: serializeClonedNodes(subsection.nodes),
      })),
    });
    currentSection = null;
    currentSubsection = null;
  };

  childNodes.forEach((node) => {
    if (node.nodeType === 1) {
      const tagName = String(node.tagName || '').toUpperCase();
      const headingMatch = tagName.match(/^H([2-6])$/);
      if (headingMatch) {
        const level = parseInt(headingMatch[1], 10);
        const title = coerceString(node.textContent).trim();
        if (level === 2 || !currentSection) {
          finalizeSection();
          currentSection = {
            title,
            titleKey: normalizeTitleKey(title),
            leadNodes: [],
            subsections: [],
          };
          currentSubsection = null;
          return;
        }
        if (level >= 3 && currentSection) {
          currentSubsection = {
            title,
            titleKey: normalizeTitleKey(title),
            nodes: [],
          };
          currentSection.subsections.push(currentSubsection);
          return;
        }
      }
    }

    if (!currentSection) return;
    if (currentSubsection) {
      currentSubsection.nodes.push(node);
    } else {
      currentSection.leadNodes.push(node);
    }
  });

  finalizeSection();
  return { sections };
}

/**
 * @param {unknown} markdown
 * @returns {MarkdownStructure}
 */
function extractMarkdownSections(markdown = '') {
  const lines = stripFrontmatterBlock(markdown).split(/\r?\n/);
  /** @type {MarkdownSection[]} */
  const sections = [];
  /** @type {string[]} */
  const introParagraphs = [];
  /** @type {string[][]} */
  const introBulletGroups = [];
  /** @type {MarkdownCallout[]} */
  const introCallouts = [];
  /** @type {MarkdownHeading[]} */
  const headings = [];
  /** @type {MarkdownSection | null} */
  let currentSection = null;
  /** @type {MarkdownSubsection | null} */
  let currentSubsection = null;
  /** @type {string[]} */
  let currentParagraph = [];
  /** @type {string[]} */
  let currentBullets = [];
  /** @type {{ type: string, title: string, lines: string[] } | null} */
  let currentCallout = null;

  const getCurrentTarget = () => currentSubsection || currentSection || null;

  const getCurrentCalloutTarget = () => {
    const target = getCurrentTarget();
    if (target) {
      return target.callouts;
    }
    return introCallouts;
  };

  const pushParagraphToTarget = () => {
    const text = stripMarkdown(currentParagraph.join(' ').trim());
    if (text) {
      const target = getCurrentTarget();
      if (target) {
        target.paragraphs.push(text);
      } else {
        introParagraphs.push(text);
      }
    }
    currentParagraph = [];
  };

  const pushBulletsToTarget = () => {
    if (currentBullets.length) {
      const target = getCurrentTarget();
      if (target) {
        target.bulletGroups.push(currentBullets);
      } else {
        introBulletGroups.push(currentBullets);
      }
    }
    currentBullets = [];
  };

  const pushCalloutToTarget = () => {
    if (!currentCallout) return;
    const body = stripMarkdown(currentCallout.lines.join(' ').trim());
    if (body || currentCallout.title || currentCallout.type) {
      getCurrentCalloutTarget().push({
        type: currentCallout.type,
        title: currentCallout.title,
        body,
      });
    }
    currentCallout = null;
  };

  const finalizeSection = () => {
    pushCalloutToTarget();
    if (currentSection && (currentSection.title || currentSection.paragraphs.length || currentSection.bulletGroups.length || currentSection.callouts?.length)) {
      currentSection.index = sections.length;
      sections.push(currentSection);
    }
    currentSection = null;
    currentSubsection = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      pushParagraphToTarget();
      pushBulletsToTarget();
      pushCalloutToTarget();
      continue;
    }

    const calloutStart = parseMarkdownCalloutStart(rawLine);
    if (calloutStart) {
      pushParagraphToTarget();
      pushBulletsToTarget();
      pushCalloutToTarget();
      currentCallout = {
        type: calloutStart.type,
        title: calloutStart.title,
        lines: [],
      };
      continue;
    }

    if (currentCallout) {
      const calloutLineMatch = rawLine.match(/^\s*>\s?(.*)$/);
      if (calloutLineMatch) {
        const calloutText = stripMarkdown(calloutLineMatch[1] || '');
        if (calloutText) currentCallout.lines.push(calloutText);
        continue;
      }
      pushCalloutToTarget();
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      pushParagraphToTarget();
      pushBulletsToTarget();
      const level = headingMatch[1].length;
      const title = stripMarkdown(headingMatch[2]);
      headings.push({ level, text: title });
      if (level === 1) {
        currentSubsection = null;
        continue;
      }
      if (level === 2 || !currentSection) {
        finalizeSection();
        currentSection = {
          index: sections.length,
          level: 2,
          title,
          paragraphs: [],
          bulletGroups: [],
          callouts: [],
          subsections: [],
        };
        currentSubsection = null;
        continue;
      }
      currentSubsection = {
        level,
        title,
        paragraphs: [],
        bulletGroups: [],
        callouts: [],
      };
      currentSection.subsections.push(currentSubsection);
      continue;
    }

    const bulletMatch = line.match(/^[-*+]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
    if (bulletMatch) {
      pushParagraphToTarget();
      currentBullets.push(stripMarkdown(bulletMatch[1]));
      continue;
    }

    currentParagraph.push(line);
  }

  pushParagraphToTarget();
  pushBulletsToTarget();
  pushCalloutToTarget();
  finalizeSection();

  if (!sections.length && (introParagraphs.length || introBulletGroups.length || introCallouts.length)) {
    sections.push({
      index: 0,
      level: 2,
      title: '核心内容',
      paragraphs: introParagraphs.slice(),
      bulletGroups: introBulletGroups.slice(),
      callouts: introCallouts.slice(),
      subsections: [],
    });
  }

  return {
    introParagraphs,
    introBulletGroups,
    introCallouts,
    headings,
    sections,
  };
}

/**
 * @param {unknown} markdown
 * @returns {MarkdownSignals}
 */
function extractMarkdownSignals(markdown = '') {
  const structure = extractMarkdownSections(markdown);
  const headings = Array.isArray(structure.headings)
    ? structure.headings.map((heading) => ({
      level: heading.level || 2,
      text: coerceString(heading.text),
    })).filter((heading) => heading.text)
    : [];
  const bulletGroups = [
    ...structure.introBulletGroups,
    ...structure.sections.flatMap((section) => [
      ...(section.bulletGroups || []),
      ...((section.subsections || []).flatMap((subsection) => subsection.bulletGroups || [])),
    ]),
  ];
  const paragraphs = [
    ...structure.introParagraphs,
    ...structure.sections.flatMap((section) => [
      ...(section.paragraphs || []),
      ...((section.subsections || []).flatMap((subsection) => subsection.paragraphs || [])),
    ]),
  ];
  const leadParagraphs = paragraphs.slice(0, 3);
  const lastParagraph = paragraphs[paragraphs.length - 1] || '';
  const sectionTitles = structure.sections.map((section) => coerceString(section.title)).filter(Boolean).slice(0, 12);
  return {
    headings,
    sectionTitles,
    paragraphs,
    leadParagraphs,
    bulletGroups,
    lastParagraph,
  };
}

/**
 * @param {{ rawLayout?: unknown, signals?: MarkdownSignals | null, imageRefs?: unknown[] }} [options={}]
 * @returns {string}
 */
function recommendLayoutFamily({ rawLayout = {}, signals = null, imageRefs = [] } = {}) {
  const rawLayoutRecord = toRecord(rawLayout);
  const resolvedRecord = toRecord(rawLayoutRecord.resolved);
  const rawRecommended = coerceString(
    rawLayoutRecord.recommendedLayoutFamily || resolvedRecord.layoutFamily || rawLayoutRecord.layoutFamily
  );
  if (rawRecommended && AI_LAYOUT_FAMILY_DEFS[rawRecommended]) return normalizeResolvedLayoutFamily(rawRecommended);
  const safeSignals = signals || extractMarkdownSignals('');
  const headingCount = safeSignals.headings?.length || 0;
  const sectionCount = safeSignals.sectionTitles?.length || 0;
  const bulletGroupCount = safeSignals.bulletGroups?.length || 0;
  const imageCount = Array.isArray(imageRefs) ? imageRefs.length : 0;
  const hintText = `${coerceString(rawLayoutRecord.title)} ${Array.isArray(safeSignals.sectionTitles) ? safeSignals.sectionTitles.join(' ') : ''}`.toLowerCase();
  if (/(观点|经验|复盘|写作|表达|品牌|故事|思考|方法论|内容创作|心得|感受|editorial|essay|brand)/i.test(hintText)) {
    return 'editorial-lite';
  }
  if (sectionCount >= 2 || headingCount >= 4 || bulletGroupCount >= 2 || imageCount >= 2) {
    return 'tutorial-cards';
  }
  return 'source-first';
}

/**
 * @param {{ rawLayout?: unknown, signals?: MarkdownSignals | null }} [options={}]
 * @returns {string}
 */
function recommendColorPalette({ rawLayout = {}, signals = null } = {}) {
  const rawLayoutRecord = toRecord(rawLayout);
  const resolvedRecord = toRecord(rawLayoutRecord.resolved);
  const rawRecommended = coerceString(
    rawLayoutRecord.recommendedColorPalette || resolvedRecord.colorPalette || rawLayoutRecord.stylePack
  );
  if (rawRecommended && rawRecommended !== 'custom' && AI_COLOR_PALETTES[rawRecommended]) {
    return normalizeResolvedColorPalette(rawRecommended);
  }
  const safeSignals = signals || extractMarkdownSignals('');
  const headingTitles = Array.isArray(safeSignals.sectionTitles)
    ? safeSignals.sectionTitles.join(' ')
    : '';
  const titleHints = `${coerceString(rawLayoutRecord.title)} ${headingTitles}`.toLowerCase();
  if (/(教程|指南|入门|步骤|实践|实操|配置|接入|使用|标签|双链|知识库|workflow|guide|tutorial|how to)/i.test(titleHints)) {
    return 'ocean-blue';
  }
  if (/(观点|品牌|复盘|内容|经验|编辑|写作|表达)/i.test(titleHints)) {
    return 'graphite-rose';
  }
  if (/(清单|合集|推荐|总结|收藏)/i.test(titleHints)) {
    return 'sunset-amber';
  }
  return 'tech-green';
}

/**
 * @param {{ title?: string, selection?: AiLayoutSelectionLike, stylePack?: string, layoutFamily?: string, colorPalette?: string, sourcePath?: string, markdown?: string, imageRefs?: AiImageRefLike[], provider?: AiProviderLike, signals?: MarkdownSignals }} [context={}]
 * @returns {AiLayoutBlockLike[]}
 */
function buildFallbackLayout(context = {}) {
  const source = toRecord(context);
  const title = coerceString(source.title || '未命名文章');
  const selectionResolution = resolveLayoutSelection({
    requestedSelection: source.selection || { colorPalette: source.stylePack },
    rawLayout: source.rawLayout,
    signals: /** @type {MarkdownSignals | null} */ (source.signals || extractMarkdownSignals(source.markdown || '')),
    imageRefs: Array.isArray(source.imageRefs) ? source.imageRefs : [],
  });
  const resolved = selectionResolution.resolved;
  const skill = getLayoutSkillById(resolved.layoutFamily);
  const fallbackConfig = toRecord(skill?.fallback);
  /** @type {AiImageRefLike[]} */
  const imageRefs = Array.isArray(source.imageRefs) ? source.imageRefs.map((item) => /** @type {AiImageRefLike} */ (toRecord(item))) : [];
  const signals = /** @type {MarkdownSignals} */ (source.signals || extractMarkdownSignals(source.markdown || ''));
  const sourceSections = Array.isArray(source.sourceSections)
    ? /** @type {AiLayoutSourceSectionLike[]} */ (source.sourceSections.map((item) => toRecord(item)))
    : extractMarkdownSections(source.markdown || '').sections;
  const firstImageId = coerceString(imageRefs[0]?.id);
  const leadText = summarizeText(signals.leadParagraphs[0] || signals.paragraphs[0] || '');
  const leadNote = summarizeText(signals.leadParagraphs[1] || '');
  const partItems = signals.sectionTitles.slice(0, MAX_PART_NAV_ITEMS).map((text, index) => ({
    label: `PART ${String(index + 1).padStart(2, '0')}`,
    text,
  }));

  /** @type {AiLayoutBlockLike[]} */
  const headBlocks = [];
  /** @type {AiLayoutBlockLike[]} */
  const bodyBlocks = [];
  if (fallbackConfig.includeHero) {
    headBlocks.push({
      type: 'hero',
      eyebrow: signals.sectionTitles[0] ? (fallbackConfig.heroEyebrow || 'AI Layout Draft') : (fallbackConfig.heroEyebrow || 'AI Article Layout'),
      title,
      subtitle: leadText || summarizeText(signals.lastParagraph || title, 64),
      coverImageId: firstImageId,
      variant: fallbackConfig.heroVariant || 'cover-right',
    });
  }

  if (fallbackConfig.includePartNav && partItems.length >= 2) {
    headBlocks.push({ type: 'part-nav', items: partItems });
  }

  if (fallbackConfig.includeLeadQuote && leadText) {
    headBlocks.push({
      type: 'lead-quote',
      text: leadText,
      note: leadNote,
    });
  }

  const heroCoverImageId = coerceString(headBlocks.find((block) => block?.type === 'hero')?.coverImageId);
  const safeSourceSections = Array.isArray(sourceSections)
    ? sourceSections.map((section) => /** @type {AiLayoutSourceSectionLike} */ (toRecord(section)))
    : [];
  safeSourceSections.forEach((section, index) => {
    const block = buildSectionBlockFromSource(section, {
      imageIds: index === 0 && firstImageId && heroCoverImageId !== firstImageId ? [firstImageId] : [],
      fallbackIndex: index,
    });
    if (block) bodyBlocks.push(block);
  });
  const maxSectionBlocks = Number.isInteger(fallbackConfig.maxSectionBlocks) ? fallbackConfig.maxSectionBlocks : 0;
  const budgetedBodyBlocks = mergeSectionBlocksByBudget(bodyBlocks, maxSectionBlocks);

  const screenshotImage = imageRefs.find((image, index) => index > 0 && looksLikeScreenshotRef(image)) || null;
  if (fallbackConfig.includePhoneFrame && screenshotImage?.id) {
    budgetedBodyBlocks.push({
      type: 'phone-frame',
      imageId: screenshotImage.id,
      caption: screenshotImage.caption || screenshotImage.alt || '示意截图',
    });
  }

  /**
   * @param {AiLayoutBlockLike[]} blocks
   * @returns {Set<string>}
   */
  const collectUsedImageIds = (blocks = []) => {
    /** @type {Set<string>} */
    const used = new Set();
    blocks.forEach((block) => {
      const blockRecord = toRecord(block);
      const coverImageId = coerceString(blockRecord.coverImageId);
      if (coverImageId) used.add(coverImageId);
      const singleImageId = coerceString(blockRecord.imageId);
      if (singleImageId) used.add(singleImageId);
      if (Array.isArray(blockRecord.imageIds)) {
        blockRecord.imageIds.map((item) => coerceString(item)).filter(Boolean).forEach((item) => used.add(item));
      }
    });
    return used;
  };
  /**
   * @param {AiLayoutBlockLike[]} blocks
   * @param {string[]} remainingImageIds
   * @param {string} familyId
   * @returns {AiLayoutBlockLike[]}
   */
  const appendRemainingImages = (blocks = [], remainingImageIds = [], familyId = '') => {
    const queue = remainingImageIds.slice();
    if (!queue.length) return blocks;

    /** @type {number[]} */
    const attachableIndexes = [];
    blocks.forEach((block, index) => {
      const blockType = coerceString(toRecord(block).type);
      if (blockType === 'section-block' || blockType === 'case-block') {
        attachableIndexes.push(index);
      }
    });

    attachableIndexes.forEach((blockIndex) => {
      if (!queue.length) return;
      const block = blocks[blockIndex];
      const blockRecord = toRecord(block);
      const limit = blockRecord.type === 'case-block' ? MAX_CASE_BLOCK_IMAGE_IDS : 3;
      const currentImageIds = Array.isArray(blockRecord.imageIds)
        ? blockRecord.imageIds.map((item) => coerceString(item)).filter(Boolean)
        : [];
      const availableSlots = Math.max(0, limit - currentImageIds.length);
      if (!availableSlots) return;
      blocks[blockIndex] = {
        ...block,
        imageIds: currentImageIds.concat(queue.splice(0, availableSlots)),
      };
    });

    while (queue.length) {
      blocks.push({
        type: 'case-block',
        caseLabel: fallbackConfig.galleryCaseLabel || (familyId === 'editorial-lite' ? 'IMAGES' : 'GALLERY'),
        title: fallbackConfig.galleryTitle || (familyId === 'editorial-lite' ? '图像摘录' : '配图补充'),
        summary: '',
        bullets: [],
        imageIds: queue.splice(0, MAX_CASE_BLOCK_IMAGE_IDS),
        highlight: '',
      });
    }

    return blocks;
  };
  const usedImageIds = collectUsedImageIds([...headBlocks, ...budgetedBodyBlocks]);
  const remainingImageIds = imageRefs
    .map((image) => coerceString(image?.id))
    .filter(Boolean)
    .filter((imageId) => !usedImageIds.has(imageId));
  appendRemainingImages(budgetedBodyBlocks, remainingImageIds, resolved.layoutFamily);

  return {
    version: AI_LAYOUT_SCHEMA_VERSION,
    articleType: signals.sectionTitles.length >= 2 ? 'tutorial' : 'article',
    selection: selectionResolution.selection,
    resolved,
    recommendedLayoutFamily: selectionResolution.recommendedLayoutFamily,
    recommendedColorPalette: selectionResolution.recommendedColorPalette,
    stylePack: resolved.colorPalette,
    layoutFamily: resolved.layoutFamily,
    title,
    summary: summarizeText(leadText || signals.lastParagraph || title, 90),
    blocks: [...headBlocks, ...budgetedBodyBlocks].filter(Boolean).slice(0, MAX_LAYOUT_BLOCKS),
  };
}

/**
 * @param {AiLayoutBlockLike[]} aiBlocks
 * @param {AiLayoutBlockLike[]} fallbackBlocks
 * @returns {AiLayoutBlockLike[]}
 */
function mergeBlocksWithFallback(aiBlocks = [], fallbackBlocks = []) {
  return mergeBlocksWithFallbackDetailed(aiBlocks, fallbackBlocks).map((entry) => entry.block);
}

/**
 * @param {AiLayoutBlockLike[]} aiBlocks
 * @param {AiLayoutBlockLike[]} fallbackBlocks
 * @returns {Array<{ block: AiLayoutBlockLike, source: 'ai' | 'fallback' }>}
 */
function mergeBlocksWithFallbackDetailed(aiBlocks = [], fallbackBlocks = []) {
  const introOrder = ['hero', 'part-nav', 'lead-quote'];
  /** @type {Map<string, AiLayoutBlockLike>} */
  const introAiByType = new Map();
  /** @type {Map<string, AiLayoutBlockLike>} */
  const introFallbackByType = new Map();
  /** @type {Map<number, AiLayoutBlockLike>} */
  const fallbackSectionsByIndex = new Map();
  /** @type {Array<{ block: AiLayoutBlockLike, source: 'ai' }>} */
  const deferredAi = [];
  /** @type {Array<{ block: AiLayoutBlockLike, source: 'ai' | 'fallback' }>} */
  const deferredFallback = [];
  /** @type {Set<string>} */
  const seenKeys = new Set();
  /** @type {Array<{ block: AiLayoutBlockLike, source: 'ai' | 'fallback' }>} */
  const merged = [];

  /**
   * @param {AiLayoutBlockLike | null | undefined} block
   * @param {'ai' | 'fallback'} source
   */
  const addBlock = (block, source) => {
    const blockRecord = toRecord(block);
    if (!block || !coerceString(blockRecord.type)) return;
    const dedupeKey = getLayoutBlockKey(block);
    if (seenKeys.has(dedupeKey)) return;
    seenKeys.add(dedupeKey);
    merged.push({ block, source });
  };

  /** @type {number[]} */
  const fallbackSectionIndices = [];
  fallbackBlocks.forEach((block) => {
    const blockRecord = toRecord(block);
    const blockType = coerceString(blockRecord.type);
    if (!block || !blockType) return;
    if (introOrder.includes(blockType)) {
      if (!introFallbackByType.has(blockType)) {
        introFallbackByType.set(blockType, block);
      }
      return;
    }
    if (blockType === 'section-block' && Number.isInteger(blockRecord.sectionIndex) && blockRecord.sectionIndex >= 0) {
      const sectionIndex = Number(blockRecord.sectionIndex);
      if (!fallbackSectionsByIndex.has(sectionIndex)) {
        fallbackSectionsByIndex.set(sectionIndex, block);
        fallbackSectionIndices.push(sectionIndex);
      }
      return;
    }
    deferredFallback.push({ block, source: 'fallback' });
  });

  aiBlocks.forEach((block) => {
    const blockType = coerceString(toRecord(block).type);
    if (!block || !blockType) return;
    if (introOrder.includes(blockType)) {
      if (!introAiByType.has(blockType)) {
        introAiByType.set(blockType, block);
      }
      return;
    }
    deferredAi.push({ block, source: 'ai' });
  });

  introOrder.forEach((type) => {
    const aiBlock = introAiByType.get(type);
    const fallbackBlock = introFallbackByType.get(type);
    if (aiBlock) {
      addBlock(aiBlock, 'ai');
    } else if (fallbackBlock) {
      addBlock(fallbackBlock, 'fallback');
    }
  });

  const sortedFallbackIndices = Array.from(new Set(fallbackSectionIndices)).sort((a, b) => a - b);
  let fallbackPointer = 0;
  /** @param {number} targetIndex */
  const flushFallbackSectionsBefore = (targetIndex) => {
    while (fallbackPointer < sortedFallbackIndices.length && sortedFallbackIndices[fallbackPointer] < targetIndex) {
      const sectionIndex = sortedFallbackIndices[fallbackPointer];
      addBlock(fallbackSectionsByIndex.get(sectionIndex), 'fallback');
      fallbackPointer += 1;
    }
  };
  /** @param {number} sectionIndex */
  const consumeFallbackSection = (sectionIndex) => {
    while (fallbackPointer < sortedFallbackIndices.length && sortedFallbackIndices[fallbackPointer] <= sectionIndex) {
      fallbackPointer += 1;
    }
  };

  deferredAi.forEach((entry) => {
    const block = entry.block;
    const blockRecord = toRecord(block);
    if (blockRecord.type === 'section-block' && Number.isInteger(blockRecord.sectionIndex) && blockRecord.sectionIndex >= 0) {
      const sectionIndex = Number(blockRecord.sectionIndex);
      flushFallbackSectionsBefore(sectionIndex);
      addBlock(block, 'ai');
      consumeFallbackSection(sectionIndex);
      return;
    }
    if (blockRecord.type === 'hero' || blockRecord.type === 'part-nav' || blockRecord.type === 'lead-quote') {
      return;
    }
    deferredFallback.push(entry);
  });

  flushFallbackSectionsBefore(Number.POSITIVE_INFINITY);
  deferredFallback.forEach((entry) => addBlock(entry.block, entry.source));

  return merged.slice(0, MAX_LAYOUT_BLOCKS);
}

function normalizeArticleLayout(rawLayout = {}, context = {}) {
  const rawLayoutRecord = toRecord(rawLayout);
  const contextRecord = toRecord(context);
  const imageRefs = toAiImageRefs(contextRecord.imageRefs);
  const imageIds = new Set(imageRefs.map((image) => coerceString(image.id)).filter(Boolean));
  const selectionResolution = resolveLayoutSelection({
    requestedSelection: contextRecord.selection || { colorPalette: contextRecord.stylePack },
    rawLayout: rawLayoutRecord,
    signals: /** @type {MarkdownSignals | null} */ (contextRecord.signals || extractMarkdownSignals(contextRecord.markdown || '')),
    imageRefs,
  });
  const sourceSections = Array.isArray(contextRecord.sourceSections)
    ? /** @type {AiLayoutSourceSectionLike[]} */ (contextRecord.sourceSections.map((section) => toRecord(section)))
    : extractMarkdownSections(contextRecord.markdown || '').sections;
  const rawBlocks = toAiLayoutBlocks(rawLayoutRecord.blocks);
  const normalizedAiBlocks = rawBlocks.length
    ? rawBlocks
      .map((block, index) => normalizeLayoutBlock(block, imageIds, sourceSections, index))
      .filter(Boolean)
    : [];
  const fallbackLayout = buildFallbackLayout({
    title: rawLayoutRecord.title || contextRecord.title,
    markdown: contextRecord.markdown,
    selection: selectionResolution.selection,
    rawLayout: rawLayoutRecord,
    imageRefs,
    signals: contextRecord.signals,
    sourceSections,
  });
  const blocks = mergeBlocksWithFallback(
    /** @type {AiLayoutBlockLike[]} */ (normalizedAiBlocks.filter(Boolean)),
    toAiLayoutBlocks(fallbackLayout.blocks)
  );

  return {
    version: AI_LAYOUT_SCHEMA_VERSION,
    articleType: coerceString(rawLayoutRecord.articleType || fallbackLayout.articleType || 'article'),
    selection: selectionResolution.selection,
    resolved: selectionResolution.resolved,
    recommendedLayoutFamily: selectionResolution.recommendedLayoutFamily,
    recommendedColorPalette: selectionResolution.recommendedColorPalette,
    stylePack: selectionResolution.resolved.colorPalette,
    layoutFamily: selectionResolution.resolved.layoutFamily,
    title: coerceString(rawLayoutRecord.title || contextRecord.title || fallbackLayout.title),
    summary: coerceString(rawLayoutRecord.summary || fallbackLayout.summary),
    blocks,
  };
}

/**
 * @param {{ provider?: AiProviderLike, layoutFamily?: string, colorPalette?: string, recommendedLayoutFamily?: string, recommendedColorPalette?: string, mergedEntries?: Array<{ source?: 'ai' | 'fallback', block?: AiLayoutBlockLike }>, signals?: MarkdownSignals, imageRefs?: AiImageRefLike[], schemaValidation?: AiLayoutSchemaValidationLike }} [options={}]
 * @returns {AiLayoutGenerationMetaLike}
 */
function createLayoutGenerationMeta({
  provider,
  layoutFamily,
  colorPalette,
  recommendedLayoutFamily,
  recommendedColorPalette,
  signals,
  imageRefs = [],
  normalizedAiBlocks = [],
  mergedEntries = [],
  schemaValidation = null,
  usage = AI_USAGE_EMPTY,
}) {
  const safeSignals = signals || extractMarkdownSignals('');
  const safeImageRefs = toAiImageRefs(imageRefs);
  const safeNormalizedAiBlocks = toAiLayoutBlocks(normalizedAiBlocks);
  /** @type {Array<{ source?: 'ai' | 'fallback', block?: AiLayoutBlockLike }>} */
  const safeMergedEntries = Array.isArray(mergedEntries)
    ? mergedEntries.map((entry) => {
      const entryRecord = toRecord(entry);
      return {
        source: entryRecord.source === 'fallback' ? 'fallback' : 'ai',
        block: /** @type {AiLayoutBlockLike} */ (toRecord(entryRecord.block)),
      };
    })
    : [];
  const layoutFamilyInfo = getLayoutFamilyById(layoutFamily);
  const colorPaletteInfo = getColorPaletteById(colorPalette);
  const fallbackEntries = safeMergedEntries.filter((entry) => entry.source === 'fallback');
  const executionMode = fallbackEntries.length > 0 && safeNormalizedAiBlocks.length === 0
    ? 'local-fallback'
    : 'ai-enhanced';
  return {
    providerName: coerceString(provider?.name),
    providerModel: coerceString(provider?.model),
    skillId: layoutFamilyInfo?.id || coerceString(layoutFamily),
    skillLabel: layoutFamilyInfo?.label || '',
    skillVersion: layoutFamilyInfo?.version || '',
    executionMode,
    layoutFamilyLabel: layoutFamilyInfo?.label || '',
    colorPaletteLabel: colorPaletteInfo?.label || '',
    stylePackLabel: colorPaletteInfo?.label || '',
    recommendedLayoutFamilyLabel: getLayoutFamilyById(recommendedLayoutFamily)?.label || '',
    recommendedColorPaletteLabel: getColorPaletteById(recommendedColorPalette)?.label || '',
    headingCount: safeSignals.headings.length,
    sectionCount: safeSignals.sectionTitles.length,
    leadParagraphCount: safeSignals.leadParagraphs.length,
    bulletGroupCount: safeSignals.bulletGroups.length,
    imageCount: safeImageRefs.length,
    aiBlockCount: safeNormalizedAiBlocks.length,
    finalBlockCount: safeMergedEntries.length,
    fallbackUsed: fallbackEntries.length > 0,
    fallbackBlockCount: fallbackEntries.length,
    fallbackBlockTypes: Array.from(new Set(fallbackEntries.map((entry) => entry.block?.type).filter(Boolean))).slice(0, 6),
    schemaValidation: normalizeSchemaValidation(schemaValidation),
    usage: normalizeAiUsage(usage),
    blockOrigins: safeMergedEntries.map((entry, index) => ({
      index,
      type: coerceString(entry.block?.type),
      source: entry.source === 'fallback' ? 'fallback' : 'ai',
      label: getLayoutBlockLabel(entry.block),
    })),
  };
}

/**
 * @param {AiLayoutJsonLike | Record<string, unknown>} [rawLayout={}]
 * @param {{ markdown?: string, selection?: AiLayoutSelectionLike, stylePack?: string, imageRefs?: AiImageRefLike[], signals?: MarkdownSignals, provider?: AiProviderLike, usage?: AiUsageLike }} [context={}]
 * @returns {AiLayoutStateLike}
 */
function buildLayoutResult(rawLayout = {}, context = {}) {
  const rawLayoutRecord = toRecord(rawLayout);
  const contextRecord = toRecord(context);
  const validation = validateAiLayoutPayload(rawLayout);
  const signals = /** @type {MarkdownSignals} */ (contextRecord.signals || extractMarkdownSignals(contextRecord.markdown || ''));
  const imageRefs = toAiImageRefs(contextRecord.imageRefs);
  const selectionResolution = resolveLayoutSelection({
    requestedSelection: contextRecord.selection || { colorPalette: contextRecord.stylePack },
    rawLayout: rawLayoutRecord,
    signals,
    imageRefs,
  });
  if (validation.fatal) {
    const generationMeta = createLayoutGenerationMeta({
      provider: /** @type {AiProviderLike} */ (toRecord(contextRecord.provider)),
      layoutFamily: selectionResolution.resolved.layoutFamily,
      colorPalette: selectionResolution.resolved.colorPalette,
      recommendedLayoutFamily: selectionResolution.recommendedLayoutFamily,
      recommendedColorPalette: selectionResolution.recommendedColorPalette,
      signals,
      imageRefs,
      normalizedAiBlocks: [],
      mergedEntries: [],
      schemaValidation: validation,
      usage: normalizeAiUsage(contextRecord.usage),
    });
    throw new AiLayoutSchemaError(`AI 返回的布局结果未通过 schema 校验（${validation.issueCount} 项）`, validation, generationMeta);
  }

  const imageIds = new Set(imageRefs.map((image) => coerceString(image.id)).filter(Boolean));
  const sourceSections = Array.isArray(contextRecord.sourceSections)
    ? /** @type {AiLayoutSourceSectionLike[]} */ (contextRecord.sourceSections.map((section) => toRecord(section)))
    : extractMarkdownSections(contextRecord.markdown || '').sections;
  const rawBlocks = toAiLayoutBlocks(rawLayoutRecord.blocks);
  const normalizedAiBlocks = rawBlocks.length
    ? rawBlocks
      .map((block, index) => normalizeLayoutBlock(block, imageIds, sourceSections, index))
      .filter(Boolean)
    : [];
  const fallbackLayout = buildFallbackLayout({
    title: rawLayoutRecord.title || contextRecord.title,
    markdown: contextRecord.markdown,
    selection: selectionResolution.selection,
    rawLayout: rawLayoutRecord,
    imageRefs,
    signals,
    sourceSections,
  });
  const mergedEntries = mergeBlocksWithFallbackDetailed(
    /** @type {AiLayoutBlockLike[]} */ (normalizedAiBlocks.filter(Boolean)),
    toAiLayoutBlocks(fallbackLayout.blocks)
  );
  const layoutJson = {
    version: AI_LAYOUT_SCHEMA_VERSION,
    articleType: coerceString(rawLayoutRecord.articleType || fallbackLayout.articleType || 'article'),
    selection: selectionResolution.selection,
    resolved: selectionResolution.resolved,
    recommendedLayoutFamily: selectionResolution.recommendedLayoutFamily,
    recommendedColorPalette: selectionResolution.recommendedColorPalette,
    stylePack: selectionResolution.resolved.colorPalette,
    layoutFamily: selectionResolution.resolved.layoutFamily,
    title: coerceString(rawLayoutRecord.title || contextRecord.title || fallbackLayout.title),
    summary: coerceString(rawLayoutRecord.summary || fallbackLayout.summary),
    blocks: mergedEntries.map((entry) => entry.block),
  };

  return {
    layoutJson,
    generationMeta: createLayoutGenerationMeta({
      provider: /** @type {AiProviderLike} */ (toRecord(contextRecord.provider)),
      layoutFamily: layoutJson.resolved.layoutFamily,
      colorPalette: layoutJson.resolved.colorPalette,
      recommendedLayoutFamily: layoutJson.recommendedLayoutFamily,
      recommendedColorPalette: layoutJson.recommendedColorPalette,
      signals,
      imageRefs,
      normalizedAiBlocks,
      mergedEntries,
      schemaValidation: validation,
      usage: normalizeAiUsage(contextRecord.usage),
    }),
  };
}

/**
 * @param {unknown} html
 * @returns {AiImageRefLike[]}
 */
function extractImageRefsFromHtml(html) {
  const source = coerceString(html);
  if (!source) return [];
  const container = createHtmlContainer('div', source);
  if (!container) return [];
  const figures = Array.from(container.querySelectorAll('figure'));
  /** @type {AiImageRefLike[]} */
  const refs = [];

  figures.forEach((figure, index) => {
    const img = figure.querySelector('img');
    if (!img || !img.src || img.alt === 'logo') return;
    const caption = figure.querySelector('figcaption')?.textContent?.trim() || img.alt || `配图 ${index + 1}`;
    refs.push({
      id: `image-${index + 1}`,
      src: img.src,
      alt: img.alt || caption,
      caption,
    });
  });

  return refs;
}

export {
  normalizeAiUsageTotals,
  addAiUsageToTotals,
  estimateAiUsageCost,
  isLayoutStateSkillOutdated,
  createDefaultAiSettings,
  normalizeLayoutFamily,
  normalizeColorPalette,
  normalizeResolvedLayoutFamily,
  normalizeResolvedColorPalette,
  normalizeLayoutSelection,
  normalizeResolvedSelection,
  getArticleLayoutSelectionKey,
  getLayoutFamilyList,
  getLayoutFamilyById,
  getLayoutSkillById,
  getWechatSafeRenderProfile,
  getColorPaletteList,
  getColorPaletteById,
  resolveColorPaletteForRender,
  resolveLayoutSelection,
  normalizeAiProvider,
  isAllowedAiProviderBaseUrl,
  getAiProviderIssues,
  isAiProviderRunnable,
  summarizeAiProviderIssues,
  normalizeLayoutGenerationMeta,
  normalizeSchemaValidation,
  AiLayoutSchemaError,
  normalizeArticleLayoutState,
  normalizeArticleLayoutCacheEntry,
  normalizeAiSettings,
  getArticleLayoutSelectionState,
  deriveArticleLayoutStateForSelection,
  listEnabledAiProviders,
  resolveAiProvider,
  extractRenderedSectionFragments,
  extractMarkdownSections,
  extractMarkdownSignals,
  buildFallbackLayout,
  normalizeArticleLayout,
  buildLayoutResult,
  extractImageRefsFromHtml,
};
