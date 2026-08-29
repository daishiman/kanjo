/**
 * 確定申告(青色申告決算書・一般用)への転記。
 *
 * この帳簿が持っているのは「正規化後の科目 × 月の金額」であって、決算書の欄ではない。
 * 両者の間には、放っておくと申告のたびに手作業で埋めることになる隙間が3つある:
 *
 *   1. 科目名が決算書と一致しない … 既定の正規化で 通信費/支払手数料 → 「サブスク・通信」になる。
 *                                   決算書にその欄は無い。
 *   2. 家事按分が入っていない     … 自宅家賃・携帯代は全額が経費ではない。
 *   3. 決算書に印字が無い科目がある … 支払手数料・新聞図書費・研修費などは空欄行に自分で書く。
 *                                   どれを空欄に書くのかは、決算書を見ても分からない。
 *
 * ここはその3つだけを解く。統計や判断は一切しない。
 *
 * 設計の要:
 * **決算書科目に割り当てられていない科目を、黙ってどこかへ寄せない。**
 * 「雑費」に落とせば数字は必ず合うが、税務署にも自分にも説明できない申告になる。
 * 割り当てが無いものは `unassigned` として金額つきで返し、画面が対応を促す。
 */
import { catSeries } from './analysis.js';
import { TAX_ACCOUNTS } from './tax-accounts.js';
import type { Dataset } from './types.js';

/**
 * 青色申告決算書(一般用)の「経費」欄に、あらかじめ印字されている科目。
 * 並び順が決算書の欄の並びそのもので、転記はこの順に上から write していけば終わる。
 *
 * 欄番号(⑧⑨…)は様式改訂で動くので持たない。科目名と順序だけは長年変わっていない。
 */
export const TAX_FORM_PRINTED_ACCOUNTS: readonly string[] = [
  '租税公課',
  '荷造運賃',
  '水道光熱費',
  '旅費交通費',
  '通信費',
  '広告宣伝費',
  '接待交際費',
  '損害保険料',
  '修繕費',
  '消耗品費',
  '減価償却費',
  '福利厚生費',
  '給料賃金',
  '外注工賃',
  '利子割引料',
  '地代家賃',
  '貸倒金',
  '雑費',
] as const;

/**
 * 経費欄ではなく専用の欄を持つ科目。経費合計に混ぜると決算書と合わなくなる。
 * 専従者給与は届出が要る特別な枠で、「給料賃金」と同じ欄には書けない。
 */
export const TAX_FORM_SEPARATE_ACCOUNTS: readonly string[] = ['専従者給与'] as const;

/** 収入(売上)側の科目。経費として集計しない */
export const TAX_FORM_REVENUE_ACCOUNTS: readonly string[] = ['売上高', '雑収入'] as const;

/** 経費でも収入でもない科目。申告額の計算から外す */
export const TAX_FORM_NON_EXPENSE_ACCOUNTS: readonly string[] = ['事業主貸'] as const;

const PRINTED = new Set<string>(TAX_FORM_PRINTED_ACCOUNTS);
const SEPARATE = new Set<string>(TAX_FORM_SEPARATE_ACCOUNTS);
const REVENUE = new Set<string>(TAX_FORM_REVENUE_ACCOUNTS);
const NON_EXPENSE = new Set<string>(TAX_FORM_NON_EXPENSE_ACCOUNTS);
const KNOWN_TAX_ACCOUNTS = new Set<string>(TAX_ACCOUNTS.map((a) => a.name));
const ALLOWED_EXPENSE_ACCOUNTS = new Set<string>(
  TAX_ACCOUNTS.map((a) => a.name).filter((name) => !REVENUE.has(name) && !NON_EXPENSE.has(name)),
);

/** 確定申告の対象年。期間指定と混ぜないよう YYYY だけを持つ。 */
export type TaxYear = `${number}${number}${number}${number}`;

/** 外部入力を申告年に変換する唯一の入口。暗黙の trim はしない。 */
export function parseTaxYear(value: unknown): TaxYear | null {
  return typeof value === 'string' && /^20\d{2}$/.test(value) ? (value as TaxYear) : null;
}

export interface TaxYearScope {
  year: TaxYear;
  from: `${TaxYear}-01`;
  to: `${TaxYear}-12`;
}

/** 1月1日から12月31日までに対応する、厳密なカレンダー年の月範囲。 */
export function taxYearScope(value: unknown): TaxYearScope | null {
  const year = parseTaxYear(value);
  return year ? { year, from: `${year}-01`, to: `${year}-12` } : null;
}

