import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OWNER_LABELS,
  type SettingsState,
  diffSettings,
  exportSettings,
  migratedNormRuleId,
  settingsExportFilename,
  settingsJsonFromBackup,
  validateSettingsJson,
} from '../src/index.js';

/** 設定 JSON の書き出し・検証・版・バックアップからの取り出し(BR-23〜BR-29) */

const STATE: SettingsState = {
  normRules: [
    { ruleId: 'v1', kind: 'vendor', raw: 'スタバ', norm: 'カフェ・外食', order: 1, enabled: true },
    { ruleId: 'a1', kind: 'account', raw: '消耗品', norm: '消耗品費', order: 2, enabled: false },
  ],
  ownerLabels: { ...DEFAULT_OWNER_LABELS, spouse: 'パートナー' },
  statMinMonths: 12,
  cashOverrides: [
    {
      overrideId: 'o-payment-all',
      kind: 'payment',
      amount: 0,
      scope: 'all',
      month: null,
      memo: '現金支出を0円として扱う',
    },
    {
      overrideId: 'o-receipt-2026-08',
      kind: 'receipt',
      amount: 5000,
      scope: 'month',
      month: '2026-08',
      memo: '',
    },
  ],
};

const exported = () => JSON.parse(JSON.stringify(exportSettings(STATE, '2026-09-22T01:00:00.000Z')));

describe('書き出し → 検証の往復', () => {
  it('書き出した JSON は検証を通り、差分 0 件で戻る', () => {
    const v = validateSettingsJson(exported());
    expect(v.ok).toBe(true);
    if (v.ok) expect(diffSettings(STATE, v.value).total).toBe(0);
  });

  it('更新日時・更新者・overrideId を含めない', () => {
    const json = exported();
    expect(Object.keys(json.cashOverrides[0]).sort()).toEqual(['amount', 'kind', 'memo', 'month', 'scope']);
    expect(Object.keys(json.normRules[0]).sort()).toEqual(['enabled', 'kind', 'norm', 'raw', 'ruleId']);
    expect(json).not.toHaveProperty('mfTx');
    expect(json).not.toHaveProperty('rules');
    expect(json).not.toHaveProperty('budgets');
  });

  it('ファイル名は kanjo-settings-YYYY-MM-DD.json', () => {
    expect(settingsExportFilename('2026-09-22T01:00:00.000Z')).toBe('kanjo-settings-2026-09-22.json');
  });

  it('復元で振る現金上書きの id は決定論', () => {
    const a = validateSettingsJson(exported());
    const b = validateSettingsJson(exported());
    expect(a.ok && b.ok && a.value.cashOverrides.map((r) => r.overrideId)).toEqual([
      'o-payment-all',
      'o-receipt-2026-08',
    ]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('拒否(BR-24・BR-25)', () => {
  // biome-ignore lint/suspicious/noExplicitAny: 形の崩れたファイルを作るため、JSON を型なしで書き換える
  const reject = (mut: (j: Record<string, any>) => void, code = 'invalid_settings_file') => {
    const j = exported();
    mut(j);
    expect(validateSettingsJson(j)).toEqual({ ok: false, code });
  };

  it('未知キー・欠落キーを拒否する', () => {
    reject((j) => {
      j.extra = 1;
    });
    reject((j) => {
      // biome-ignore lint/performance/noDelete: キーの欠落そのものを再現する
      delete j.statMinMonths;
    });
    reject((j) => {
      j.normRules[0].updatedAt = 'x';
    });
    reject((j) => {
      j.cashOverrides[0].overrideId = 'x';
    });
    reject((j) => {
      j.ownerLabels.extra = 'x';
    });
  });

  it('形式名・型・範囲の違いを拒否する', () => {
    reject((j) => {
      j.format = 'other';
    });
    reject((j) => {
      j.statMinMonths = '6';
    });
    reject((j) => {
      j.statMinMonths = 2;
    });
    reject((j) => {
      j.normRules[0].enabled = 1;
    });
    reject((j) => {
      j.cashOverrides[0].amount = 1.5;
    });
    expect(validateSettingsJson(null)).toEqual({ ok: false, code: 'invalid_settings_file' });
    expect(validateSettingsJson([])).toEqual({ ok: false, code: 'invalid_settings_file' });
  });

  it('件数超過を拒否する', () => {
    reject((j) => {
      j.normRules = Array.from({ length: 501 }, (_, i) => ({
        ruleId: `n${i}`,
        kind: 'vendor',
        raw: `r${i}`,
        norm: 'x',
        enabled: true,
      }));
    });
  });

  it('新しすぎる版・古すぎる版は unsupported_settings_version', () => {
    reject((j) => {
      j.version = 2;
    }, 'unsupported_settings_version');
    reject((j) => {
      j.version = -1;
    }, 'unsupported_settings_version');
    // 1 世代前(版 0)は移行関数が無いので受けない(置き場はあるが現行は版 1 だけ)
    reject((j) => {
      j.version = 0;
    }, 'unsupported_settings_version');
  });
});

describe('バックアップ本文からの取り出し(BR-28・BR-29)', () => {
  it('新しい本文は 3 表・名義・統計をそのまま取り出す', () => {
    const body = {
      normRules: STATE.normRules,
      cashOverrideRules: STATE.cashOverrides,
      ownerLabels: STATE.ownerLabels,
      analysisSettings: { statMinMonths: 12 },
    };
    const v = validateSettingsJson(settingsJsonFromBackup(body, '2026-09-22T00:00:00.000Z'));
    expect(v.ok).toBe(true);
    if (v.ok) expect(diffSettings(STATE, v.value).total).toBe(0);
  });

  it('古い本文は normMap を勘定科目ルールへ、月の値を月指定の上書きへ写し、0 と未設定は写さない', () => {
    const body = {
      normMap: { 通信費用: '通信費', 消耗品: '消耗品費' },
      cashOverride: {
        '2026-07': { revenue: 0, expense: 3000 },
        '2026-08': { revenue: 1200, expense: 0 },
      },
    };
    const json = settingsJsonFromBackup(body, '2026-09-22T00:00:00.000Z');
    expect(json.normRules.map((r) => [r.ruleId, r.raw, r.norm])).toEqual([
      [migratedNormRuleId('消耗品'), '消耗品', '消耗品費'],
      [migratedNormRuleId('通信費用'), '通信費用', '通信費'],
    ]);
    expect(json.cashOverrides).toEqual([
      { kind: 'payment', amount: 3000, scope: 'month', month: '2026-07', memo: '' },
      { kind: 'receipt', amount: 1200, scope: 'month', month: '2026-08', memo: '' },
    ]);
    expect(json.ownerLabels).toEqual(DEFAULT_OWNER_LABELS);
    expect(json.statMinMonths).toBe(6);
    expect(validateSettingsJson(json).ok).toBe(true);
  });

  it('移行 id は migration の lower(hex(raw)) と同じ(UTF-8)', () => {
    expect(migratedNormRuleId('a')).toBe('m-61');
    expect(migratedNormRuleId('費')).toBe('m-e8b2bb');
  });
});
