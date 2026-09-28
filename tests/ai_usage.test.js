// tests/ai_usage.test.js
//
// 3.12.0 AI 编排费用可见性 + 缓存失效规则：
//   各家响应体 → 统一 usage；累计与费用估算纯函数；settings.ai 里的 usageTotals / 单价归一化；技能版本过期判定。
import { describe, it, expect } from 'vitest';

if (typeof window.require !== 'function') window.require = require;

const {
  normalizeAiUsage,
  readProviderUsage,
  normalizeAiUsageTotals,
  addAiUsageToTotals,
  estimateAiUsageCost,
  isLayoutStateSkillOutdated,
  normalizeAiSettings,
  createDefaultAiSettings,
  getLayoutFamilyList,
  AI_PROVIDER_KINDS,
  AI_USAGE_EMPTY,
} = require('../services/ai-layout.js');

describe('用量归一与各家响应读取', () => {
  it('OpenAI 兼容 usage.*_tokens', () => {
    expect(readProviderUsage(AI_PROVIDER_KINDS.OPENAI_COMPATIBLE, { usage: { prompt_tokens: 1200, completion_tokens: 300, total_tokens: 1500 } }))
      .toEqual({ promptTokens: 1200, completionTokens: 300, totalTokens: 1500 });
  });
  it('Gemini usageMetadata.*TokenCount；Anthropic usage.input/output_tokens（total 由两者相加）', () => {
    expect(readProviderUsage(AI_PROVIDER_KINDS.GEMINI, { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } }))
      .toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    expect(readProviderUsage(AI_PROVIDER_KINDS.ANTHROPIC, { usage: { input_tokens: 7, output_tokens: 3 } }))
      .toEqual({ promptTokens: 7, completionTokens: 3, totalTokens: 10 });
  });
  it('没有用量字段 → 全 0，不猜；非法值当 0', () => {
    expect(readProviderUsage(AI_PROVIDER_KINDS.OPENAI_COMPATIBLE, { choices: [] })).toEqual(AI_USAGE_EMPTY);
    expect(normalizeAiUsage({ promptTokens: -5, completionTokens: 'x', totalTokens: 2.6 })).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 3 });
  });
});

describe('累计与费用估算', () => {
  it('addAiUsageToTotals 计次并累加，返回新对象', () => {
    const base = normalizeAiUsageTotals({});
    const once = addAiUsageToTotals(base, { promptTokens: 100, completionTokens: 50 }, 1000);
    expect(once).toEqual({ requests: 1, promptTokens: 100, completionTokens: 50, totalTokens: 150, updatedAt: 1000 });
    const twice = addAiUsageToTotals(once, { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, 2000);
    expect(twice).toEqual({ requests: 2, promptTokens: 110, completionTokens: 55, totalTokens: 165, updatedAt: 2000 });
    expect(base.requests).toBe(0);
  });
  it('单价（元 / 百万 tokens）未填 → null；填了按输入 / 输出分别计价', () => {
    expect(estimateAiUsageCost({ promptTokens: 1_000_000, completionTokens: 500_000 }, { input: 0, output: 0 })).toBeNull();
    expect(estimateAiUsageCost({ promptTokens: 1_000_000, completionTokens: 500_000 }, { input: 2, output: 8 })).toBe(6);
    expect(estimateAiUsageCost({ promptTokens: 250_000, completionTokens: 0 }, { input: 4 })).toBe(1);
  });
  it('normalizeAiSettings 给出 usageTotals 与 usagePricePerMillion 的默认值并归一', () => {
    const defaults = normalizeAiSettings(createDefaultAiSettings());
    expect(defaults.usageTotals).toEqual({ requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, updatedAt: 0 });
    expect(defaults.usagePricePerMillion).toEqual({ input: 0, output: 0 });
    const custom = normalizeAiSettings({ usageTotals: { requests: 3, promptTokens: 30, completionTokens: 9 }, usagePricePerMillion: { input: 2, output: -1 } });
    expect(custom.usageTotals).toMatchObject({ requests: 3, promptTokens: 30, completionTokens: 9, totalTokens: 39 });
    expect(custom.usagePricePerMillion).toEqual({ input: 2, output: 0 });
  });
});

describe('技能版本过期判定', () => {
  const [family] = getLayoutFamilyList({ includeAuto: false });
  it('记录的 skillVersion 与当前技能版本不同 → 过期；相同或缺失 → 不过期', () => {
    const current = family.version;
    const state = { resolved: { layoutFamily: family.id }, skillVersion: current, layoutJson: { blocks: [{ type: 'p' }] } };
    expect(isLayoutStateSkillOutdated(state)).toBe(false);
    expect(isLayoutStateSkillOutdated({ ...state, skillVersion: `${current}-old` })).toBe(true);
    expect(isLayoutStateSkillOutdated({ ...state, skillVersion: '', generationMeta: { skillVersion: `${current}-old` } })).toBe(true);
    expect(isLayoutStateSkillOutdated({ ...state, skillVersion: '' })).toBe(false);
    expect(isLayoutStateSkillOutdated(null)).toBe(false);
  });
});
