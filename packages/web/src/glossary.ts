/**
 * 用語辞書(単一の正本)。
 * - 画面上の用語ホバー(`<Term id="…">`)と「指標ガイド」ページの説明は、どちらもこの辞書から生成する(二重管理しない)。
 * - 定義は packages/core/src/analysis.ts の計算式に合わせる。式を変えたらここも直す。
 * - 画面に実際に出ている用語だけを載せる(未使用の項目は scripts/check-glossary.mjs が検出する)。
 */

/**
 * 略語の展開。「CV」「BS」のようなアルファベットだけの表記は、
 * ホバーの説明文を読んでも「何の略か」が分からないままになりやすい。
 * 元の英語と日本語の呼び方を持たせ、指標ガイドの「略語の読み方」に一覧で出す。
 */
export interface Abbreviation {
  /** 画面や資料に出てくる略語そのもの */
  abbr: string;
  /** 略語の元になった英語 */
  full: string;
  /** 日本語での呼び方 */
  ja: string;
}

export interface GlossaryEntry {
  /** 画面に出す用語(短い表記) */
  term: string;
  /** ホバーで出す1〜2文の説明(全角80字以内を目安) */
  short: string;
  /** 指標ガイドに出す説明。無ければ short を使う */
  desc?: string;
  /** 目安・判定基準(指標ガイド用) */
  bench?: string;
  /**
   * AIレポート本文などの自由文で自動的にホバー化する表記(表記ゆれの受け皿)。省略すると term だけを見る。
   *
   * 実レポートは同じ概念を「損益分岐点」「損益分岐」「BEP」のように書き分けるため、
   * 読み手が引ける入口をここで増やす。逆に term が短すぎて誤爆する語(「版」など)は、
   * ここに長い表記だけを並べることで **絞る** 用途にも使う。
   * 別名同士の重複・取り違えは scripts/check-glossary.mjs と glossary.test.tsx が検査する。
   */
  aliases?: readonly string[];
  /** アルファベットの略語を使っている用語だけ。指標ガイドの「略語の読み方」に出る */
  abbr?: Abbreviation;
}