/** 決算書の欄の並び順。印字科目が先、空欄に書き足す科目が後 */
const PRINTED_ORDER = new Map<string, number>(TAX_FORM_PRINTED_ACCOUNTS.map((n, i) => [n, i]));

/** 決算書に印字がある科目か。空欄行に書き足す必要があるかの判定 */
export const isPrintedTaxAccount = (name: string): boolean => PRINTED.has(name.trim());

/** 決算書の科目として使える名前か */
export const isKnownTaxAccount = (name: string): boolean => KNOWN_TAX_ACCOUNTS.has(name.trim());

/** 青色申告決算書で支出の転記先にできる科目か。収入・事業主貸は拒否する。 */
export const isAllowedTaxExpenseAccount = (name: string): boolean =>
  ALLOWED_EXPENSE_ACCOUNTS.has(name.trim());

/**
 * 科目1つぶんの申告時の扱い。決算書科目への割り当てと家事按分を同じ場所に持つ。
 * どちらも「この科目を申告でどう扱うか」という1つの問いの答えなので、設定を2箇所に割らない。
 */
export interface TaxAccountSetting {
  /** 設定を確定した申告年。他年の再出力を後日の変更で書き換えない。 */
  taxYear: TaxYear;
  /** この帳簿上の科目名(正規化後)。`data.biz.categories` の要素 */
  account: string;
  /** 転記先の決算書科目。null = 未割当(申告額に入れず、要対応として出す) */
  taxAccount: string | null;
  /** 家事按分の事業割合(0..100)。全額が事業でも100を明示保存する。 */
  businessPercent: number;
  /** 按分率の根拠。税務調査で聞かれるのはここ。空のまま運用させない */
  basis: string | null;
  updatedAt?: string | null;
}

/** 「申告年に確定した科目方針」を表す業務名。 */
export type TaxAccountPolicy = TaxAccountSetting;

/** 申告年の科目判定。行があることと、有効な転記先であることを分けて保つ。 */
export interface ResolvedTaxAccountSetting {
  account: string;
  status: 'confirmed' | 'unconfirmed';
  taxAccount: string | null;
  businessPercent: number;
  basis: string | null;
}

export const HOUSEHOLD_RATIO_BASIS_MAX = 200;

/** 按分率として受け入れられる値か。0%(全額家事)も 100%(全額事業)も有効値 */
export const isValidBusinessPercent = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100;

/**
 * 家事按分の適用。端数は切り捨てる。
 *
 * 四捨五入ではなく切り捨てにするのは、丸めの誤差が必ず「経費が増える側」に出ないようにするため。
 * 科目数ぶん積み上がると、根拠の無い数百円が経費に乗る。過小申告は指摘されるが、
 * 過大申告は否認される。安全な向きは一つしかない。
 */
export function apportion(gross: number, businessPercent: number | null): number {
  if (businessPercent == null) return gross;
  if (!isValidBusinessPercent(businessPercent)) return gross;
  const sign = gross < 0 ? -1 : 1;
  return sign * Math.floor((Math.abs(gross) * businessPercent) / 100);
}

/**
 * 未確認行に表示する割り当て候補。科目名が決算書の科目とそのまま一致する場合だけ
 * 入力初期値に使う。候補があっても未確認statusは維持し、利用者の明示保存を必須にする。
 * 一致しなければ null を返し、推測で寄せない。
 */
export function defaultTaxAccountFor(account: string): string | null {
  const name = account.trim();
  return ALLOWED_EXPENSE_ACCOUNTS.has(name) ? name : null;
}

/** 設定を申告年+科目名で引く。行が無い場合だけが未確認。 */
export function resolveTaxAccountSettings(
  taxYear: TaxYear,
  accounts: readonly string[],
  settings: readonly TaxAccountSetting[],
): ResolvedTaxAccountSetting[] {
  const byAccount = new Map(
    settings.filter((setting) => setting.taxYear === taxYear).map((s) => [s.account.trim(), s]),
  );
  return accounts.map((account) => {
    const saved = byAccount.get(account.trim());
    if (saved)
      return {
        account,
        status: 'confirmed' as const,
        taxAccount:
          saved.taxAccount && isAllowedTaxExpenseAccount(saved.taxAccount) ? saved.taxAccount.trim() : null,
        businessPercent: isValidBusinessPercent(saved.businessPercent) ? saved.businessPercent : 100,
        basis: saved.basis,
      };
    return {
      account,
      status: 'unconfirmed' as const,
      taxAccount: defaultTaxAccountFor(account),
      businessPercent: 100,
      basis: null,
    };
  });
}

