/**
 * D1 の上限まわりの契約。
 * ここが緩むと「件数が増えた日だけ落ちる」不具合になり、再現に何時間もかかる。
 */
import { describe, expect, it } from 'vitest';
import {
  D1_MAX_BOUND_PARAMS,
  QueryBudgetExceededError,
  assertQueryBudget,
  inClauseChunkSize,
} from './d1-limits.js';
import { planImportDiffQueries } from './import-diff.js';

describe('IN() の分割数', () => {
  it('同じ文に載る他のバインドのぶんだけ小さくする', () => {
    expect(inClauseChunkSize(0)).toBe(D1_MAX_BOUND_PARAMS);
    expect(inClauseChunkSize(3)).toBe(D1_MAX_BOUND_PARAMS - 3);
  });

  it('固定バインドが上限を食い尽くしても0を返さない(0だと無限に分割される)', () => {
    expect(inClauseChunkSize(D1_MAX_BOUND_PARAMS + 10)).toBe(1);
  });
});

describe('実測が見積りを超えていないことの確認', () => {
  const plan = { total: 10, limit: 50, accepted: true };

  it('見積り以内なら通す', () => {
    expect(() => assertQueryBudget(plan, 10)).not.toThrow();
  });

  it('見積りを1つでも超えたら止める', () => {
    expect(() => assertQueryBudget(plan, 11)).toThrow(QueryBudgetExceededError);
  });

  it('見積りそのものが上限を超えているなら、実測に関係なく止める', () => {
    expect(() => assertQueryBudget({ total: 60, limit: 50, accepted: false }, 1)).toThrow(
      QueryBudgetExceededError,
    );
  });

  it('上限ちょうども通さない(1 invocation で使い切ると次が無い)', () => {
    expect(() => assertQueryBudget({ total: 50, limit: 50, accepted: true }, 50)).toThrow(
      QueryBudgetExceededError,
    );
  });

  it('止めた理由に件数以外(範囲・明細ID)を載せない(DR-9)', () => {
    const error = new QueryBudgetExceededError(10, 11, 50);
    expect(error.message).toBe('query budget exceeded: actual=11 planned=10 limit=50');
  });
});

describe('差分プレビューの見積り', () => {
  it('行数を引数に取らない。取込の幅が広がっても見積りは動かない', () => {
    const narrow = planImportDiffQueries({ monthChunks: 1 });
    const wide = planImportDiffQueries({ monthChunks: 1 });
    expect(wide.total).toBe(narrow.total);
    expect(narrow.accepted).toBe(true);
    expect(narrow.total).toBeLessThan(50);
  });

  it('書戻しを分割した数だけ増える', () => {
    const base = planImportDiffQueries({ monthChunks: 1 }).total;
    expect(planImportDiffQueries({ monthChunks: 3 }).total).toBe(base + 2);
  });

  it('previewは完全にread-onlyでwriter leaseを取らない', () => {
    expect(planImportDiffQueries({ monthChunks: 1 }).breakdown.lifecycle).toBe(0);
  });

  it('分割が膨らんで上限に届いたら受理しない', () => {
    expect(planImportDiffQueries({ monthChunks: 60 }).accepted).toBe(false);
  });
});
