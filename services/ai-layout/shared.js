// AI 编排：共享常量、typedef 与小工具（叶子模块，不依赖其它 ai-layout 子模块）
import {
  AI_LAYOUT_FAMILIES,
  getAiLayoutSkillList,
  getAiLayoutSharedResources,
} from '../ai-layout-skill-bundle.js';
import { toText } from '../input-utils.js';

/**
 * @typedef {{ type: string, fields: string[] }} AiLayoutBlockDefinition
 * @typedef {{ id: string, label: string, description?: string, recommendedFor?: string[], tokens?: Record<string, string> }} AiLayoutColorPalette
 * @typedef {{ id: string, label?: string, description?: string, version?: string }} AiLayoutSkillManifest
 * @typedef {{ id: string, label: string, description?: string, version?: string, manifest: AiLayoutSkillManifest, prompt: string, blocks: unknown, fallback: unknown }} AiLayoutSkill
 * @typedef {{ typography?: Record<string, unknown>, image?: Record<string, unknown>, profiles?: Record<string, Record<string, unknown>>, sectionLabels?: Record<string, string>, allowedCssNotes?: unknown[] }} AiLayoutStylePrimitives
 * @typedef {{ version?: string, colorPalettes?: { colorPalettes?: AiLayoutColorPalette[] }, blockCatalog?: { blocks?: AiLayoutBlockDefinition[], outputFields?: string[] }, wechatSafeStylePrimitives?: AiLayoutStylePrimitives, schema?: Record<string, unknown>, template?: Record<string, unknown> }} AiLayoutSharedResources
 * @typedef {{ layoutFamily?: string, layout?: string, family?: string, colorPalette?: string, palette?: string, stylePack?: string }} AiLayoutSelectionLike
 * @typedef {{ layoutFamily?: string, colorPalette?: string }} AiLayoutResolvedSelectionLike
 * @typedef {{ baseUrl?: string, apiKey?: string, model?: string, id?: string, kind?: string, name?: string, enabled?: boolean }} AiProviderLike
 * @typedef {{ customColor?: string, accentColor?: string, accent?: string }} AiColorPaletteOverride
 * @typedef {{ path?: string, message?: string, fatal?: boolean }} AiLayoutSchemaIssue
 * @typedef {{ isValid?: boolean, fatal?: boolean, issueCount?: number, issues?: AiLayoutSchemaIssue[] }} AiLayoutSchemaValidationLike
 * @typedef {{ index?: number, type?: string, source?: 'ai' | 'fallback', label?: string }} AiLayoutBlockOriginLike
 * @typedef {{ promptTokens: number, completionTokens: number, totalTokens: number }} AiUsageLike
 * @typedef {{ requests: number, promptTokens: number, completionTokens: number, totalTokens: number, updatedAt: number }} AiUsageTotalsLike
 * @typedef {{ providerName?: string, providerModel?: string, skillId?: string, skillLabel?: string, skillVersion?: string, executionMode?: string, layoutFamilyLabel?: string, colorPaletteLabel?: string, stylePackLabel?: string, recommendedLayoutFamilyLabel?: string, recommendedColorPaletteLabel?: string, headingCount?: number, sectionCount?: number, leadParagraphCount?: number, bulletGroupCount?: number, imageCount?: number, aiBlockCount?: number, finalBlockCount?: number, fallbackUsed?: boolean, fallbackBlockCount?: number, fallbackBlockTypes?: string[], schemaValidation?: AiLayoutSchemaValidationLike, blockOrigins?: AiLayoutBlockOriginLike[], usage?: AiUsageLike } AiLayoutGenerationMetaLike
 * @typedef {{ version?: number, updatedAt?: number, sourceHash?: string, providerId?: string, model?: string, skillId?: string, skillVersion?: string, selection?: AiLayoutSelectionLike, resolved?: AiLayoutResolvedSelectionLike, recommendedLayoutFamily?: string, recommendedColorPalette?: string, stylePack?: string, layoutFamily?: string, status?: 'ready'|'error'|'schema-error', lastError?: string, lastAttemptStatus?: 'idle'|'success'|'error'|'schema-error', lastAttemptError?: string, lastAttemptAt?: number, lastAttemptSchemaValidation?: AiLayoutSchemaValidationLike, dismissedBlockKeys?: string[], generationMeta?: AiLayoutGenerationMetaLike, layoutJson?: Record<string, unknown> } AiLayoutStateLike
 * @typedef {{ type?: string, label?: string, text?: string, title?: string, summary?: string, caseLabel?: string, highlight?: string, note?: string, imageId?: string, coverImageId?: string, variant?: string, eyebrow?: string, subtitle?: string, sectionIndex?: number|string, sectionLabel?: string, headingLevel?: number, paragraphs?: string[], bulletGroups?: string[][], bullets?: string[], callouts?: AiLayoutCalloutLike[], imageIds?: string[], items?: Array<{ label?: string, text?: string, title?: string }>, subsections?: AiLayoutSubsectionLike[], quote?: string }} AiLayoutBlockLike
 * @typedef {{ type?: string, title?: string, body?: string }} AiLayoutCalloutLike
 * @typedef {{ title?: string, heading?: string, level?: number, paragraphs?: string[], bulletGroups?: string[][], callouts?: AiLayoutCalloutLike[] }} AiLayoutSubsectionLike
 * @typedef {{ title?: string, heading?: string, index?: number|string, level?: number, paragraphs?: string[], bulletGroups?: string[][], callouts?: AiLayoutCalloutLike[], subsections?: AiLayoutSubsectionLike[] }} AiLayoutSourceSectionLike
 * @typedef {{ headings: string[], sectionTitles: string[], paragraphs: string[], leadParagraphs: string[], bulletGroups: string[][], lastParagraph: string }} MarkdownSignals
 * @typedef {{ level: number, text: string }} MarkdownHeading
 * @typedef {{ type: string, title: string, body: string }} MarkdownCallout
 * @typedef {{ level?: number, title: string, paragraphs: string[], bulletGroups: string[][], callouts: MarkdownCallout[] }} MarkdownSubsection
 * @typedef {{ index: number, level: number, title: string, paragraphs: string[], bulletGroups: string[][], callouts: MarkdownCallout[], subsections: MarkdownSubsection[] }} MarkdownSection
 * @typedef {{ introParagraphs: string[], introBulletGroups: string[][], introCallouts: MarkdownCallout[], headings: MarkdownHeading[], sections: MarkdownSection[] }} MarkdownStructure
 * @typedef {{ id?: string, src?: string, alt?: string, caption?: string }} AiImageRefLike
 * @typedef {{ accent?: string, accentDeep?: string, accentSoft?: string, text?: string, muted?: string, border?: string, surface?: string, surfaceSoft?: string, quoteBg?: string }} AiColorTokens
 * @typedef {{ articleType?: string, selection?: AiLayoutSelectionLike, resolved?: AiLayoutResolvedSelectionLike, recommendedLayoutFamily?: string, recommendedColorPalette?: string, title?: string, summary?: string, stylePack?: string, layoutFamily?: string, blocks?: AiLayoutBlockLike[] }} AiLayoutJsonLike
 * @typedef {{ lastLayoutFamily?: string, lastAutoResolvedFamily?: string, familyStates?: Record<string, AiLayoutStateLike>, lastSelectionKey?: string, selectionStates?: Record<string, AiLayoutStateLike>, lastStylePack?: string, stylePackStates?: Record<string, AiLayoutStateLike> }} AiLayoutCacheEntryLike
 * @typedef {{ title?: string, leadHtml?: string, subsections?: RenderedSubsectionFragmentLike[] }} RenderedSectionFragmentLike
 * @typedef {{ title?: string, titleKey?: string, contentHtml?: string }} RenderedSubsectionFragmentLike
 * @typedef {{ ok: boolean, status: number, statusText?: string, text: () => Promise<string>, json: () => Promise<unknown> }} FetchResponseLike
 * @typedef {(url: string, options: Record<string, unknown>) => Promise<FetchResponseLike>} FetchLike
 */

