import {
  AI_LAYOUT_SKILL_VERSION,
  AI_LAYOUT_SELECTION_AUTO,
} from './ai-layout-skill-bundle.js';
import {
  AI_LAYOUT_SCHEMA_VERSION,
  AI_PROVIDER_KINDS,
  DEFAULT_AI_REQUEST_TIMEOUT_MS,
  AI_LAYOUT_FAMILY_DEFS,
  AI_COLOR_PALETTES,
  AI_USAGE_EMPTY,
  normalizeAiUsage,
  readProviderUsage,
  toSelectionRecord,
  toAiImageRefs,
  clampNumber,
  normalizeHexColor,
  coerceString,
} from './ai-layout/shared.js';
import {
  normalizeAiUsageTotals,
  addAiUsageToTotals,
  estimateAiUsageCost,
  isLayoutStateSkillOutdated,
  createDefaultAiSettings,
  normalizeLayoutFamily,
  normalizeColorPalette,
  normalizeLayoutSelection,
  normalizeResolvedSelection,
  getArticleLayoutSelectionKey,
  getLayoutFamilyList,
  getLayoutFamilyById,
  getColorPaletteList,
  getColorPaletteById,
  resolveColorPaletteForRender,
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
} from './ai-layout/core.js';
import {
  getDefaultFetch,
  AiLayoutTimeoutError,
  requestOpenAICompatibleLayout,
  requestGeminiLayout,
  requestAnthropicLayout,
} from './ai-layout/providers.js';
import { renderArticleLayoutHtml } from './ai-layout/render.js';

/** @typedef {import('./ai-layout/shared.js').AiLayoutSelectionLike} AiLayoutSelectionLike */
/** @typedef {import('./ai-layout/shared.js').AiProviderLike} AiProviderLike */
/** @typedef {import('./ai-layout/shared.js').AiUsageLike} AiUsageLike */
/** @typedef {import('./ai-layout/shared.js').AiUsageTotalsLike} AiUsageTotalsLike */
/** @typedef {import('./ai-layout/shared.js').AiImageRefLike} AiImageRefLike */
/** @typedef {import('./ai-layout/shared.js').FetchLike} FetchLike */

/**
 * @param {unknown} error
 * @param {unknown} selection
 */
function shouldUseLocalFallbackLayout(error, selection = {}) {
  const selectionRecord = toSelectionRecord(selection);
  const requestedLayoutFamily = normalizeLayoutFamily(selectionRecord.layoutFamily, AI_LAYOUT_SELECTION_AUTO);
  return requestedLayoutFamily === 'source-first' && !!error;
}

/**
 * @param {{ provider?: AiProviderLike | null, title?: unknown, markdown?: unknown, stylePack?: string, selection?: AiLayoutSelectionLike, imageRefs?: AiImageRefLike[], timeoutMs?: number, fetchImpl?: FetchLike }} options
 */
