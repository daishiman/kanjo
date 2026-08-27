import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { CashEntryBody } from './api.js';
import { nextAttachmentTarget, uploadAttachmentFiles } from './components/Attachments.js';
import {
  changeCashEntryMode,
  resetCashEntryAfterCreate,
  setCashTransitInput,
  transitInputFromCashBody,
} from './pages/Cash.js';

const ATTACHMENT_SOURCE = readFileSync(new URL('./components/Attachments.tsx', import.meta.url), 'utf8');
const CASH_SOURCE = readFileSync(new URL('./pages/Cash.tsx', import.meta.url), 'utf8');
const CLASSIFY_SOURCE = readFileSync(new URL('./pages/Classify.tsx', import.meta.url), 'utf8');

const body = (patch: Partial<CashEntryBody> = {}): CashEntryBody => ({
  date: '2026-08-26',
  side: 'biz',
  io: 'expense',
  amount: 0,
  description: '',
  big: '旅費交通費',
  mid: '',
  memo: null,
  transitFrom: null,
  transitTo: null,
  transitRound: false,
  receiptWaived: false,
  ...patch,
});

const file = (name: string) =>
  ({ name, type: 'image/jpeg', size: 1_024 }) as Pick<File, 'name' | 'type' | 'size'> as File;

describe('証憑添付の高リスク回帰', () => {
  it('1件の送信失敗後も後続ファイルを処理し、成功と失敗を分けて返す', async () => {
    const files = [file('1.jpg'), file('2.jpg'), file('3.jpg')];
    const send = vi.fn(async (candidate: File) => {
      if (candidate.name === '2.jpg') throw new Error('重複しています');
    });

    const result = await uploadAttachmentFiles(files, 0, send);

    expect(send.mock.calls.map(([candidate]) => candidate.name)).toEqual(['1.jpg', '2.jpg', '3.jpg']);
    expect(result.succeeded.map((candidate) => candidate.name)).toEqual(['1.jpg', '3.jpg']);
    expect(result.failed).toEqual([{ filename: '2.jpg', message: '重複しています' }]);
  });

  it('同じ対象は閉じ、別対象を開くと常に1件だけを保持する', () => {
    expect(nextAttachmentTarget(null, 'tx-1')).toBe('tx-1');
    expect(nextAttachmentTarget('tx-1', 'tx-2')).toBe('tx-2');
    expect(nextAttachmentTarget('tx-2', 'tx-2')).toBeNull();
  });

  it('貼り付けlistenerは共通開閉hookの1箇所だけが所有する', () => {
    expect(ATTACHMENT_SOURCE.match(/window\.addEventListener\('paste'/g)).toHaveLength(1);
    expect(ATTACHMENT_SOURCE).toContain('export function useAttachmentDisclosure');
    expect(CASH_SOURCE).toContain('useAttachmentDisclosure()');
    expect(CLASSIFY_SOURCE).toContain('useAttachmentDisclosure()');
    expect(CLASSIFY_SOURCE).not.toContain('const [attachOpen');
  });

  it('部分成功を含む完了時に一覧を必ず再同期する', () => {
    expect(ATTACHMENT_SOURCE).toMatch(/onSettled:\s*refresh/);
    expect(ATTACHMENT_SOURCE).toContain('件は添付できませんでした');
  });

  it('原本の有無とcleanup stageを分け、各段階を再試行できる', () => {
    // 主証拠はAttachments.dom.test.tsxの実DOM契約。ここは共有分岐の消失だけを高速検知する。
    expect(ATTACHMENT_SOURCE).toContain('attachment.originalAvailable');
    expect(ATTACHMENT_SOURCE).toContain("stage === 'object_delete_failed'");
    expect(ATTACHMENT_SOURCE).toContain('原本の削除に失敗');
    expect(ATTACHMENT_SOURCE).toContain("stage === 'metadata_delete_pending'");
    expect(ATTACHMENT_SOURCE).toContain('原本削除済み・記録を整理中');
    expect(ATTACHMENT_SOURCE.match(/onSettled:\s*refresh/g)).toHaveLength(2);
  });
});

describe('現金・交通費入力の高リスク回帰', () => {
  it('新規と編集で同じ導出を使い、往復運賃を再編集で片道運賃に戻せる', () => {
    const created = setCashTransitInput(body(), {
      from: '名古屋',
      to: '金山',
      oneWayAmount: 280,
      round: true,
    });

    expect(created).toMatchObject({
      amount: 560,
      transitFrom: '名古屋',
      transitTo: '金山',
      transitRound: true,
      receiptWaived: true,
    });
    expect(transitInputFromCashBody(created)).toEqual({
      from: '名古屋',
      to: '金山',
      oneWayAmount: 280,
      round: true,
    });

    const edited = setCashTransitInput(created, {
      ...transitInputFromCashBody(created),
      oneWayAmount: 300,
    });
    expect(edited.amount).toBe(600);
  });

  it('通常記帳へ戻すと交通費metadataと証憑不要をclearする', () => {
    const transit = setCashTransitInput(body(), {
      from: '名古屋',
      to: '金山',
      oneWayAmount: 280,
      round: true,
    });

    expect(changeCashEntryMode(transit, 'normal')).toMatchObject({
      amount: 0,
      description: '',
      transitFrom: null,
      transitTo: null,
      transitRound: false,
      receiptWaived: false,
    });
  });

  it('選択中の入力種別を再度選んでも入力値を消さない', () => {
    const normal = body({ amount: 500, description: '備品' });
    expect(changeCashEntryMode(normal, 'normal')).toBe(normal);

    const transit = setCashTransitInput(body(), {
      from: '名古屋',
      to: '金山',
      oneWayAmount: 280,
      round: true,
    });
    expect(changeCashEntryMode(transit, 'transit')).toBe(transit);
  });

  it('記帳成功後は次の入力に証憑不要を持ち越さない', () => {
    expect(resetCashEntryAfterCreate(body({ receiptWaived: true })).receiptWaived).toBe(false);
    expect(CASH_SOURCE).toContain('resetCashEntryAfterCreate');
    expect(CASH_SOURCE).toContain("setMode('normal')");
  });
});