/** 業務用語の公開名。旧来の setting 解決と同じ実装を二重化しない。 */
export const resolveTaxAccountPolicies = resolveTaxAccountSettings;

/** 決算書1科目の内訳1行。どの帳簿科目からいくら来たかを残す */
export interface TaxReturnSource {
  /** 帳簿上の科目名 */
  account: string;
  /** 按分前 */
  gross: number;
  /** 按分後(申告額) */
  amount: number;
  /** 事業割合(%)。全額でも 100 を明示する */
  businessPercent: number;
  basis: string | null;
}

/** 決算書の1欄 */
export interface TaxReturnRow {
  /** 決算書の科目名 */
  taxAccount: string;
  /** 決算書に印字済みか。false なら空欄行に自分で科目名を書く */
  printed: boolean;
  /** 按分前の合計 */
  gross: number;
  /** 申告する金額(按分後) */
  amount: number;
  /** 家事分として経費から外した額 */
  privateAmount: number;
  /** 複数の帳簿科目が同じ欄に集まることがある(通信費 と サブスク・通信 など) */
  sources: TaxReturnSource[];
}

/** 決算書科目に割り当てられていない科目。金額があるほど放置できない */
export interface UnassignedAccount {
  account: string;
  gross: number;
}

export interface TaxReturnStatement {
  /** 対象月(Dataset の期間そのもの。年で切るのは呼び出し側の責任) */
  months: string[];
  /** 売上(収入)金額 */
  revenue: number;
  /** 決算書に印字されている欄。金額0の欄は落とす(転記時に書かないため) */
  printedRows: TaxReturnRow[];
  /** 決算書の空欄行に自分で書き足す科目 */
  blankRows: TaxReturnRow[];
  /** 経費欄ではなく専用欄に書く科目(専従者給与など) */
  separateRows: TaxReturnRow[];
  /** 決算書科目が決まっていない科目。ここが空でないと申告額は確定しない */
  unassigned: UnassignedAccount[];
  /** 経費計(印字＋空欄。専用欄は含まない) */
  expenseTotal: number;
  /** 家事按分で経費から外した合計 */
  privateTotal: number;
  /** 青色申告特別控除前の所得金額の概算 = 売上 − 経費計 − 専用欄 */
  incomeBeforeDeduction: number;
  /** この表がまだ見ていないもの。画面と書き出しの両方に必ず出す */
  limits: string[];
}

const sum = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0);

const buildRow = (taxAccount: string, sources: TaxReturnSource[]): TaxReturnRow => {
  const gross = sum(sources.map((s) => s.gross));
  const amount = sum(sources.map((s) => s.amount));
  return {
    taxAccount,
    printed: PRINTED.has(taxAccount),
    gross,
    amount,
    privateAmount: gross - amount,
    sources: [...sources].sort((a, b) => b.gross - a.gross),
  };
};

/**
 * 決算書への転記シート。
 *
 * 呼び出し側も対象年に切るが、ここでも taxYear 以外の月を集計しない。
 * エクスポート経路が将来増えても、別年の数字が黙って混ざらないための二重の境界。
 */