async function generateArticleLayout({
  provider,
  title,
  markdown,
  stylePack = '',
  selection = {
    layoutFamily: AI_LAYOUT_SELECTION_AUTO,
    colorPalette: AI_LAYOUT_SELECTION_AUTO,
  },
  imageRefs = [],
  timeoutMs = DEFAULT_AI_REQUEST_TIMEOUT_MS,
  fetchImpl = getDefaultFetch(),
}) {
  const safeProvider = provider ? normalizeAiProvider(provider) : null;
  const safeTitle = coerceString(title);
  const safeMarkdown = coerceString(markdown);
  const safeSelection = normalizeLayoutSelection(selection, {
    layoutFamily: AI_LAYOUT_SELECTION_AUTO,
    colorPalette: AI_LAYOUT_SELECTION_AUTO,
  });
  const safeStylePack = normalizeColorPalette(stylePack, AI_LAYOUT_SELECTION_AUTO);
  const safeImageRefs = toAiImageRefs(imageRefs);
  const requestedTimeoutMs = Number.isFinite(Number(timeoutMs)) ? Number(timeoutMs) : DEFAULT_AI_REQUEST_TIMEOUT_MS;
  const safeTimeoutMs = clampNumber(requestedTimeoutMs, DEFAULT_AI_REQUEST_TIMEOUT_MS, 1000, 180000);
  if (!safeMarkdown) throw new Error('文章内容为空，无法进行 AI 编排');
  const signals = extractMarkdownSignals(safeMarkdown);
  const sourceSections = extractMarkdownSections(safeMarkdown).sections;
  const requestedLayoutFamily = normalizeLayoutFamily(safeSelection.layoutFamily, AI_LAYOUT_SELECTION_AUTO);

  /** @type {Record<string, unknown>} */
  let rawLayout;
  /** @type {AiUsageLike} */
  let usage = AI_USAGE_EMPTY;
  if (!safeProvider) {
    if (requestedLayoutFamily !== 'source-first') {
      throw new Error('未找到可用的 AI Provider');
    }
    rawLayout = {
      articleType: 'article',
      title: safeTitle,
      summary: '',
      fallbackUsed: true,
      blocks: [],
    };
  } else {
    if (typeof fetchImpl !== 'function') throw new Error('当前环境不支持 AI 网络请求');
    try {
      switch (safeProvider.kind) {
        case AI_PROVIDER_KINDS.OPENAI_COMPATIBLE:
          ({ rawLayout, usage } = await requestOpenAICompatibleLayout({
            provider: safeProvider,
            title: safeTitle,
            markdown: safeMarkdown,
            selection: safeSelection,
            stylePack: safeStylePack,
            imageRefs: safeImageRefs,
            timeoutMs: requestedTimeoutMs,
            abortTimeoutMs: safeTimeoutMs,
            fetchImpl: /** @type {FetchLike} */ (fetchImpl),
          }));
          break;
        case AI_PROVIDER_KINDS.GEMINI:
          ({ rawLayout, usage } = await requestGeminiLayout({
            provider: safeProvider,
            title: safeTitle,
            markdown: safeMarkdown,
            selection: safeSelection,
            stylePack: safeStylePack,
            imageRefs: safeImageRefs,
            timeoutMs: requestedTimeoutMs,
            abortTimeoutMs: safeTimeoutMs,
            fetchImpl: /** @type {FetchLike} */ (fetchImpl),
          }));
          break;
        case AI_PROVIDER_KINDS.ANTHROPIC:
          ({ rawLayout, usage } = await requestAnthropicLayout({
            provider: safeProvider,
            title: safeTitle,
            markdown: safeMarkdown,
            selection: safeSelection,
            stylePack: safeStylePack,
            imageRefs: safeImageRefs,
            timeoutMs: requestedTimeoutMs,
            abortTimeoutMs: safeTimeoutMs,
            fetchImpl: /** @type {FetchLike} */ (fetchImpl),
          }));
          break;
        default:
          throw new Error(`暂不支持的 AI Provider 类型: ${safeProvider.kind}`);
      }
    } catch (error) {
      if (!shouldUseLocalFallbackLayout(error, safeSelection)) {
        throw error;
      }
      rawLayout = {
        articleType: 'article',
        title: safeTitle,
        summary: '',
        fallbackUsed: true,
        blocks: [],
      };
    }
  }

  try {
    return buildLayoutResult(rawLayout, {
      title: safeTitle,
      selection: safeSelection,
      stylePack: safeStylePack,
      imageRefs: safeImageRefs,
      markdown: safeMarkdown,
      provider: safeProvider,
      signals,
      sourceSections,
      usage,
    });
  } catch (error) {
    if (!shouldUseLocalFallbackLayout(error, safeSelection)) {
      throw error;
    }
    return buildLayoutResult({
      articleType: 'article',
      title: safeTitle,
      summary: '',
      fallbackUsed: true,
      blocks: [],
    }, {
      title: safeTitle,
      selection: safeSelection,
      stylePack: safeStylePack,
      imageRefs: safeImageRefs,
      markdown: safeMarkdown,
      provider: null,
      signals,
      sourceSections,
      usage,
    });
  }
}

/**
 * @param {AiProviderLike} provider
 * @param {FetchLike | undefined} [fetchImpl=getDefaultFetch()]
 * @returns {Promise<boolean>}
 */
async function testAiProviderConnection(provider, fetchImpl = getDefaultFetch()) {
  const result = await generateArticleLayout({
    provider,
    title: '连接测试',
    markdown: '这是一个连接测试。请输出最小可用的教程排版 JSON。',
    selection: {
      layoutFamily: 'tutorial-cards',
      colorPalette: 'tech-green',
    },
    imageRefs: [],
    timeoutMs: 15000,
    fetchImpl,
  });
  return !!result?.layoutJson?.blocks?.length;
}

export {
  AI_LAYOUT_SCHEMA_VERSION,
  AI_LAYOUT_SKILL_VERSION,
  AI_LAYOUT_SELECTION_AUTO,
  AI_LAYOUT_FAMILY_DEFS,
  AI_PROVIDER_KINDS,
  AI_COLOR_PALETTES,
  createDefaultAiSettings,
  normalizeAiSettings,
  normalizeAiProvider,
  isAllowedAiProviderBaseUrl,
  getAiProviderIssues,
  isAiProviderRunnable,
  summarizeAiProviderIssues,
  normalizeArticleLayoutState,
  normalizeArticleLayoutCacheEntry,
  normalizeAiUsage,
  readProviderUsage,
  normalizeAiUsageTotals,
  addAiUsageToTotals,
  estimateAiUsageCost,
  isLayoutStateSkillOutdated,
  AI_USAGE_EMPTY,
  normalizeSchemaValidation,
  normalizeLayoutFamily,
  normalizeColorPalette,
  normalizeLayoutSelection,
  normalizeResolvedSelection,
  getArticleLayoutSelectionKey,
  getArticleLayoutSelectionState,
  getLayoutFamilyList,
  getLayoutFamilyById,
  getColorPaletteList,
  getColorPaletteById,
  resolveColorPaletteForRender,
  normalizeHexColor,
  listEnabledAiProviders,
  resolveAiProvider,
  deriveArticleLayoutStateForSelection,
  extractImageRefsFromHtml,
  extractRenderedSectionFragments,
  extractMarkdownSections,
  extractMarkdownSignals,
  buildFallbackLayout,
  normalizeArticleLayout,
  normalizeLayoutGenerationMeta,
  buildLayoutResult,
  AiLayoutSchemaError,
  AiLayoutTimeoutError,
  generateArticleLayout,
  renderArticleLayoutHtml,
  testAiProviderConnection,
};
