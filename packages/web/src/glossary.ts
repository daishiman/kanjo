/**
 * 用語辞書(単一の正本)。
 * - 画面上の用語ホバー(`<Term id="…">`)と「指標ガイド」ページの説明は、どちらもこの辞書から生成する(二重管理しない)。
 * - 定義は packages/core/src/analysis.ts の計算式に合わせる。式を変えたらここも直す。
 * - 画面に実際に出ている用語だけを載せる(未使用の項目は scripts/check-glossary.mjs が検出する)。
 */
export interface GlossaryEntry {
  /** 画面に出す用語(短い表記) */
  term: string;
  /** ホバーで出す1〜2文の説明(全角80字以内を目安) */
  short: string;
  /** 指標ガイドに出す説明。無ければ short を使う */
  desc?: string;
  /** 目安・判定基準(指標ガイド用) */
  bench?: string;
  /** AIレポート本文などの自由文で自動的にホバー化する表記。term と同じなら省略可 */
  aliases?: readonly string[];
}

export const GLOSSARY = {
  defenseLine: {
    term: '防衛ライン',
    short:
      '毎月最低これだけ出ていく金額。個人の生活費(直近3ヶ月平均)+事業の固定費。これより多く稼ぐ必要がある。',
    desc: '個人生活費の直近3ヶ月平均+事業固定費。毎月最低これだけ出ていく=これ以上稼ぐ必要がある金額。',
    bench: '収入見込みが110%以上で「余裕」、100%未満は「要注意」',
    aliases: ['防衛ライン', '防衛線', '最低稼得基準額'],
  },
  cv: {
    term: 'CV',
    short: '変動係数。月ごとの金額のブレの大きさ(標準偏差÷平均)。小さいほど毎月同じ額=固定費。',
    desc: '標準偏差÷平均。月ごとのブレの大きさ。小さいほど毎月同じ額=固定費。',
    bench: '0.6未満=固定費 / 0.6〜1.5=準変動 / 1.5超=スポット',
    aliases: ['変動係数', 'CV'],
  },
  zScore: {
    term: 'z',
    short: 'zスコア。直近月が普段からどれだけ離れているか((直近値−平均)÷標準偏差)。2以上で「要確認」。',
    desc: '(直近値−平均)÷標準偏差。直近月が普段からどれだけ離れているか。',
    bench: 'z≥2で「要確認」、1≤z<2「やや高い」、z≤−1「低め」',
    aliases: ['zスコア', 'z値'],
  },
  breakEven: {
    term: '損益分岐点',
    short: '固定費に分類された科目の直近3ヶ月平均の合計。月商がこれを下回ると赤字。',
    desc: '固定費に分類された科目の直近3ヶ月平均合計。これを下回る月商だと赤字。',
    bench: '安全余裕率30%以上が望ましい',
    aliases: ['損益分岐点', 'BEP'],
  },
  safetyMargin: {
    term: '安全余裕率',
    short: '月商が損益分岐点をどれだけ上回っているかの割合((月商−損益分岐点)÷月商)。30%以上が望ましい。',
    bench: '30%以上が望ましい',
  },
  pareto: {
    term: '累積構成比',
    short: '経費を大きい順に並べて上から足し上げたときの割合(パレート)。上位少数の科目が大半を占める。',
    desc: '経費を大きい順に並べたときの累積比率。上位少数の科目が大半を占める。',
    bench: '82%以内の科目が管理の主戦場',
    aliases: ['累積構成比', 'パレート'],
  },
  annualized: {
    term: '年換算',
    short:
      '実績を12ヶ月分に引き伸ばした値(合計÷記帳月数×12、または月額×12)。年の途中でも通年ペースで比べるための数字。',
    desc: '今年の実績合計÷記帳月数×12。年の途中でも通年ペースで比較するための値。',
    bench: '前年実績との比較で増減を判断',
  },
  subsDup: {
    term: '重複契約疑い',
    short: '月額がそのベンダーの普段(中央値)の1.8倍超かつ2万円超。同じサービスを二重に契約している可能性。',
    desc: '月額がそのベンダーの中央値の1.8倍超かつ2万円超(中央値5千円超)。二重契約の可能性。',
    bench: '解約・統合で月額を中央値まで戻せるか確認',
    aliases: ['重複契約疑い', '重複疑い', '重複サブスク'],
  },
  subsSpike: {
    term: '急増',
    short: '月額がそのベンダーの普段(中央値)の3倍超かつ1.5万円超。プラン変更や課金ミスの可能性。',
    desc: '月額がそのベンダーの中央値の3倍超かつ1.5万円超。プラン変更・課金ミスの可能性。',
    bench: '明細で単発か継続かを確認',
    aliases: ['サブスク急増'],
  },
  explainability: {
    term: '説明可能率',
    short: '個人支出のうち「未分類」「現金・カード引落」以外の割合。家計がどこまで見える化できているか。',
    desc: '個人支出のうち「未分類」「現金・カード」以外の割合。家計の見える化の度合い。',
    bench: '80%以上を維持したい',
  },
  expenseRatio: {
    term: '経費率',
    short: '売上に対する経費の割合(経費÷売上)。',
    bench: '20〜40%が目安(業種により前後)',
  },
  movingAvg: {
    term: '3ヶ月移動平均',
    short: '直近3ヶ月の平均を毎月ずらして描いた線。単月のブレをならして傾向を見る。',
    aliases: ['3ヶ月移動平均', '移動平均'],
  },
  fixedCost: {
    term: '固定費',
    short: '毎月ほぼ同じ額が出ていく科目(CVが0.6未満)。診断では直近3ヶ月平均で合計する。',
    bench: '固定費の合計が損益分岐点になる',
  },
  median: {
    term: '中央値',
    short: '金額を小さい順に並べたときの真ん中の値。極端な月に引っ張られにくい「普段の額」。',
  },
  range: {
    term: '基準レンジ',
    short: 'その科目の普段の範囲(平均±標準偏差)。上限を超えた月は「レンジ超過」として削減候補に出る。',
    bench: '上限超えは「基準レンジへ戻す」候補',
    aliases: ['基準レンジ', 'レンジ超過', '通常レンジ'],
  },
  savingsRate: {
    term: '貯蓄率',
    short: '収入のうち手元に残った割合((収入−支出)÷収入)。',
    bench: '20%以上(世帯)',
  },
  bizAdvance: {
    term: '事業立替',
    short: '個人の口座・カードで払った事業の経費。家計の支出計には含めるが生活費とは分けて見る。',
  },
  revenueShare: {
    term: '対売上比',
    short: '売上に対するサブスク合計の割合(サブスク÷売上)。',
    bench: '15%以下',
  },
  classification: {
    term: '分類',
    short: 'CVによる自動分類。0.6未満=固定費、0.6〜1.5=準変動、1.5超=スポット(不定期)。',
    aliases: ['準変動', 'スポット'],
  },
  unrecordedMonth: {
    term: '未記帳月',
    short: '経費が1件も記帳されていない月。入力前とみなし、平均・CV・年換算などの統計から除く。',
    aliases: ['未記帳月', '未記帳'],
  },
  publicPrivate: {
    term: '公私',
    short: '明細ごとの「事業(freee)か個人(MF)か」の区分。ここを決めると科目の候補が変わる。',
    aliases: ['公私仕分け', '公私'],
  },
  reportType: {
    term: '型',
    short: 'レポートの型。対象期間の長さで決まる: 1ヶ月=月次、2〜13ヶ月=年間、14ヶ月以上=長期。',
    aliases: ['レポートの型'],
  },
  reportVersion: {
    term: '版',
    short: '同じ期間で再分析するたびに1つ増える番号。前回の指摘がどうなったかを追うために使う。',
  },
  mergedJson: {
    term: '統合JSON',
    short: 'HTML版から書き出した、MFとfreeeを1つにまとめた取込ファイル。',
  },
  yoy: {
    term: '前年比(換算)',
    short: '今年の年換算÷前年の実績。未記帳月は除いて計算する。',
    aliases: ['前年比', '前年同月比', '前年同月'],
  },
} as const satisfies Record<string, GlossaryEntry>;

export type TermId = keyof typeof GLOSSARY;

/** 指標ガイドに並べる順(業務上の重要度順) */
export const GUIDE_ORDER: readonly TermId[] = [
  'defenseLine',
  'breakEven',
  'safetyMargin',
  'expenseRatio',
  'annualized',
  'yoy',
  'pareto',
  'cv',
  'classification',
  'fixedCost',
  'median',
  'range',
  'zScore',
  'movingAvg',
  'subsDup',
  'subsSpike',
  'revenueShare',
  'explainability',
  'savingsRate',
  'bizAdvance',
  'unrecordedMonth',
  'publicPrivate',
  'reportType',
  'reportVersion',
  'mergedJson',
];

/** 自由文の中で辞書の用語を探すための一覧(長い表記から先に照合する) */
export const TERM_ALIASES: readonly { id: TermId; text: string }[] = (
  Object.entries(GLOSSARY) as [TermId, GlossaryEntry][]
)
  .flatMap(([id, e]) => (e.aliases ?? [e.term]).map((text) => ({ id, text })))
  .sort((a, b) => b.text.length - a.text.length);