const AI_LAYOUT_SCHEMA_VERSION = 1;

const AI_PROVIDER_KINDS = {
  OPENAI_COMPATIBLE: 'openai-compatible',
  GEMINI: 'gemini',
  ANTHROPIC: 'anthropic',
};

const MAX_LAYOUT_BLOCKS = 24;
const MAX_PART_NAV_ITEMS = 6;
const MAX_CASE_BLOCK_BULLETS = 6;
const MAX_CASE_BLOCK_IMAGE_IDS = 4;
const ANTHROPIC_LAYOUT_MAX_TOKENS = 8192;
const DEFAULT_AI_REQUEST_TIMEOUT_MS = 120000;
const AI_LAYOUT_DEFAULT_FAMILY = 'source-first';
const AI_LAYOUT_DEFAULT_COLOR_PALETTE = 'tech-green';
/** @type {Set<string>} */
const AI_LAYOUT_IMPLEMENTED_FAMILIES = new Set(AI_LAYOUT_FAMILIES);
/** @type {Record<string, string>} */
const AI_LAYOUT_RESERVED_FAMILY_FALLBACKS = {};
/** @type {AiLayoutSharedResources} */
const AI_LAYOUT_SHARED_RESOURCES = getAiLayoutSharedResources();
/** @type {AiLayoutSkill[]} */
const AI_LAYOUT_SKILL_LIST = getAiLayoutSkillList();
/** @type {Record<string, AiLayoutSkill>} */
const AI_LAYOUT_FAMILY_DEFS = AI_LAYOUT_SKILL_LIST.reduce((acc, skill) => {
  acc[skill.id] = {
    id: skill.id,
    label: skill.manifest.label,
    description: skill.manifest.description || '',
    version: skill.manifest.version,
    manifest: skill.manifest,
    prompt: skill.prompt,
    blocks: skill.blocks,
    fallback: skill.fallback,
  };
  return acc;
}, /** @type {Record<string, AiLayoutSkill>} */ ({}));

