// 由 scripts/generate-view-mixins-types.mjs 生成，请勿手改（npm run generate:view-types）。
// 视图 mixin 的方法面：供 input.js 的 AppleStyleViewInstance 与各 mixin 的 ThisType 使用，避免 typeof mixin 自引用。
export interface ViewMixinsLike {
  // ---- views/preview/render-pipeline.js ----
  getActiveRenderPipeline(...args: unknown[]): import('../input.js').RenderPipelineLike | null;
  renderMarkdownForPreview(...args: unknown[]): Promise<string>;
  updateCurrentDoc(...args: unknown[]): void;
  setPlaceholder(...args: unknown[]): void;
  renderPlaceholderIcon(...args: unknown[]): void;
  showRenderFailurePlaceholder(...args: unknown[]): void;
  getMissingRenderNotice(...args: unknown[]): unknown;
  // ---- views/settings-panel/rednote-settings-panel.js ----
  createRednoteSettingsPanel(...args: unknown[]): void;
  openRednoteDownloadMenu(...args: unknown[]): void;
  runRednoteExport(...args: unknown[]): Promise<unknown>;
  // ---- views/publish-modal/media-assets.js ----
  srcToBlob(...args: unknown[]): Promise<Blob>;
  processAllImages(...args: unknown[]): Promise<string>;
  processMathFormulas(...args: unknown[]): Promise<string>;
  svgToPngBlob(...args: unknown[]): Promise<{ blob: Blob, width: number, height: number, style?: string }>;
  cleanHtmlForDraft(...args: unknown[]): string;
  prepareHtmlForWechatDraft(...args: unknown[]): Promise<string>;
  prepareHtmlForWechatsyncArticle(...args: unknown[]): Promise<string>;
  prepareHtmlForWechatsyncArticleViaBridge(...args: unknown[]): Promise<string>;
  generateCoverThumbnailFromAsset(...args: unknown[]): Promise<string>;
  processImagesToDataURL(...args: unknown[]): Promise<boolean>;
  convertImageToLocally(...args: unknown[]): Promise<void>;
  blobToDataUrl(...args: unknown[]): Promise<string>;
  blobToJpegDataUrl(...args: unknown[]): Promise<string>;
  // ---- views/publish-modal/wechat-sync-modal.js ----
  showSyncFailureActions(...args: unknown[]): void;
  promptConfigureWechatAccount(...args: unknown[]): void;
  preparePublishModalShell(...args: unknown[]): void;
  createPublishModeTabs(...args: unknown[]): { wechatTab: import('../input.js').ObsidianElementLike, feishuTab: import('../input.js').ObsidianElementLike, multiPlatformTab: import('../input.js').ObsidianElementLike };
  showSyncModal(...args: unknown[]): void;
  // ---- views/ai-layout/ai-layout-panel.js ----
  getCurrentArticleAnyLayoutState(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  hasCurrentArticleAiLayoutCache(...args: unknown[]): unknown;
  updateAiToolbarState(...args: unknown[]): void;
  onAiLayoutButtonClick(...args: unknown[]): void;
  createAiLayoutPanel(...args: unknown[]): void;
  getAiCustomColor(...args: unknown[]): string;
  getAiColorPaletteOverride(...args: unknown[]): { customColor: string } | null;
  getAiRenderColorPalette(...args: unknown[]): Record<string, unknown>;
  updateAiColorPaletteControls(...args: unknown[]): void;
  getAiRenderLayoutJson(...args: unknown[]): import('../input.js').AiLayoutJsonLike | null;
  onAiColorPaletteChange(...args: unknown[]): Promise<unknown>;
  onAiLayoutFamilyChange(...args: unknown[]): void;
  applyAiLayoutPanelStylePack(...args: unknown[]): void;
  getAiLayoutBlockStateKey(...args: unknown[]): string;
  getVisibleAiLayoutSnapshot(...args: unknown[]): import('../input.js').VisibleAiLayoutSnapshotLike;
  queueAiLayoutRemovalAnchor(...args: unknown[]): void;
  restoreAiLayoutPendingAnchor(...args: unknown[]): void;
  removeAiLayoutBlock(...args: unknown[]): Promise<unknown>;
  restoreRemovedAiLayoutBlocks(...args: unknown[]): Promise<unknown>;
  handleAiPrimaryAction(...args: unknown[]): Promise<unknown>;
  toggleAiLayoutDebugMode(...args: unknown[]): void;
  getCurrentLayoutContext(...args: unknown[]): import('../input.js').AiLayoutContextLike;
  getCurrentAiLayoutSelection(...args: unknown[]): import('../input.js').AiLayoutSelectionLike;
  getCurrentArticleLayoutState(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  preferFreshAiLayoutState(...args: unknown[]): import('../input.js').AiLayoutStateLike | null;
  recoverSourceFirstLayoutState(...args: unknown[]): Promise<import('../input.js').AiLayoutJsonLike | null>;
  ensureAiLayoutSelectionState(...args: unknown[]): Promise<import('../input.js').AiLayoutStateLike | null>;
  isAiLayoutPanelVisible(...args: unknown[]): unknown;
  shouldSyncAiLayoutUi(...args: unknown[]): unknown;
  getArticleLayoutProviderLabel(...args: unknown[]): string;
  getArticleLayoutModelLabel(...args: unknown[]): string;
  getAiLayoutBlockLabel(...args: unknown[]): string;
  getAiLayoutFamilyLabel(...args: unknown[]): string;
  getAiColorPaletteLabel(...args: unknown[]): string;
  getVisibleAiSchemaValidation(...args: unknown[]): import('../input.js').AiSchemaValidationLike | null;
  renderAiLayoutMetaChips(...args: unknown[]): void;
  getCurrentArticleLayoutCacheEntry(...args: unknown[]): { familyStates?: Record<string, import('../input.js').AiLayoutStateLike>, lastLayoutFamily?: string } | null;
  getCachedAiLayoutFamilyItems(...args: unknown[]): { layoutFamily: string, state: import('../input.js').AiLayoutStateLike, label: string, isCurrentContent: boolean, isStaleContent: boolean, fromAuto: boolean, updatedAt: number }[];
  renderAiCachedLayoutFamilies(...args: unknown[]): void;
  previewCachedAiLayoutFamily(...args: unknown[]): void;
  getAiPrimaryActionConfig(...args: unknown[]): { mode: string, label: string, disabled: boolean };
  refreshAiSchemaIssuePanel(...args: unknown[]): void;
  buildAiLayoutDebugJson(...args: unknown[]): string;
  buildAiLayoutErrorDetails(...args: unknown[]): string;
  buildAiLayoutDebugSnapshot(...args: unknown[]): string;
  truncateAiPromptMarkdown(...args: unknown[]): string;
  buildAiLayoutPromptContext(...args: unknown[]): string;
  copyPlainTextSnapshot(...args: unknown[]): Promise<boolean>;
  copyAiLayoutDebugSnapshot(...args: unknown[]): Promise<unknown>;
  copyAiLayoutPromptContext(...args: unknown[]): Promise<unknown>;
  refreshAiLayoutDebugPanel(...args: unknown[]): void;
  refreshAiLayoutPanel(...args: unknown[]): void;
  markAiLayoutSourceSwitch(...args: unknown[]): void;
  completeAiLayoutSourceSwitch(...args: unknown[]): void;
  isAiLayoutStaleSuppressedForPath(...args: unknown[]): unknown;
  resetAiLayoutPanelViewState(...args: unknown[]): void;
  generateAiLayoutForCurrentArticle(...args: unknown[]): Promise<unknown>;
  applyAiLayoutToPreview(...args: unknown[]): void;
  // ---- views/settings-panel/settings-panel.js ----
  applyToolbarMode(...args: unknown[]): void;
  createSettingsPanel(...args: unknown[]): unknown;
  createSection(...args: unknown[]): import('../input.js').ObsidianElementLike;
  resetSettingsPanelViewState(...args: unknown[]): void;
  onThemeChange(...args: unknown[]): Promise<unknown>;
  onFontFamilyChange(...args: unknown[]): Promise<unknown>;
  onFontSizeChange(...args: unknown[]): Promise<unknown>;
  onColorChange(...args: unknown[]): Promise<unknown>;
  onQuoteCalloutStyleModeChange(...args: unknown[]): Promise<unknown>;
  onMacCodeBlockChange(...args: unknown[]): Promise<unknown>;
  onCodeLineNumberChange(...args: unknown[]): Promise<unknown>;
  updateButtonActive(...args: unknown[]): void;
  // ---- views/publish-modal/rednote-publish.js ----
  prepareRednoteCardArticle(...args: unknown[]): Promise<{ article: Record<string, unknown>, dirPath: string, cardCount: number }>;
  // ---- views/publish-modal/cover-picker.js ----
  getWechatMaterialCacheKey(...args: unknown[]): string;
  loadWechatMaterialPage(...args: unknown[]): Promise<import('../input.js').WechatMaterialPageLike>;
  showMaterialPickerModal(...args: unknown[]): Promise<unknown>;
  getReferencedLocalImages(...args: unknown[]): Promise<import('../views/publish-modal/cover-picker.js').ReferencedImageLike[]>;
  showReferencedImagePickerModal(...args: unknown[]): Promise<void>;
  // ---- views/publish-modal/multi-platform-result-modals.js ----
  showWechatsyncEnqueueAcceptedModal(...args: unknown[]): void;
  showMultiPlatformQuotaBlockedModal(...args: unknown[]): void;
  showMultiPlatformSyncResultModal(...args: unknown[]): void;
  // ---- views/publish-modal/wechat-sync-actions.js ----
  openWechatsyncTask(...args: unknown[]): Promise<boolean>;
  getWechatsyncTaskSnapshot(...args: unknown[]): Promise<import('../input.js').WechatsyncTaskSnapshotLike | null>;
  showMultiPlatformSyncModal(...args: unknown[]): void;
  showFeishuSyncModal(...args: unknown[]): void;
  recordPublishStatus(...args: unknown[]): Promise<void>;
  onSyncToWechat(...args: unknown[]): Promise<unknown>;
  // ---- views/publish-modal/x-publish.js ----
  prepareXCardArticle(...args: unknown[]): Promise<{ article: Record<string, unknown>, dirPath: string, cardCount: number }>;
}
