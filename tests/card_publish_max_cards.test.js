// prepareCardArticle 的平台图片上限：X 单帖 ≤4 张，图卡预览超出时直接抛错（图文混排装不下会把图片拆成独立卡，卡数可能变多）
import { describe, it, expect, vi } from 'vitest';

vi.mock('../rednote/index.ts', () => ({
  DownloadManager: { exportAllImageBlobs: vi.fn(async () => Array.from({ length: 5 }, () => new Blob(['x'], { type: 'image/png' }))) },
}));

const { prepareCardArticle } = await import('../views/publish-modal/card-publish-mixin.js');

function makeView() {
  const md = '# 标题\n\n> 发布时复制下面这段作为笔记正文：\n\n正文\n\n> 下面每个二级标题（##）＝ 一张图卡：\n\n## 卡1\n文字';
  return {
    app: {
      workspace: { getActiveFile: () => ({ path: 'a.md', extension: 'md', basename: 'a' }) },
      vault: { cachedRead: async () => md },
    },
    rednoteController: { getPreviewEl: () => document.createElement('div') },
  };
}

describe('prepareCardArticle maxCards', () => {
  it('X：5 张图卡超过 4 张上限 → 抛错并说明原因', async () => {
    await expect(prepareCardArticle(makeView(), { prefix: 'x', label: 'X', sourceKind: 'x-card', maxCards: 4 }))
      .rejects.toThrow(/X 单帖最多 4 张图，当前图卡预览有 5 张/);
  });
});