/** @type {Record<string, AiLayoutColorPalette>} */
const AI_COLOR_PALETTES = (AI_LAYOUT_SHARED_RESOURCES.colorPalettes?.colorPalettes || []).reduce((acc, palette) => {
  acc[palette.id] = {
    id: palette.id,
    label: palette.label,
    description: palette.description || '',
    recommendedFor: Array.isArray(palette.recommendedFor) ? palette.recommendedFor.slice() : [],
    tokens: { ...(palette.tokens || {}) },
  };
  return acc;
}, /** @type {Record<string, AiLayoutColorPalette>} */ ({}));

/** @type {AiLayoutStylePrimitives} */
const AI_WECHAT_SAFE_STYLE_PRIMITIVES = AI_LAYOUT_SHARED_RESOURCES.wechatSafeStylePrimitives || {
  typography: {},
  image: {},
  profiles: {},
  sectionLabels: {},
};

const AI_PROVIDER_KIND_DEFAULTS = {
  [AI_PROVIDER_KINDS.OPENAI_COMPATIBLE]: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
  },
  [AI_PROVIDER_KINDS.GEMINI]: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-flash',
  },
  [AI_PROVIDER_KINDS.ANTHROPIC]: {
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-5-haiku-latest',
  },
};

// ---- 用量（3.12.0 费用可见性）：每次编排记录各家返回的 token 数，累计到 settings.ai.usageTotals ----
/** @type {AiUsageLike} */
const AI_USAGE_EMPTY = Object.freeze({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });

/**
 * @param {unknown} value
 * @returns {number}
 */
function toTokenCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/**
 * @param {unknown} [raw={}]
 * @returns {AiUsageLike}
 */