export function taxReturnStatement(
  data: Dataset,
  taxYear: TaxYear,
  settings: readonly TaxAccountSetting[],
): TaxReturnStatement {
  const monthIndexes = data.months
    .map((month, index) => ({ month, index }))
    .filter(({ month }) => month.startsWith(`${taxYear}-`));
  const resolved = resolveTaxAccountSettings(taxYear, data.biz.categories, settings);

  const byTaxAccount = new Map<string, TaxReturnSource[]>();
  const unassigned: UnassignedAccount[] = [];

  for (const setting of resolved) {
    const series = catSeries(data, setting.account);
    const gross = sum(monthIndexes.map(({ index }) => series[index] ?? 0));
    if (gross === 0) continue;
    // 帳簿側で収入・事業主貸と明示された行は、経費の未割当にも含めない。
    if (REVENUE.has(setting.account.trim()) || NON_EXPENSE.has(setting.account.trim())) continue;

    const target = setting.taxAccount?.trim() || null;
    if (!target) {
      unassigned.push({ account: setting.account, gross });
      continue;
    }
    // 収入科目・事業主貸は経費ではない。経費計に混ぜると所得が過小になる
    if (REVENUE.has(target) || NON_EXPENSE.has(target)) continue;

    const source: TaxReturnSource = {
      account: setting.account,
      gross,
      amount: apportion(gross, setting.businessPercent),
      businessPercent: setting.businessPercent,
      basis: setting.basis,
    };
    const list = byTaxAccount.get(target);
    if (list) list.push(source);
    else byTaxAccount.set(target, [source]);
  }

  const printedRows: TaxReturnRow[] = [];
  const blankRows: TaxReturnRow[] = [];
  const separateRows: TaxReturnRow[] = [];
  for (const [taxAccount, sources] of byTaxAccount) {
    const row = buildRow(taxAccount, sources);
    if (SEPARATE.has(taxAccount)) separateRows.push(row);
    else if (row.printed) printedRows.push(row);
    else blankRows.push(row);
  }

  // 印字欄は決算書の並びのまま。空欄行は金額の大きい順(書き足す優先度がそのまま並ぶ)
  printedRows.sort((a, b) => (PRINTED_ORDER.get(a.taxAccount) ?? 0) - (PRINTED_ORDER.get(b.taxAccount) ?? 0));
  blankRows.sort((a, b) => b.amount - a.amount);
  separateRows.sort((a, b) => b.amount - a.amount);

  const revenue = sum(monthIndexes.map(({ index }) => data.biz.revenue[index] ?? 0));
  const expenseRows = [...printedRows, ...blankRows];
  const expenseTotal = sum(expenseRows.map((r) => r.amount));
  const separateTotal = sum(separateRows.map((r) => r.amount));
  const privateTotal = sum([...expenseRows, ...separateRows].map((r) => r.privateAmount));

  const limits = [
    '減価償却費・棚卸などの決算整理は入っていません。別に計算して欄へ足してください。',
    '青色申告特別控除(最大65万円)は引く前の金額です。',
    '所得控除(社会保険料・生命保険料・基礎控除など)は確定申告書側で入れます。',
    '消費税は税込のまま集計しています。',
  ];
  if (unassigned.length)
    limits.unshift(
      `決算書の科目が決まっていない科目が${unassigned.length}件（計 ${sum(unassigned.map((u) => u.gross)).toLocaleString('ja-JP')}円）あります。割り当てるまで経費計に入っていません。`,
    );

  return {
    months: monthIndexes.map(({ month }) => month),
    revenue,
    printedRows,
    blankRows,
    separateRows,
    unassigned,
    expenseTotal,
    privateTotal,
    incomeBeforeDeduction: revenue - expenseTotal - separateTotal,
    limits,
  };
}

/* ======================== 申告準備チェック ======================== */

/**
 * 準備の段階。
 * `blocked` は「このまま申告すると数字が間違っている」、`warn` は「間違いではないが説明できない」、
 * `ok` は「見た。問題なし」。この3つを混ぜると、利用者は全部を等しく無視するようになる。
 */
export type TaxReadinessLevel = 'blocked' | 'warn' | 'ok';

export interface TaxReadinessCheck {
  id: string;
  /** 何を確かめたか(1行) */
  title: string;
  level: TaxReadinessLevel;
  /** いまの状態。数字を必ず入れる */
  detail: string;
  /** 次にやること。level が ok のときは空 */
  action: string;
  /** 対応する画面のパス。無ければ null */
  href: string | null;
}

export interface TaxReadinessInput {
  /** 対象年 */
  year: TaxYear;
  statement: TaxReturnStatement;
  /** 対象年の方針行が無く、まだ判断を確定していない帳簿科目 */
  unconfirmedPolicies: readonly string[];
  /** 公私の判定が「既定」のまま残っている件数 */
  reviewPending: number;
  /** 対象期間の明細総数 */
  txTotal: number;
  /** 証憑の未添付 */
  receipts: {
    requiredCount: number;
    missingCount: number;
    mustMissingCount: number;
    missingAmount: number;
    coverage: number;
  };
  /** 家事按分の対象になりやすいのに按分率が未設定の科目 */
  ratioUnsetAccounts: readonly string[];
  /** 個人口座から出た事業経費(事業立替)の合計。freee 未登録なら申告漏れ */
  bizAdvanceTotal: number;
  /** 取り込めている YYYY-MM。件数ではなく対象年の1..12月と照合する。 */
  coveredMonths: readonly string[];
}