export const GLOSSARY = {
  defenseLine: {
    term: '防衛ライン',
    short:
      '毎月最低これだけ出ていく金額。個人の生活費(直近3ヶ月平均)+事業の固定費。これより多く稼ぐ必要がある。',
    desc: '個人生活費の直近3ヶ月平均+事業固定費。毎月最低これだけ出ていく=これ以上稼ぐ必要がある金額。',
    bench: '収入見込みが110%以上で「余裕」、100%未満は「要注意」',
    aliases: ['防衛ライン', '防衛線', '最低稼得基準額', '最低必要月商'],
  },
  cv: {
    term: 'CV',
    short: '変動係数。月ごとの金額のブレの大きさ(標準偏差÷平均)。小さいほど毎月同じ額=固定費。',
    desc: '標準偏差÷平均。月ごとのブレの大きさ。小さいほど毎月同じ額=固定費。',
    bench: '0.6未満=固定費 / 0.6〜1.5=準変動 / 1.5超=スポット',
    aliases: ['変動係数', 'CV', 'ばらつき係数'],
    abbr: { abbr: 'CV', full: 'Coefficient of Variation', ja: '変動係数' },
  },
  mannKendall: {
    term: 'Mann-Kendall検定',
    short:
      '増えているか減っているかを、金額そのものではなく「前より上がった月が何回あるか」で判定する方法。単発の大きな支払い1件に振り回されない。',
    desc: '全ての月の組み合わせで前後の大小を数え、増えた組が偶然では説明できないほど多いかを見る順位ベースの検定。金額の大きさを使わないので、1件だけ極端に大きい支払いがあっても「増加」と判定されにくい。',
    bench: 'p<0.05 で「増加」または「減少」、それ以外は「横ばい」。6ヶ月未満は「判定不可」',
    aliases: ['Mann-Kendall検定', 'マンケンドール検定', '傾向検定'],
  },
  theilSen: {
    term: 'Theil-Sen傾き',
    short: '月あたりいくら増えているかの目安。全ての2点間の傾きを出し、その真ん中の値を採る。',
    desc: '全ての月のペアについて傾き(金額差÷月数差)を計算し、その中央値を傾きとする。平均ではなく中央値なので、単発の高額支払いが1件混ざっても値がほとんど動かない。',
    bench: '傾き×12を「1年続いた場合の差」として示す',
    aliases: ['Theil-Sen傾き', 'タイル・セン推定', 'Theil-Sen'],
  },
  zScore: {
    term: 'z',
    short: 'zスコア。直近月が普段からどれだけ離れているか((直近値−平均)÷標準偏差)。2以上で「要確認」。',
    desc: '(直近値−平均)÷標準偏差。直近月が普段からどれだけ離れているか。',
    bench: 'z≥2で「要確認」、1≤z<2「やや高い」、z≤−1「低め」',
    aliases: ['zスコア', 'z値', 'Zスコア', 'Z値', '標準化得点'],
    abbr: { abbr: 'z', full: 'z-score (standard score)', ja: '標準化得点' },
  },
  breakEven: {
    term: '損益分岐点',
    short: '固定費に分類された科目の直近3ヶ月平均の合計。月商がこれを下回ると赤字。',
    desc: '固定費に分類された科目の直近3ヶ月平均合計。これを下回る月商だと赤字。',
    bench: '安全余裕率30%以上が望ましい',
    aliases: ['損益分岐点売上高', '損益分岐点売上', '損益分岐点', '損益分岐', 'BEP'],
    abbr: { abbr: 'BEP', full: 'Break-Even Point', ja: '損益分岐点' },
  },
  safetyMargin: {
    term: '安全余裕率',
    short: '月商が損益分岐点をどれだけ上回っているかの割合((月商−損益分岐点)÷月商)。30%以上が望ましい。',
    bench: '30%以上が望ましい',
    aliases: ['安全余裕率', '安全余裕度', '安全余裕'],
  },
  pareto: {
    term: '累積構成比',
    short: '経費を大きい順に並べて上から足し上げたときの割合(パレート)。上位少数の科目が大半を占める。',
    desc: '経費を大きい順に並べたときの累積比率。上位少数の科目が大半を占める。',
    bench: '82%以内の科目が管理の主戦場',
    aliases: ['累積構成比', 'パレート分析', 'パレート', '累積比率'],
  },
  annualized: {
    term: '年換算',
    short:
      '実績を12ヶ月分に引き伸ばした値(合計÷記帳月数×12、または月額×12)。年の途中でも通年ペースで比べるための数字。',
    desc: '今年の実績合計÷記帳月数×12。年の途中でも通年ペースで比較するための値。',
    bench: '前年実績との比較で増減を判断',
    aliases: ['年換算', '年間換算', '年率換算'],
  },
  subsDup: {
    term: '重複契約疑い',
    short: '月額がそのベンダーの普段(中央値)の1.8倍超かつ2万円超。同じサービスを二重に契約している可能性。',
    desc: '月額がそのベンダーの中央値の1.8倍超かつ2万円超(中央値5千円超)。二重契約の可能性。',
    bench: '解約・統合で月額を中央値まで戻せるか確認',
    aliases: ['重複契約疑い', '重複疑い', '重複サブスク', '二重契約'],
  },
  subsSpike: {
    term: '急増',
    short: '月額がそのベンダーの普段(中央値)の3倍超かつ1.5万円超。プラン変更や課金ミスの可能性。',
    desc: '月額がそのベンダーの中央値の3倍超かつ1.5万円超。プラン変更・課金ミスの可能性。',
    bench: '明細で単発か継続かを確認',
    // 「急増」単体は交際費などの普通の文章にも出るため、サブスク文脈だと分かる表記だけを入口にする
    aliases: ['サブスクの急増', 'サブスク急増', '月額の急増'],
  },
  explainability: {
    term: '説明可能率',
    short: '個人支出のうち「未分類」「現金・カード引落」以外の割合。家計がどこまで見える化できているか。',
    desc: '個人支出のうち「未分類」「現金・カード」以外の割合。家計の見える化の度合い。',
    bench: '80%以上を維持したい',
    aliases: ['説明可能率', '説明可能割合', '説明可能性'],
  },
  expenseRatio: {
    term: '経費率',
    short: '売上に対する経費の割合(経費÷売上)。',
    bench: '20〜40%が目安(業種により前後)',
    aliases: ['売上高経費率', '経費比率', '経費率'],
  },
  movingAvg: {
    term: '3ヶ月移動平均',
    short: '直近3ヶ月の平均を毎月ずらして描いた線。単月のブレをならして傾向を見る。',
    aliases: ['3ヶ月移動平均', '3か月移動平均', '3カ月移動平均', '三ヶ月移動平均', '移動平均'],
  },
  fixedCost: {
    term: '固定費',
    short: '毎月ほぼ同じ額が出ていく科目(CVが0.6未満)。診断では直近3ヶ月平均で合計する。',
    bench: '固定費の合計が損益分岐点になる',
    aliases: ['固定費'],
  },
  median: {
    term: '中央値',
    short: '金額を小さい順に並べたときの真ん中の値。極端な月に引っ張られにくい「普段の額」。',
    aliases: ['中央値', 'メジアン'],
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
    aliases: ['貯蓄率', '貯蓄割合'],
  },
  bizAdvance: {
    term: '事業立替',
    short: '個人の口座・カードで払った事業の経費。家計の支出計には含めるが生活費とは分けて見る。',
    aliases: ['事業立て替え', '事業立替', '立替経費'],
  },
  revenueShare: {
    term: '対売上比',
    short: '売上に対するサブスク合計の割合(サブスク÷売上)。',
    bench: '15%以下',
    aliases: ['対売上比率', '対売上比', '売上対比'],
  },
  classification: {
    term: '分類',
    short: 'CVによる自動分類。0.6未満=固定費、0.6〜1.5=準変動、1.5超=スポット(不定期)。',
    aliases: ['準変動費', '準変動', 'スポット費用', 'スポット'],
  },
  unrecordedMonth: {
    term: '未記帳月',
    short: '経費が1件も記帳されていない月。入力前とみなし、平均・CV・年換算などの統計から除く。',
    aliases: ['未記帳月', '未入力月', '未記帳'],
  },
  publicPrivate: {
    term: '公私',
    short: '明細ごとの「事業(freee)か個人(MF)か」の区分。ここを決めると科目の候補が変わる。',
    aliases: ['公私仕分け', '公私区分', '公私判定', '公私'],
  },
  reportType: {
    term: '型',
    short: 'レポートの型。対象期間の長さで決まる: 1ヶ月=月次、2〜13ヶ月=年間、14ヶ月以上=長期。',
    aliases: ['レポートの型', 'レポート型'],
  },
  reportVersion: {
    term: '版',
    short: '同じ期間で再分析するたびに1つ増える番号。前回の指摘がどうなったかを追うために使う。',
    // term の「版」単体だと「HTML版」の一部まで拾ってしまうので、自由文では長い表記だけを入口にする
    aliases: ['レポートの版', 'レポート版', '版数'],
  },
  mergedJson: {
    term: '統合JSON',
    short: 'HTML版から書き出した、MFとfreeeを1つにまとめた取込ファイル。',
    aliases: ['統合JSON'],
  },
  contribution: {
    term: '寄与度',
    short: '前期から今期への増減額を科目ごとに分けたもの。合計すると経費全体の増減と一致する(図3の階段)。',
    desc: '科目別の増減額(今期−前期)。全科目の寄与度を足すと経費全体の増減になる。',
    bench: '上位3科目で増減の大半を説明できれば、対策はその3科目に絞れる',
    aliases: ['増減寄与', '寄与度', '寄与額'],
  },
  sigmaBand: {
    term: '±2σ',
    short: '平均から標準偏差2つ分の幅。この帯の外に出た月は「普段と違う月」として理由を確認する対象。',
    desc: '平均±2×標準偏差の帯。正規分布ならこの外に出るのは約5%だけ。',
    bench: '帯の外かつ1万円超の差がある月を外れ値として扱う',
    aliases: ['±2シグマ', '±2σ', '2シグマ', '2σ', '外れ値'],
    abbr: { abbr: 'σ', full: 'sigma (standard deviation)', ja: '標準偏差' },
  },
  pl: {
    term: 'PL(損益計算書)',
    short:
      '一定期間の売上と経費を並べ、いくら儲かったかを示す表。Profit and Loss statement の略。期間中に動いた金額を見る。',
    desc: '期間中の売上から経費を引いて利益を出す表。この画面では確定申告の分類で経費をまとめている。',
    bench: '利益率(利益÷売上)が前期より下がっていないかを見る',
    aliases: ['損益計算書', 'P/L'],
    abbr: { abbr: 'PL', full: 'Profit and Loss statement', ja: '損益計算書' },
  },
  bs: {
    term: 'BS(貸借対照表)',
    short:
      'ある時点の資産・負債・純資産の残高を示す表。Balance Sheet の略。取引を足しても出ず、期首の残高が要る。',
    desc: '決算日など「ある一日」の残高の表。左に資産、右に負債と純資産が並び、左右の合計が必ず一致する。',
    bench: '自己資本比率(純資産÷資産)30%以上が目安',
    aliases: ['貸借対照表', 'バランスシート', 'B/S'],
    abbr: { abbr: 'BS', full: 'Balance Sheet', ja: '貸借対照表' },
  },
  cashFlow: {
    term: 'キャッシュフロー',
    short: '期間中に現金が実際いくら増えたか。売掛・買掛のズレがあるので、利益とは一致しない。',
    desc: '利益に「まだ入金されていない売上」「まだ払っていない経費」を差し引きして、現金の動きに直したもの。',
    bench: '利益が黒字でもキャッシュフローが続けてマイナスなら資金繰りが危ない',
    aliases: ['キャッシュフロー', '資金繰り'],
  },
  bcp: {
    term: 'BCP(事業継続計画)',
    short:
      '売上が止まっても事業を続けるための備え。Business Continuity Plan の略。手元資金が何ヶ月もつかから考える。',
    desc: '災害・取引先の離脱・体調不良などで売上が止まったときに、事業をどう続けるかを決めておく計画。',
    bench: '固定費の6ヶ月分の手元資金が一つの目安',
    aliases: ['事業継続計画', 'BCP'],
    abbr: { abbr: 'BCP', full: 'Business Continuity Plan', ja: '事業継続計画' },
  },
  runway: {
    term: 'ランウェイ',
    short: '手元資金 ÷ 毎月の固定費。売上がゼロになっても何ヶ月もつかの月数。',
    bench: '6ヶ月以上あると打ち手を考える時間が取れる',
    aliases: ['ランウェイ', '資金持続月数'],
  },
  yoy: {
    term: '前年比(換算)',
    short: '今年の年換算÷前年の実績。未記帳月は除いて計算する。',
    aliases: ['前年同月比', '前年同期比', '前年同月', '前年対比', '前年比'],
    abbr: { abbr: 'YoY', full: 'Year over Year', ja: '前年比' },
  },
} as const satisfies Record<string, GlossaryEntry>;