function normalizeAiUsage(raw = {}) {
  const source = toRecord(raw);
  const promptTokens = toTokenCount(source.promptTokens);
  const completionTokens = toTokenCount(source.completionTokens);
  const totalTokens = toTokenCount(source.totalTokens) || promptTokens + completionTokens;
  return { promptTokens, completionTokens, totalTokens };
}

/**
 * 从各家响应体读 token 用量：OpenAI 兼容 usage.*_tokens；Gemini usageMetadata.*TokenCount；Anthropic usage.input/output_tokens。
 * 没有用量字段时返回全 0（不猜）。
 * @param {string} kind AI_PROVIDER_KINDS 之一
 * @param {unknown} data 响应 JSON
 * @returns {AiUsageLike}
 */
function readProviderUsage(kind, data) {
  const source = toRecord(data);
  if (kind === AI_PROVIDER_KINDS.GEMINI) {
    const meta = toRecord(source.usageMetadata);
    return normalizeAiUsage({ promptTokens: meta.promptTokenCount, completionTokens: meta.candidatesTokenCount, totalTokens: meta.totalTokenCount });
  }
  const usage = toRecord(source.usage);
  if (kind === AI_PROVIDER_KINDS.ANTHROPIC) {
    return normalizeAiUsage({ promptTokens: usage.input_tokens, completionTokens: usage.output_tokens });
  }
  return normalizeAiUsage({ promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens, totalTokens: usage.total_tokens });
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {AiLayoutSelectionLike}
 */
function toSelectionRecord(value) {
  return isRecord(value) ? /** @type {AiLayoutSelectionLike} */ (value) : {};
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function toRecord(value) {
  return isRecord(value) ? /** @type {Record<string, unknown>} */ (value) : {};
}

/**
 * @param {unknown} value
 * @returns {AiLayoutBlockLike[]}
 */
function toAiLayoutBlocks(value) {
  return Array.isArray(value)
    ? value.map((item) => /** @type {AiLayoutBlockLike} */ (toRecord(item)))
    : [];
}

/**
 * @param {unknown} value
 * @returns {AiImageRefLike[]}
 */
function toAiImageRefs(value) {
  return Array.isArray(value)
    ? value.map((image) => /** @type {AiImageRefLike} */ (toRecord(image)))
    : [];
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

/**
 * @param {unknown} value
 * @param {string} [fallback='#7c3aed']
 * @returns {string}
 */
function normalizeHexColor(value, fallback = '#7c3aed') {
  const raw = toText(value).trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw.toLowerCase()}`;
  return fallback;
}

/**
 * @param {unknown} value
 * @param {string} [fallback='']
 * @returns {string}
 */
function coerceString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeTitleKey(value) {
  return coerceString(value).toLowerCase().replace(/\s+/g, '');
}

function summarizeText(value, maxLength = 80) {
  const text = coerceString(value).replace(/\s+/g, ' ');
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

export {
  AI_LAYOUT_SCHEMA_VERSION,
  AI_PROVIDER_KINDS,
  MAX_LAYOUT_BLOCKS,
  MAX_PART_NAV_ITEMS,
  MAX_CASE_BLOCK_BULLETS,
  MAX_CASE_BLOCK_IMAGE_IDS,
  ANTHROPIC_LAYOUT_MAX_TOKENS,
  DEFAULT_AI_REQUEST_TIMEOUT_MS,
  AI_LAYOUT_DEFAULT_FAMILY,
  AI_LAYOUT_DEFAULT_COLOR_PALETTE,
  AI_LAYOUT_IMPLEMENTED_FAMILIES,
  AI_LAYOUT_RESERVED_FAMILY_FALLBACKS,
  AI_LAYOUT_SKILL_LIST,
  AI_LAYOUT_FAMILY_DEFS,
  AI_COLOR_PALETTES,
  AI_WECHAT_SAFE_STYLE_PRIMITIVES,
  AI_PROVIDER_KIND_DEFAULTS,
  AI_USAGE_EMPTY,
  toTokenCount,
  normalizeAiUsage,
  readProviderUsage,
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
};
