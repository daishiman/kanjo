import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OWNER_LABELS,
  DEFAULT_TAX_ACCOUNT_MAP,
  NO_CATEGORY,
  SETTINGS_JSON_VERSION,
  type SettingsState,
  diffSettings,
  exportSettings,
  migratedNormRuleId,
  settingsExportFilename,
  settingsJsonFromBackup,
  validateSettingsJson,
} from '../src/index.js';

/** 設定 JSON の書き出し・検証・版・バックアップからの取り出し(BR-23〜BR-29)。版 2 は勘定科目の対応表を持つ (AC-17) */

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
  taxAccountMap: [
    { categoryBig: '通信費', taxAccount: '通信費' },
    { categoryBig: '保険', taxAccount: '損害保険料' },
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
    expect(Object.keys(json.taxAccountMap[0]).sort()).toEqual(['categoryBig', 'taxAccount']);
    expect(json).not.toHaveProperty('mfTx');
    expect(json).not.toHaveProperty('rules');
    expect(json).not.toHaveProperty('budgets');
  });

  it('版 2 で書き出し、対応表は大項目のコード単位順に並べる (D1 の ORDER BY と同じ)', () => {
    const json = exported();
    expect(SETTINGS_JSON_VERSION).toBe(2);
    expect(json.version).toBe(2);
    expect(json.taxAccountMap.map((r: { categoryBig: string }) => r.categoryBig)).toEqual(['保険', '通信費']);
  });

  it('対応表が空なら空のまま往復する (初期の 5 行で補わない)', () => {
    const empty = { ...STATE, taxAccountMap: [] };
    const v = validateSettingsJson(
      JSON.parse(JSON.stringify(exportSettings(empty, '2026-09-22T01:00:00.000Z'))),
    );
    expect(v.ok && v.value.taxAccountMap).toEqual([]);
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

  it('対応表の行の形と値を拒否する (BR-09)', () => {
    reject((j) => {
      j.taxAccountMap[0].updatedAt = 'x';
    });
    reject((j) => {
      j.taxAccountMap = 'x';
    });
    // 同じ大項目の 2 行目 (前後の空白は除いて比べる)
    reject((j) => {
      j.taxAccountMap.push({ categoryBig: ' 通信費 ', taxAccount: '雑費' });
    });
    // 対応先は TAX_ACCOUNTS の 32 件に限る
    reject((j) => {
      j.taxAccountMap[0].taxAccount = '通信料';
    });
    // 『カテゴリなし』は予約の値で、大項目に登録できない
    reject((j) => {
      j.taxAccountMap[0].categoryBig = NO_CATEGORY;
    });
    reject((j) => {
      j.taxAccountMap[0].categoryBig = ' ';
    });
    reject((j) => {
      j.taxAccountMap[0].categoryBig = 'あ'.repeat(61);
    });
  });

  it('新しすぎる版・古すぎる版は unsupported_settings_version', () => {
    reject((j) => {
      j.version = 3;
    }, 'unsupported_settings_version');
    reject((j) => {
      j.version = -1;
    }, 'unsupported_settings_version');
    // 2 世代前(版 0)は受けない。受けるのは現行(版 2)と 1 世代前(版 1)だけ
    reject((j) => {
      j.version = 0;
    }, 'unsupported_settings_version');
  });
});

describe('版 1 からの移行 (AC-17)', () => {
  // biome-ignore lint/suspicious/noExplicitAny: 版 1 の形を作るため、JSON を型なしで書き換える
  const v1 = (): Record<string, any> => {
    const j = exported();
    j.version = 1;
    // biome-ignore lint/performance/noDelete: 版 1 は対応表のキーを持たない
    delete j.taxAccountMap;
    return j;
  };

  it('版 1 の JSON は通り、対応表は初期の 5 行になる', () => {
    const v = validateSettingsJson(v1());
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    // 検査を通った値は版を問わず大項目のコード単位順 (版 2 の書き出し・D1 の ORDER BY と同じ並び)
    expect(v.value.taxAccountMap.map((r) => r.categoryBig)).toEqual([
      '交通費',
      '交際費',
      '日用品',
      '水道・光熱費',
      '通信費',
    ]);
    expect(v.value.taxAccountMap).toEqual(expect.arrayContaining([...DEFAULT_TAX_ACCOUNT_MAP]));
    expect(diffSettings({ ...STATE, taxAccountMap: [...DEFAULT_TAX_ACCOUNT_MAP] }, v.value).total).toBe(0);
  });

  it('初期の 5 行は通信費・水道光熱費・旅費交通費・接待交際費・消耗品費', () => {
    expect(DEFAULT_TAX_ACCOUNT_MAP.map((r) => [r.categoryBig, r.taxAccount])).toEqual([
      ['通信費', '通信費'],
      ['水道・光熱費', '水道光熱費'],
      ['交通費', '旅費交通費'],
      ['交際費', '接待交際費'],
      ['日用品', '消耗品費'],
    ]);
  });

  it('版 1 なのに対応表のキーを持つ JSON は不正 (版 1 に無いキー)', () => {
    const j = v1();
    j.taxAccountMap = [];
    expect(validateSettingsJson(j)).toEqual({ ok: false, code: 'invalid_settings_file' });
  });

  it('版 1 の値の検査は版 2 と同じ', () => {
    const j = v1();
    j.statMinMonths = 2;
    expect(validateSettingsJson(j)).toEqual({ ok: false, code: 'invalid_settings_file' });
  });
});

describe('バックアップ本文からの取り出し(BR-28・BR-29)', () => {
  it('新しい本文は 3 表・名義・統計・対応表をそのまま取り出す', () => {
    const body = {
      normRules: STATE.normRules,
      cashOverrideRules: STATE.cashOverrides,
      ownerLabels: STATE.ownerLabels,
      analysisSettings: { statMinMonths: 12 },
      taxAccountMap: STATE.taxAccountMap,
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
    // 対応表を持たない旧いバックアップは初期の 5 行で補う (AC-17)
    expect(json.taxAccountMap).toEqual([...DEFAULT_TAX_ACCOUNT_MAP]);
    expect(validateSettingsJson(json).ok).toBe(true);
  });

  it('対応表が空の新しい本文は空のまま (利用者が全部消した状態を戻す)', () => {
    const body = { normRules: [], cashOverrideRules: [], taxAccountMap: [] };
    expect(settingsJsonFromBackup(body, '2026-09-22T00:00:00.000Z').taxAccountMap).toEqual([]);
  });

  it('移行 id は migration の lower(hex(raw)) と同じ(UTF-8)', () => {
    expect(migratedNormRuleId('a')).toBe('m-61');
    expect(migratedNormRuleId('費')).toBe('m-e8b2bb');
  });
});
