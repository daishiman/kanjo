/**
 * 「問題点」の絞り込みの契約テスト。
 * 記録はすべてテスト内で生成した架空値で、外部データには依存しない。
 *
 * ここで固定したいのは順位の理由。全件は画面の折りたたみに出ているので、
 * この関数が誤ると「読まれる数件」だけが的外れになり、気づきにくい。
 */
import { describe, expect, it } from 'vitest';
import { type DiagnosticEntry, type DiagnosticKind, highlightDiagnostics } from '../src/improvement.js';

/** i 番目の記録。時刻は昇順に並べる(実際の entries と同じ並び) */
const entry = (i: number, kind: DiagnosticKind, message: string): DiagnosticEntry => ({
  at: `2026-03-01T00:00:${String(i).padStart(2, '0')}.000Z`,
  kind,
  message,
  detail: '',
});

describe('問題点の絞り込み', () => {
  it('記録が無ければ何も返さない', () => {
    expect(highlightDiagnostics([])).toEqual([]);
    expect(highlightDiagnostics([entry(0, 'error', 'x')], 0)).toEqual([]);
  });

  it('重い種別を先に出す(直前の警告が例外を押しのけない)', () => {
    const out = highlightDiagnostics([
      entry(0, 'error', '保存に失敗しました'),
      entry(1, 'console_warn', '非推奨の指定です'),
      entry(2, 'console_warn', '別の警告です'),
    ]);
    expect(out[0].entry.message).toBe('保存に失敗しました');
    expect(out[0].reason).toContain('処理がここで止まっています');
  });

  it('同じ重さなら新しいほうを先に出す', () => {
    const out = highlightDiagnostics([
      entry(0, 'network', 'GET /api/summary 500'),
      entry(1, 'network', 'POST /api/save 500'),
    ]);
    expect(out[0].entry.message).toBe('POST /api/save 500');
  });

  it('同じ記録が繰り返されたら1件に畳み、回数を理由に出す', () => {
    const out = highlightDiagnostics([
      entry(0, 'network', 'POST /api/save 500'),
      entry(1, 'network', 'POST /api/save 500'),
      entry(2, 'network', 'POST /api/save 500'),
    ]);
    // 畳まないと上位が同じ行で埋まる
    expect(out).toHaveLength(1);
    expect(out[0].reason).toContain('3回起きています');
  });

  it('種別が違えば同じ文面でも別の記録として扱う', () => {
    const out = highlightDiagnostics([
      entry(0, 'console_error', '読み込めません'),
      entry(1, 'console_warn', '読み込めません'),
    ]);
    expect(out).toHaveLength(2);
  });

  it('末尾に近い記録だけ「押す直前」と言う', () => {
    const many = Array.from({ length: 10 }, (_, i) => entry(i, 'network', `GET /api/${i} 500`));
    const out = highlightDiagnostics(many, 10);
    expect(out[0].reason).toContain('押す直前の記録です');
    // 古い記録にまで付けると目印にならない
    expect(out.at(-1)?.reason).not.toContain('押す直前の記録です');
  });

  it('既定では3件までに絞る', () => {
    const many = Array.from({ length: 20 }, (_, i) => entry(i, 'error', `失敗 ${i}`));
    expect(highlightDiagnostics(many)).toHaveLength(3);
  });
});