export type TermId = keyof typeof GLOSSARY;

/** 指標ガイドに並べる順(業務上の重要度順) */
export const GUIDE_ORDER: readonly TermId[] = [
  'pl',
  'bs',
  'cashFlow',
  'defenseLine',
  'breakEven',
  'safetyMargin',
  'expenseRatio',
  'annualized',
  'yoy',
  'pareto',
  'cv',
  'mannKendall',
  'theilSen',
  'classification',
  'fixedCost',
  'median',
  'range',
  'zScore',
  'sigmaBand',
  'contribution',
  'movingAvg',
  'subsDup',
  'subsSpike',
  'revenueShare',
  'explainability',
  'savingsRate',
  'bizAdvance',
  'runway',
  'bcp',
  'unrecordedMonth',
  'publicPrivate',
  'reportType',
  'reportVersion',
  'mergedJson',
];

/**
 * 略語の一覧。指標ガイドの「略語の読み方」に出す。
 * 並びは GUIDE_ORDER に従う(ガイド本文と行き来したときに順番が変わらない)。
 */
export const ABBREVIATIONS: readonly { id: TermId; abbr: Abbreviation; meaning: string }[] =
  GUIDE_ORDER.flatMap((id) => {
    const e = GLOSSARY[id] as GlossaryEntry;
    return e.abbr ? [{ id, abbr: e.abbr, meaning: e.desc ?? e.short }] : [];
  });

/** 自由文の中で辞書の用語を探すための一覧(長い表記から先に照合する) */
export const TERM_ALIASES: readonly { id: TermId; text: string }[] = (
  Object.entries(GLOSSARY) as [TermId, GlossaryEntry][]
)
  .flatMap(([id, e]) => (e.aliases ?? [e.term]).map((text) => ({ id, text })))
  .sort((a, b) => b.text.length - a.text.length);