/** 家事按分を設定しないまま申告すると説明に困りやすい科目 */
export const HOUSEHOLD_RATIO_SENSITIVE_ACCOUNTS: readonly string[] = [
  '地代家賃',
  '水道光熱費',
  '通信費',
  '車両費',
] as const;

const yen = (n: number): string => `${Math.round(n).toLocaleString('ja-JP')}円`;

/**
 * 申告できる状態かを1画面で判定する。
 *
 * 「エクスポートを押す前に何を直すべきか」だけを返す。
 * 出力の順序は blocked → warn → ok の固定で、直す順序がそのまま並ぶ。
 */
export function taxReturnReadiness(input: TaxReadinessInput): TaxReadinessCheck[] {
  const checks: TaxReadinessCheck[] = [];
  const expectedMonths = Array.from(
    { length: 12 },
    (_, index) => `${input.year}-${String(index + 1).padStart(2, '0')}`,
  );
  const covered = new Set(input.coveredMonths);
  const missingMonths = expectedMonths.filter((month) => !covered.has(month));
  const exactCalendarYear =
    input.coveredMonths.length === 12 &&
    missingMonths.length === 0 &&
    covered.size === 12 &&
    [...covered].every((month) => month.startsWith(`${input.year}-`));

  checks.push(
    exactCalendarYear
      ? {
          id: 'months',
          title: `${input.year}年の12ヶ月ぶんが揃っている`,
          level: 'ok',
          detail: '1月から12月まで取り込み済み',
          action: '',
          href: null,
        }
      : {
          id: 'months',
          title: '取り込めていない月がある',
          level: 'blocked',
          detail:
            missingMonths.length > 0
              ? `${input.year}年の ${missingMonths.map((month) => Number(month.slice(5))).join('・')}月がありません`
              : `${input.year}年以外または重複した月が混ざっています`,
          action: '残りの月の freee / MF の CSV を取り込む',
          href: '/import',
        },
  );

  checks.push(
    input.unconfirmedPolicies.length === 0
      ? {
          id: 'tax-policy',
          title: '全科目の申告方針を確認済み',
          level: 'ok',
          detail: '転記先と事業割合を確定済み',
          action: '',
          href: null,
        }
      : {
          id: 'tax-policy',
          title: '申告方針を確認していない科目がある',
          level: 'blocked',
          detail: `${input.unconfirmedPolicies.length}科目（${input.unconfirmedPolicies.join('・')}）の設定行がありません`,
          action: '転記先と事業割合を確認し、100%でも明示保存する',
          href: '/tax',
        },
  );

  checks.push(
    input.statement.unassigned.length === 0
      ? {
          id: 'tax-account',
          title: '全科目が決算書の科目に割り当て済み',
          level: 'ok',
          detail: '未割当なし',
          action: '',
          href: null,
        }
      : {
          id: 'tax-account',
          title: '決算書のどの欄に書くか決まっていない科目がある',
          level: 'blocked',
          detail: `${input.statement.unassigned.length}科目・計 ${yen(
            input.statement.unassigned.reduce((s, u) => s + u.gross, 0),
          )}が経費計に入っていません`,
          action: '割り当てを設定する(未割当のままだと所得が過大になります)',
          href: '/tax',
        },
  );

  checks.push(
    input.reviewPending === 0
      ? {
          id: 'classify',
          title: '公私の仕分けが一巡している',
          level: 'ok',
          detail: `${input.txTotal}件すべてを判定済み`,
          action: '',
          href: null,
        }
      : {
          id: 'classify',
          title: '公私を判断していない明細が残っている',
          level: 'blocked',
          detail: `${input.reviewPending}件が未判断のまま「個人」として扱われています`,
          action: '公私仕分けで確定する(事業経費の計上漏れになります)',
          href: '/classify',
        },
  );

  const unsetSensitive = input.ratioUnsetAccounts.filter((a) =>
    HOUSEHOLD_RATIO_SENSITIVE_ACCOUNTS.includes(a),
  );
  checks.push(
    unsetSensitive.length === 0
      ? {
          id: 'household-ratio',
          title: '家事按分の設定を確認済み',
          level: 'ok',
          detail: '按分が要る科目に率が入っています',
          action: '',
          href: null,
        }
      : {
          id: 'household-ratio',
          title: '家事按分が未設定の科目がある',
          level: 'warn',
          detail: `${unsetSensitive.join('・')} が全額経費のまま`,
          action: '事業割合と、その根拠を入れる',
          href: '/tax',
        },
  );

  checks.push(
    input.receipts.missingCount === 0
      ? {
          id: 'receipts',
          title: '事業経費に証憑が揃っている',
          level: 'ok',
          detail: `${input.receipts.requiredCount}件すべてに添付あり`,
          action: '',
          href: null,
        }
      : {
          id: 'receipts',
          title: '領収書が付いていない事業経費がある',
          level: input.receipts.mustMissingCount > 0 ? 'blocked' : 'warn',
          detail: `${input.receipts.missingCount}件・計 ${yen(input.receipts.missingAmount)}が未添付`,
          action: '金額の大きい順に添付する',
          href: '/tax/receipts',
        },
  );

  checks.push(
    input.bizAdvanceTotal === 0
      ? {
          id: 'biz-advance',
          title: '個人口座からの事業立替なし',
          level: 'ok',
          detail: '立替の残りはありません',
          action: '',
          href: null,
        }
      : {
          id: 'biz-advance',
          title: '個人の口座から出た事業経費がある',
          level: 'warn',
          detail: `${yen(input.bizAdvanceTotal)}ぶん。freee に登録していないと経費に入りません`,
          action: 'freee 側に事業主借として登録済みか確認する',
          href: '/classify',
        },
  );

  const rank: Record<TaxReadinessLevel, number> = { blocked: 0, warn: 1, ok: 2 };
  return checks.sort((a, b) => rank[a.level] - rank[b.level]);
}

