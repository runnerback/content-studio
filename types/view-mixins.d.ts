// 由 scripts/generate-view-mixins-types.mjs 生成，请勿手改（npm run generate:view-types）。
// 视图 mixin 的方法面：供 input.js 的 AppleStyleViewInstance 与各 mixin 的 ThisType 使用，避免 typeof mixin 自引用。
export interface ViewMixinsLike {
  // ---- views/preview/render-pipeline.js ----
  getActiveRenderPipeline(...args: unknown[]): import('../input.js').RenderPipelineLike | null;
  renderMarkdownForPreview(...args: unknown[]): Promise<import('../input.js').RenderPipelineLike | null>;
  updateCurrentDoc(...args: unknown[]): import('../input.js').RenderPipelineLike | null;
  setPlaceholder(...args: unknown[]): import('../input.js').RenderPipelineLike | null;
  renderPlaceholderIcon(...args: unknown[]): import('../input.js').RenderPipelineLike | null;
  showRenderFailurePlaceholder(...args: unknown[]): void;
  getMissingRenderNotice(...args: unknown[]): unknown;
  // ---- views/settings-panel/rednote-settings-panel.js ----
  createRednoteSettingsPanel(...args: unknown[]): void;
  openRednoteDownloadMenu(...args: unknown[]): void;
  runRednoteExport(...args: unknown[]): Promise<unknown>;
  // ---- views/publish-modal/media-assets.js ----
  srcToBlob(...args: unknown[]): Promise<Blob>;
  processAllImages(...args: unknown[]): Promise<Blob>;
  processMathFormulas(...args: unknown[]): Promise<Blob>;
  svgToPngBlob(...args: unknown[]): Promise<Blob>;
  cleanHtmlForDraft(...args: unknown[]): Promise<Blob>;
  prepareHtmlForWechatDraft(...args: unknown[]): Promise<Blob>;
  prepareHtmlForWechatsyncArticle(...args: unknown[]): Promise<Blob>;
  prepareHtmlForWechatsyncArticleViaBridge(...args: unknown[]): Promise<Blob>;
  generateCoverThumbnailFromAsset(...args: unknown[]): Promise<Blob>;
  processImagesToDataURL(...args: unknown[]): Promise<Blob>;
  convertImageToLocally(...args: unknown[]): Promise<Blob>;
  blobToDataUrl(...args: unknown[]): Promise<Blob>;
  blobToJpegDataUrl(...args: unknown[]): Promise<Blob>;
  // ---- views/publish-modal/wechat-sync-modal.js ----
  showSyncFailureActions(...args: unknown[]): void;
  promptConfigureWechatAccount(...args: unknown[]): void;
  preparePublishModalShell(...args: unknown[]): void;
  createPublishModeTabs(...args: unknown[]): { wechatTab: import('../input.js').ObsidianElementLike, multiPlatformTab: import('../input.js').ObsidianElementLike };
  showSyncModal(...args: unknown[]): { wechatTab: import('../input.js').ObsidianElementLike, multiPlatformTab: import('../input.js').ObsidianElementLike };
  // ---- views/ai-layout/ai-layout-panel.js ----
  getCurrentArticleAnyLayoutState(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  hasCurrentArticleAiLayoutCache(...args: unknown[]): unknown;
  updateAiToolbarState(...args: unknown[]): void;
  onAiLayoutButtonClick(...args: unknown[]): void;
  createAiLayoutPanel(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  getAiCustomColor(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  getAiColorPaletteOverride(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  getAiRenderColorPalette(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  updateAiColorPaletteControls(...args: unknown[]): void;
  getAiRenderLayoutJson(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  onAiColorPaletteChange(...args: unknown[]): Promise<import('../input.js').AiLayoutStateLike | null>;
  onAiLayoutFamilyChange(...args: unknown[]): Promise<import('../input.js').AiLayoutStateLike | null>;
  applyAiLayoutPanelStylePack(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  getAiLayoutBlockStateKey(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  getVisibleAiLayoutSnapshot(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  queueAiLayoutRemovalAnchor(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  restoreAiLayoutPendingAnchor(...args: unknown[]): void;
  removeAiLayoutBlock(...args: unknown[]): Promise<import('../input.js').AiLayoutStateLike | null>;
  restoreRemovedAiLayoutBlocks(...args: unknown[]): Promise<unknown>;
  handleAiPrimaryAction(...args: unknown[]): Promise<unknown>;
  toggleAiLayoutDebugMode(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  getCurrentLayoutContext(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  getCurrentAiLayoutSelection(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  getCurrentArticleLayoutState(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  preferFreshAiLayoutState(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  recoverSourceFirstLayoutState(...args: unknown[]): Promise<import('../input.js').AiLayoutStateLike | null>;
  ensureAiLayoutSelectionState(...args: unknown[]): Promise<import('../input.js').AiLayoutStateLike | null>;
  isAiLayoutPanelVisible(...args: unknown[]): unknown;
  shouldSyncAiLayoutUi(...args: unknown[]): unknown;
  getArticleLayoutProviderLabel(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  getArticleLayoutModelLabel(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  getAiLayoutBlockLabel(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  getAiLayoutFamilyLabel(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  getAiColorPaletteLabel(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  getVisibleAiSchemaValidation(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  renderAiLayoutMetaChips(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  getCurrentArticleLayoutCacheEntry(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  renderAiCachedLayoutFamilies(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  previewCachedAiLayoutFamily(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  getAiPrimaryActionConfig(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  refreshAiSchemaIssuePanel(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  buildAiLayoutDebugJson(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  buildAiLayoutErrorDetails(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  buildAiLayoutDebugSnapshot(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  truncateAiPromptMarkdown(...args: unknown[]): unknown;
  buildAiLayoutPromptContext(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  copyPlainTextSnapshot(...args: unknown[]): Promise<import('../input.js').AiLayoutStateLike | null>;
  copyAiLayoutDebugSnapshot(...args: unknown[]): Promise<unknown>;
  copyAiLayoutPromptContext(...args: unknown[]): Promise<unknown>;
  refreshAiLayoutDebugPanel(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  refreshAiLayoutPanel(...args: unknown[]): void;
  markAiLayoutSourceSwitch(...args: unknown[]): void;
  completeAiLayoutSourceSwitch(...args: unknown[]): void;
  isAiLayoutStaleSuppressedForPath(...args: unknown[]): unknown;
  resetAiLayoutPanelViewState(...args: unknown[]): void;
  generateAiLayoutForCurrentArticle(...args: unknown[]): Promise<unknown>;
  applyAiLayoutToPreview(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  // ---- views/settings-panel/settings-panel.js ----
  applyToolbarMode(...args: unknown[]): void;
  createSettingsPanel(...args: unknown[]): unknown;
  createSection(...args: unknown[]): import('../input.js').ObsidianElementLike;
  resetSettingsPanelViewState(...args: unknown[]): void;
  onThemeChange(...args: unknown[]): Promise<import('../input.js').ObsidianElementLike>;
  onFontFamilyChange(...args: unknown[]): Promise<import('../input.js').ObsidianElementLike>;
  onFontSizeChange(...args: unknown[]): Promise<import('../input.js').ObsidianElementLike>;
  onColorChange(...args: unknown[]): Promise<import('../input.js').ObsidianElementLike>;
  onQuoteCalloutStyleModeChange(...args: unknown[]): Promise<import('../input.js').ObsidianElementLike>;
  onMacCodeBlockChange(...args: unknown[]): Promise<import('../input.js').ObsidianElementLike>;
  onCodeLineNumberChange(...args: unknown[]): Promise<import('../input.js').ObsidianElementLike>;
  updateButtonActive(...args: unknown[]): import('../input.js').ObsidianElementLike;
  // ---- views/publish-modal/rednote-publish.js ----
  prepareRednoteCardArticle(...args: unknown[]): Promise<{ article: Record<string, unknown>, dirPath: string, cardCount: number }>;
  // ---- views/publish-modal/cover-picker.js ----
  getWechatMaterialCacheKey(...args: unknown[]): string;
  loadWechatMaterialPage(...args: unknown[]): Promise<string>;
  showMaterialPickerModal(...args: unknown[]): Promise<string>;
  getReferencedLocalImages(...args: unknown[]): Promise<string>;
  showReferencedImagePickerModal(...args: unknown[]): Promise<string>;
  // ---- views/publish-modal/multi-platform-result-modals.js ----
  showWechatsyncEnqueueAcceptedModal(...args: unknown[]): unknown;
  showMultiPlatformQuotaBlockedModal(...args: unknown[]): unknown[];
  showMultiPlatformSyncResultModal(...args: unknown[]): unknown[];
  // ---- views/publish-modal/wechat-sync-actions.js ----
  openWechatsyncTask(...args: unknown[]): Promise<boolean>;
  getWechatsyncTaskSnapshot(...args: unknown[]): Promise<boolean>;
  showMultiPlatformSyncModal(...args: unknown[]): Promise<boolean>;
  showFeishuSyncModal(...args: unknown[]): Promise<boolean>;
  recordPublishStatus(...args: unknown[]): Promise<boolean>;
  onSyncToWechat(...args: unknown[]): Promise<boolean>;
  // ---- views/publish-modal/x-publish.js ----
  prepareXCardArticle(...args: unknown[]): Promise<{ article: Record<string, unknown>, dirPath: string, cardCount: number }>;
}
