/**
 * サブスク画面 (SYS-SUBS-P04) の検算済み fixture。数値の正本は specs/spec-subscriptions-screen.md §13.3。
 *
 * - 24 か月 (2024-09..2026-08)。表示期間は後半 12 か月、前期間は前半 12 か月。
 * - 支払いはすべて MF の支出明細。カードは「楽天カード」、銀行は「三菱UFJ銀行」。
 * - カバー率は口座ごとの入金明細で作る (支出の集計には入らない)。
 *   ゆうちょ銀行は 2026-03、PayPay は 2026-07・08 が欠ける。
 */
import {
  type Dataset,
  type MfTx,
  type SubscriptionsScreenInput,
  type SubscriptionsScreenVendor,
  emptyDataset,
} from '../src/index.js';

export const MONTHS = Array.from({ length: 24 }, (_, i) => {
  const n = 2024 * 12 + 8 + i;
  return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;
});
export const PERIOD = { from: '2025-09', to: '2026-08' };
export const PREVIOUS = { from: '2024-09', to: '2025-08' };
export const REVENUE = 180_000;
export const GENERATED_AT = '2026-09-10T10:24:00+09:00';

const CARD = '楽天カード';
const BANK = '三菱UFJ銀行';

let seq = 0;
export function pay(month: string, name: string, amount: number, inst: string, day = 1): MfTx {
  seq++;
  return {
    id: `mf-sub-${seq}`,
    idStable: true,
    m: month,
    d: `${month.slice(5)}/${String(day).padStart(2, '0')}`,
    c: name,
    a: -amount,
    big: '通信費',
    mid: '情報サービス',
    inst,
    isTarget: true,
    isTransfer: false,
  };
}

function deposit(month: string, inst: string): MfTx {
  seq++;
  return {
    id: `mf-in-${seq}`,
    idStable: true,
    m: month,
    d: `${month.slice(5)}/25`,
    c: '架空の入金',
    a: 1_000,
    big: '収入',
    mid: 'その他入金',
    inst,
    isTarget: true,
    isTransfer: false,
  };
}

/** 月と添字を受け、その月の支払い (名前・額・口座) を返す */
type Plan = (month: string, index: number) => { name: string; amount: number; inst: string } | null;

const PLANS: Record<string, Plan> = {
  Netflix: (_m, i) =>
    i % 2 === 0
      ? { name: 'Netflix', amount: 1_490, inst: CARD }
      : { name: 'NETFLIX.COM', amount: 1_490, inst: BANK },
  Amazonプライム: (_m, i) =>
    i % 2 === 0
      ? { name: 'Amazonプライム', amount: 600, inst: CARD }
      : { name: 'Amazonプライム会費', amount: 600, inst: BANK },
  // カードの 'Spotify' と銀行の 'SPOTIFY.COM' が交互に 6 件ずつ (期間内)
  Spotify: (_m, i) =>
    i % 2 === 0
      ? { name: 'Spotify', amount: 980, inst: CARD }
      : { name: 'SPOTIFY.COM', amount: 980, inst: BANK },
  'Google One': () => ({ name: 'Google One', amount: 250, inst: CARD }),
  Notion: () => ({ name: 'Notion', amount: 1_650, inst: CARD }),
  'Adobe Creative Cloud': (m) => ({
    name: 'Adobe Creative Cloud',
    amount: m >= '2026-07' ? 2_728 : 2_480,
    inst: CARD,
  }),
  '1Password': () => ({ name: '1Password', amount: 580, inst: CARD }),
  NewsPicks: () => ({ name: 'NewsPicks', amount: 1_500, inst: CARD }),
};

export const VENDORS: SubscriptionsScreenVendor[] = [
  {
    id: 1,
    name: 'Netflix',
    aliases: ['NETFLIX.COM'],
    accounts: [],
    category: null,
    reviewedAt: '2026-08-01',
  },
  {
    id: 2,
    name: 'Amazonプライム',
    aliases: ['Amazonプライム会費'],
    accounts: [],
    category: null,
    reviewedAt: '2026-08-01',
  },
  {
    id: 3,
    name: 'Spotify',
    aliases: ['SPOTIFY.COM'],
    accounts: ['通信費'],
    category: null,
    reviewedAt: '2026-08-01',
  },
  { id: 4, name: 'Google One', aliases: [], accounts: [], category: null, reviewedAt: '2026-08-01' },
  { id: 5, name: 'Notion', aliases: [], accounts: [], category: null, reviewedAt: '2026-08-01' },
  {
    id: 6,
    name: 'Adobe Creative Cloud',
    aliases: [],
    accounts: [],
    category: null,
    reviewedAt: '2026-08-01',
  },
  { id: 7, name: '1Password', aliases: [], accounts: [], category: null, reviewedAt: '2026-08-01' },
  { id: 8, name: 'NewsPicks', aliases: [], accounts: [], category: null, reviewedAt: '2026-08-01' },
];

/** 登録ベンダーを Dataset にも写す (既存 subscriptions() の vendors と同じ名前にする) */
export function datasetOf(txs: MfTx[], months: readonly string[] = MONTHS, revenue = REVENUE): Dataset {
  const data = emptyDataset();
  data.months = [...months];
  data.biz.revenue = months.map(() => revenue);
  data.subs.other = months.map(() => 0);
  data.mfTx = txs;
  return data;
}

export function fixtureDataset(): Dataset {
  seq = 0;
  const txs: MfTx[] = [];
  MONTHS.forEach((month, i) => {
    for (const plan of Object.values(PLANS)) {
      const p = plan(month, i);
      if (p) txs.push(pay(month, p.name, p.amount, p.inst));
    }
    for (const inst of [
      '楽天カード',
      '三井住友カード',
      '三菱UFJ銀行',
      '住信SBIネット銀行',
      'モバイルSuica',
    ]) {
      txs.push(deposit(month, inst));
    }
    if (month !== '2026-03') txs.push(deposit(month, 'ゆうちょ銀行'));
    if (month !== '2026-07' && month !== '2026-08') txs.push(deposit(month, 'PayPay'));
  });
  return datasetOf(txs);
}

export function fixtureInput(over: Partial<SubscriptionsScreenInput> = {}): SubscriptionsScreenInput {
  return {
    all: fixtureDataset(),
    deals: [],
    range: PERIOD,
    vendors: VENDORS,
    decisions: [{ vendorKey: 'netflix', decision: 'dismissed', ruleFingerprint: 'overlap:1490' }],
    exclusions: [],
    generatedAt: GENERATED_AT,
    ...over,
  };
}
