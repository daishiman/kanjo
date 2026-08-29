import { describe, expect, it } from 'vitest';
import {
  type ReceiptSourceProfile,
  buildReceiptSourceProfile,
  normalizeReceiptSourceKeyPart,
  receiptSourceProfileKey,
  resolveReceiptSourceProfile,
} from '../src/index.js';

const build = (
  merchant: string,
  serviceName = '架空請求ポータル',
  sourceUrl = 'https://billing.example.test/receipts',
): ReceiptSourceProfile => {
  const result = buildReceiptSourceProfile(merchant, {
    serviceName,
    sourceUrl,
    loginAccount: 'account@example.test',
    memo: '月次の利用明細からダウンロード',
  });
  if (!result.ok) throw new Error(result.issues.join(','));
  return result.profile;
};

describe('証憑取得元profileの正本', () => {
  it('merchant/sourceの正規化keyと、秘密を含まない取得先情報だけを作る', () => {
    const result = buildReceiptSourceProfile('　架空クラウド 株式会社　', {
      serviceName: ' Billing Portal ',
      sourceUrl: 'https://billing.example.test/receipts',
      loginAccount: ' account@example.test ',
      memo: ' 2月に前年分を保存 ',
    });

    expect(result).toEqual({
      ok: true,
      profile: {
        profileKey: receiptSourceProfileKey('架空クラウド 株式会社', 'Billing Portal'),
        merchantKey: '架空クラウド',
        serviceName: 'Billing Portal',
        sourceUrl: 'https://billing.example.test/receipts',
        loginAccount: 'account@example.test',
        memo: '2月に前年分を保存',
      },
    });
    expect(Object.keys(result.ok ? result.profile : {})).not.toContain('password');
    expect(Object.keys(result.ok ? result.profile : {})).not.toContain('token');
  });

  it('sourceUrlは認証情報を埋め込まないhttp/httpsだけを受け入れる', () => {
    for (const sourceUrl of [
      'javascript:alert(1)',
      'file:///tmp/receipt',
      'ftp://example.test/receipt',
      'https://user:secret@example.test/receipt',
      'not-a-url',
    ]) {
      const result = buildReceiptSourceProfile('架空社', {
        serviceName: '架空ポータル',
        sourceUrl,
        loginAccount: '',
        memo: '',
      });
      expect(result.ok, sourceUrl).toBe(false);
      if (!result.ok) expect(result.issues).toContain('invalid_source_url');
    }

    expect(build('架空社', '架空ポータル', 'http://localhost:8787/receipt').sourceUrl).toBe(
      'http://localhost:8787/receipt',
    );
  });
});

describe('merchant継承と明細override', () => {
  it('同じmerchantなら月をまたいで同じprofileを継承する', () => {
    const profile = build('架空クラウド株式会社');
    for (const transaction of [
      { transactionId: 'tx-jan', month: '2025-01', merchant: '架空クラウド' },
      { transactionId: 'tx-dec', month: '2025-12', merchant: '架空ｸﾗｳﾄﾞ　（株）' },
    ]) {
      expect(resolveReceiptSourceProfile(transaction, [profile], [])).toMatchObject({
        state: 'resolved',
        profile,
        inheritedFrom: profile.merchantKey,
        overrideState: 'none',
        candidates: [],
      });
    }
  });

  it('明細overrideはmerchantの継承より優先し、解除も明示状態として保つ', () => {
    const inherited = build('架空クラウド', '通常ポータル');
    const selected = build('別の取引先', '明細専用ポータル');
    const transaction = { transactionId: 'tx-1', month: '2025-06', merchant: '架空クラウド' };

    expect(
      resolveReceiptSourceProfile(
        transaction,
        [inherited, selected],
        [{ transactionId: 'tx-1', profileKey: selected.profileKey }],
      ),
    ).toMatchObject({
      state: 'resolved',
      profile: selected,
      inheritedFrom: null,
      overrideState: 'applied',
    });

    expect(
      resolveReceiptSourceProfile(
        transaction,
        [inherited, selected],
        [{ transactionId: 'tx-1', profileKey: null }],
      ),
    ).toEqual({
      state: 'cleared',
      profile: null,
      candidates: [],
      inheritedFrom: null,
      overrideState: 'cleared',
    });
  });
});

describe('安全な表記ゆれと曖昧候補', () => {
  it('全半角・大小文字・空白・前後の法人格だけを吸収し、部分一致はしない', () => {
    expect(normalizeReceiptSourceKeyPart('ＯＰＥＮ　ＡＩ 株式会社')).toBe('openai');
    expect(normalizeReceiptSourceKeyPart('（株）open ai')).toBe('openai');
    expect(normalizeReceiptSourceKeyPart('A-B')).not.toBe(normalizeReceiptSourceKeyPart('AB'));

    const profile = build('OPEN AI 株式会社');
    expect(
      resolveReceiptSourceProfile(
        { transactionId: 'exact', month: '2025-01', merchant: 'ｏｐｅｎ　ａｉ' },
        [profile],
        [],
      ).state,
    ).toBe('resolved');
    expect(
      resolveReceiptSourceProfile(
        { transactionId: 'partial', month: '2025-01', merchant: 'OPEN AI PAYMENTS' },
        [profile],
        [],
      ).state,
    ).toBe('unmatched');
  });

  it('同一merchantに複数の取得先があれば自動確定せず候補を返す', () => {
    const portal = build('架空モール株式会社', '購入履歴');
    const card = build('架空モール', '法人カード明細', 'https://card.example.test/statements');
    const resolved = resolveReceiptSourceProfile(
      { transactionId: 'tx-ambiguous', month: '2025-03', merchant: '架空モール（株）' },
      [portal, card],
      [],
    );

    expect(resolved).toEqual({
      state: 'ambiguous',
      profile: null,
      candidates: [card, portal].sort((a, b) => a.profileKey.localeCompare(b.profileKey)),
      inheritedFrom: portal.merchantKey,
      overrideState: 'none',
    });
  });
});