/** 全体の判定。ダウンロードボタンの出し方を決めるのに使う */
export function taxReadinessVerdict(checks: readonly TaxReadinessCheck[]): TaxReadinessLevel {
  if (checks.some((c) => c.level === 'blocked')) return 'blocked';
  if (checks.some((c) => c.level === 'warn')) return 'warn';
  return 'ok';
}

/* ======================== 書き出し ======================== */

/** 決算書転記シートCSVの列。上から順に決算書へ書き写せる並びにする */
export const TAX_STATEMENT_EXPORT_HEADER = [
  '区分',
  '決算書の科目',
  '申告額',
  '按分前',
  '家事分',
  '事業割合(%)',
  '内訳(帳簿科目)',
  '按分の根拠',
] as const;

const percentCell = (row: TaxReturnRow): string => {
  const percents = [...new Set(row.sources.map((s) => s.businessPercent))];
  return percents.length === 1 ? String(percents[0]) : '科目ごとに異なる';
};

const sourcesCell = (row: TaxReturnRow): string =>
  row.sources.map((s) => `${s.account} ${s.gross.toLocaleString('ja-JP')}円`).join(' / ');

const basisCell = (row: TaxReturnRow): string =>
  [...new Set(row.sources.map((s) => s.basis).filter((b): b is string => Boolean(b)))].join(' / ');

/**
 * 決算書へ手入力するための1枚。
 * 上から順に読めば転記が終わる並びにし、根拠も同じ行に置く。
 * 根拠を別ファイルにすると、税務調査のときに「この率は何」を誰も再現できない。
 */
export function taxStatementExportRows(st: TaxReturnStatement): (string | number)[][] {
  const rows: (string | number)[][] = [];
  rows.push(['収入', '売上(収入)金額', st.revenue, st.revenue, 0, 100, '', '']);

  const push = (label: string, list: readonly TaxReturnRow[]) => {
    for (const r of list)
      rows.push([
        label,
        r.taxAccount,
        r.amount,
        r.gross,
        r.privateAmount,
        percentCell(r),
        sourcesCell(r),
        basisCell(r),
      ]);
  };
  push('経費(印字欄)', st.printedRows);
  push('経費(空欄に記入)', st.blankRows);
  push('専用欄', st.separateRows);

  rows.push(['計', '経費計', st.expenseTotal, '', st.privateTotal, '', '', '']);
  rows.push(['計', '青色申告特別控除前の所得金額', st.incomeBeforeDeduction, '', '', '', '', '']);

  for (const u of st.unassigned)
    rows.push(['要対応', '(決算書の科目が未割当)', 0, u.gross, '', '', u.account, '割り当ててください']);

  rows.push([]);
  for (const l of st.limits) rows.push(['注意', l]);
  return rows;
}
