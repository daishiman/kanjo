/**
 * 確定申告(青色申告決算書・一般用)で使う標準の勘定科目マスタ。
 *
 * freee / MF に取込済みの科目しか選べないと、まだその科目で払ったことがない支出を記帳できない。
 * 「決算書に印字される科目」+「決算書の空欄によく書かれる定番科目」を最初から候補に入れておき、
 * 取込前でも確定申告に耐える科目で記帳できるようにする。
 *
 * 各科目には「いつ選ぶか(when)」と「具体例(examples)」を必ず持たせる。
 * 科目名だけ並べても利用者は選べない。判断の材料を科目と同じ場所に置くための持ち方。
 * 例はコンサル / AI導入支援 / SaaS サブスクを主な業務とする想定で書いている。
 */

/** 選ぶ場面で切ったグループ。決算書の印字順ではなく「何に払ったか」で辿れるようにする */
export type TaxAccountGroup =
  | 'ひと・外注'
  | 'IT・情報'
  | '移動・打合せ'
  | '場所・設備'
  | 'お金・税'
  | '売上・その他';

export const TAX_ACCOUNT_GROUPS: readonly TaxAccountGroup[] = [
  'ひと・外注',
  'IT・情報',
  '移動・打合せ',
  '場所・設備',
  'お金・税',
  '売上・その他',
] as const;

export interface TaxAccount {
  name: string;
  group: TaxAccountGroup;
  /** よく使う科目。分類を開く前の1画面目に出す */
  common: boolean;
  /** この科目を選ぶ基準(1行) */
  when: string;
  /** 具体例。コンサル / AI導入支援 / サブスクを想定 */
  examples: string[];
}

export const TAX_ACCOUNTS: readonly TaxAccount[] = [
  /* -------- ひと・外注 -------- */
  {
    name: '外注工賃',
    group: 'ひと・外注',
    common: true,
    when: '雇っていない人・会社に仕事を頼んで払った',
    examples: [
      '業務委託のエンジニアへの開発費',
      '資料作成やリサーチの外部委託',
      '相手が個人事業主・法人のどちらでもここでよい',
    ],
  },
  {
    name: '支払報酬',
    group: 'ひと・外注',
    common: false,
    when: '士業など、源泉徴収が要る専門家に払った',
    examples: ['税理士・社労士の顧問料', '弁護士への相談料', '源泉を引かないなら外注工賃でよい'],
  },
  {
    name: '給料賃金',
    group: 'ひと・外注',
    common: false,
    when: '自分が雇った従業員・アルバイトに払った',
    examples: ['アルバイトの給与', '外注(委託契約)はここではなく外注工賃'],
  },
  {
    name: '専従者給与',
    group: 'ひと・外注',
    common: false,
    when: '青色事業専従者(届出済みの家族)に払った',
    examples: ['事務を手伝う配偶者への給与(事前の届出が必要)'],
  },
  {
    name: '法定福利費',
    group: 'ひと・外注',
    common: false,
    when: '従業員の社会保険料のうち事業が負担する分',
    examples: ['従業員分の健康保険・厚生年金の事業主負担', '自分の国民健康保険は経費にならない'],
  },
  {
    name: '福利厚生費',
    group: 'ひと・外注',
    common: false,
    when: '従業員のために使った(自分ひとりの事業では基本使わない)',
    examples: ['従業員の健康診断費', '一人だけの事業で自分に使った分は経費にできない'],
  },

  /* -------- IT・情報 -------- */
  {
    name: '通信費',
    group: 'IT・情報',
    common: true,
    when: 'つながり続けるために毎月払う',
    examples: [
      '携帯・光回線(家事按分して事業分だけ)',
      'ドメイン、レンタルサーバー',
      'Zoom / Slack など連絡手段のサブスク',
    ],
  },
  {
    name: '消耗品費',
    group: 'IT・情報',
    common: true,
    when: '10万円未満のモノ、または短期間で使い切るモノを買った',
    examples: [
      'ノートPC・モニター(10万円未満)',
      '文具、ケーブル、外付けSSD',
      'AI や SaaS の月額利用料もここでよい(通信費でも可・毎月同じ科目に揃える)',
    ],
  },
  {
    name: '新聞図書費',
    group: 'IT・情報',
    common: true,
    when: '情報を仕入れるために払った',
    examples: ['技術書・ビジネス書', '有料ニュースレター、業界誌', '調査レポートの購入'],
  },
  {
    name: '研修費',
    group: 'IT・情報',
    common: false,
    when: '自分やスタッフのスキルを上げるために払った',
    examples: ['オンライン講座、資格試験の受験料', 'カンファレンス参加費(移動費は旅費交通費)'],
  },
  {
    name: '減価償却費',
    group: 'IT・情報',
    common: false,
    when: '10万円以上のモノを買い、年数に分けて費用にする',
    examples: [
      '20万円のPC(青色申告なら30万円未満は一括も可)',
      '買った月に全額入れる科目ではない。決算のときに計算する',
    ],
  },

  /* -------- 移動・打合せ -------- */
  {
    name: '旅費交通費',
    group: '移動・打合せ',
    common: true,
    when: '仕事で移動した',
    examples: ['客先訪問の電車代・タクシー代', '出張の新幹線・宿泊費', '駐車場代、ETC料金'],
  },
  {
    name: '会議費',
    group: '移動・打合せ',
    common: true,
    when: '打合せそのものにかかった(1人あたりおおむね5千円以内)',
    examples: ['商談時のカフェ代', '打合せ用に借りた会議室・コワーキング利用料', '会議中の弁当代'],
  },
  {
    name: '接待交際費',
    group: '移動・打合せ',
    common: false,
    when: '取引先との関係づくりのために払った(飲食・贈答)',
    examples: ['取引先との会食', 'お中元・手土産', '打合せが主目的なら会議費のほうが説明しやすい'],
  },
  {
    name: '車両費',
    group: '移動・打合せ',
    common: false,
    when: '事業で使う車の維持にかかった',
    examples: ['ガソリン代、車検、自動車税(租税公課でも可)', '家事按分して事業分だけ'],
  },

  /* -------- 場所・設備 -------- */
  {
    name: '地代家賃',
    group: '場所・設備',
    common: false,
    when: '仕事をする場所に毎月払う',
    examples: [
      '事務所家賃',
      '自宅兼事務所は面積や使用時間で家事按分',
      'コワーキングの月額会員費もここでよい',
    ],
  },
  {
    name: '水道光熱費',
    group: '場所・設備',
    common: false,
    when: '仕事場の電気・ガス・水道',
    examples: ['自宅兼事務所の電気代(家事按分して事業分だけ)'],
  },
  {
    name: '修繕費',
    group: '場所・設備',
    common: false,
    when: '壊れたものを元に戻すために払った',
    examples: ['PCの修理代', '事務所の原状回復', '性能が上がる改造は減価償却費になることがある'],
  },
  {
    name: 'リース料',
    group: '場所・設備',
    common: false,
    when: '機器を借りて毎月払う',
    examples: ['複合機のリース', 'レンタルPC', 'ソフトの月額は通信費か消耗品費に寄せる'],
  },
  {
    name: '荷造運賃',
    group: '場所・設備',
    common: false,
    when: 'モノを送るために払った',
    examples: ['契約書の郵送費', '資料の宅配便', '切手・レターパック'],
  },

  /* -------- お金・税 -------- */
  {
    name: '支払手数料',
    group: 'お金・税',
    common: true,
    when: 'お金を動かす・決済する手間に払った',
    examples: ['振込手数料', 'Stripe / PayPal の決済手数料', 'クラウドソーシングのシステム利用料'],
  },
  {
    name: '租税公課',
    group: 'お金・税',
    common: false,
    when: '事業にかかる税金・公的な手数料を払った',
    examples: ['個人事業税、印紙代', '証明書の発行手数料', '所得税・住民税は経費にならない'],
  },
  {
    name: '損害保険料',
    group: 'お金・税',
    common: false,
    when: '事業のための保険に払った',
    examples: ['事務所の火災保険', '賠償責任保険', '生命保険は経費ではなく所得控除'],
  },
  {
    name: '利子割引料',
    group: 'お金・税',
    common: false,
    when: '借入の利息を払った',
    examples: ['事業融資の利息(元本の返済は経費にならない)'],
  },
  {
    name: '諸会費',
    group: 'お金・税',
    common: false,
    when: '団体に所属し続けるために払った',
    examples: ['商工会議所の会費', '業界団体の年会費', '同業コミュニティの月会費'],
  },
  {
    name: '貸倒金',
    group: 'お金・税',
    common: false,
    when: '売上として計上した代金が回収できなくなった',
    examples: ['取引先の倒産で入金されなくなった請求分'],
  },

  /* -------- 売上・その他 -------- */
  {
    name: '売上高',
    group: '売上・その他',
    common: false,
    when: '本業で稼いだ入金',
    examples: ['コンサルティング報酬', 'AI導入支援の受託開発費', '自社サービスの月額課金'],
  },
  {
    name: '雑収入',
    group: '売上・その他',
    common: false,
    when: '本業以外で入ってきた',
    examples: ['補助金・助成金', 'アフィリエイト収入', '不要備品の売却'],
  },
  {
    name: '広告宣伝費',
    group: '売上・その他',
    common: true,
    when: '知ってもらうために払った',
    examples: ['Google / Meta の広告出稿', '名刺・パンフレットの印刷', '自社サイトの制作費'],
  },
  {
    name: '販売促進費',
    group: '売上・その他',
    common: false,
    when: '買ってもらうきっかけに払った',
    examples: ['ノベルティ、サンプル提供', '展示会の出展料', '広く知らせる目的なら広告宣伝費'],
  },
  {
    name: '雑費',
    group: '売上・その他',
    common: false,
    when: 'どの科目にも当てはまらず、金額も小さい',
    examples: [
      '年に数回の少額支出',
      '毎月出るならその支出用の科目を追加したほうがよい',
      '雑費が経費の1割を超えたら分け直す合図',
    ],
  },
  {
    name: '事業主貸',
    group: '売上・その他',
    common: false,
    when: '事業のお金を私用に使った(経費ではない)',
    examples: ['事業口座から生活費を引き出した', '事業用カードで私物を買った'],
  },
];

/** 迷ったときに上から順に当てはめる基準。画面にそのまま出す */
export const TAX_ACCOUNT_GUIDE: readonly string[] = [
  '誰かに仕事を頼んだ → 外注工賃',
  '毎月続く契約(回線・SaaS) → 通信費',
  '買い切りのモノで10万円未満 → 消耗品費',
  '人と会うための移動 → 旅費交通費 / 会った場での飲食 → 会議費',
  '決済や振込で引かれた分 → 支払手数料',
  '上のどれでもなく少額 → 雑費(毎月出るなら専用の科目を追加する)',
];

/** 科目を選ぶときの前提。金額の大小より「毎月同じ科目に入れ続ける」ほうが効く */
export const TAX_ACCOUNT_PRINCIPLE = '厳密な正解より一貫性。同じ支出は毎月同じ科目に入れると増減が読めます。';

const BY_NAME = new Map(TAX_ACCOUNTS.map((a) => [a.name, a]));

/** 名前から科目の説明を引く(取込由来の科目でも名前が一致すれば説明が付く) */
export const taxAccountByName = (name: string): TaxAccount | null => BY_NAME.get(name.trim()) ?? null;

/** 分類ごとの科目。表示順はマスタの並びのまま(決算書に近い順) */
export const taxAccountsByGroup = (group: TaxAccountGroup): TaxAccount[] =>
  TAX_ACCOUNTS.filter((a) => a.group === group);

/** よく使う科目。分類を開かずに1画面目で押せるようにするための並び */
export const commonTaxAccounts = (): TaxAccount[] => TAX_ACCOUNTS.filter((a) => a.common);

/**
 * 内容・支払先の文字列から科目の候補を出す。
 * 「何を選べばいいか分からない」を、選ばせる前に減らすための入口。
 * 当てはまらなければ空を返す(推測で決め打ちしない)。
 */
export interface AccountHint {
  /** 支払先や内容に現れる語(大文字小文字は無視して部分一致) */
  keywords: string[];
  /** その語が出たときに勧める科目名(TAX_ACCOUNTS に実在する名前) */
  account: string;
}

/**
 * 支払先・内容から科目を勧める対応表。
 *
 * 2文字以下の語や英字の短縮形は入れない。部分一致なので "ai" は "chain" にも刺さる。
 * 1つの支払先が複数の科目になり得るときは、両方の科目を書いて並べて出す。
 * 決め打ちで1つに寄せると、間違った科目のまま毎月それを選び続けることになる。
 */
export const ACCOUNT_HINTS: readonly AccountHint[] = [
  // AI・クラウド。毎月続く契約(通信費)とも、使った分だけのツール代(消耗品費)とも読める
  {
    keywords: ['openai', 'chatgpt', 'anthropic', 'claude', 'gemini', 'cursor', 'copilot', 'perplexity'],
    account: '消耗品費',
  },
  {
    keywords: ['openai', 'anthropic', 'aws', 'google cloud', 'cloudflare', 'vercel', 'supabase'],
    account: '通信費',
  },
  { keywords: ['github', 'figma', 'notion', 'adobe', 'canva', 'サブスク', '月額'], account: '消耗品費' },
  // 回線・連絡手段
  {
    keywords: [
      'zoom',
      'slack',
      'google workspace',
      'microsoft 365',
      'ドメイン',
      'お名前.com',
      'xserver',
      'さくら',
    ],
    account: '通信費',
  },
  { keywords: ['光回線', 'ドコモ', 'ソフトバンク', 'povo', 'ahamo', 'wi-fi', '携帯'], account: '通信費' },
  // 移動
  {
    keywords: ['jr', '新幹線', '電車', 'タクシー', 'suica', 'pasmo', 'icoca', '航空', 'jal'],
    account: '旅費交通費',
  },
  { keywords: ['ホテル', '宿泊', '駐車', 'etc', '高速', 'バス', '運賃'], account: '旅費交通費' },
  // 打合せ
  {
    keywords: [
      '会議室',
      'コワーキング',
      '打合せ',
      '打ち合わせ',
      'wework',
      'regus',
      'スタバ',
      'スターバックス',
    ],
    account: '会議費',
  },
  { keywords: ['接待', '会食', '手土産', 'お中元', 'お歳暮', '贈答'], account: '接待交際費' },
  // 人に頼む。仲介サイトは「報酬本体」と「システム利用料」で科目が割れる
  {
    keywords: ['業務委託', '外注', '委託', '開発費', 'クラウドワークス', 'ランサーズ', 'ココナラ'],
    account: '外注工賃',
  },
  {
    keywords: ['クラウドワークス', 'ランサーズ', 'ココナラ', '手数料', '振込', 'stripe', 'paypal', 'square'],
    account: '支払手数料',
  },
  { keywords: ['税理士', '社労士', '弁護士', '司法書士', '顧問料'], account: '支払報酬' },
  // 情報・学び
  {
    keywords: ['kindle', 'audible', '日経', 'newspicks', '書店', '紀伊國屋', '技術書', '書籍'],
    account: '新聞図書費',
  },
  {
    keywords: ['セミナー', '講座', 'udemy', '受験料', 'カンファレンス', 'スクール', '研修'],
    account: '研修費',
  },
  // 知らせる
  {
    keywords: ['広告', 'google ads', 'meta広告', '名刺', '印刷', 'パンフレット', 'サイト制作'],
    account: '広告宣伝費',
  },
  // 場所・モノ
  { keywords: ['家賃', '賃料', '事務所', 'レンタルオフィス'], account: '地代家賃' },
  { keywords: ['電気', 'ガス', '水道', '電力'], account: '水道光熱費' },
  {
    keywords: ['ヤマト', '佐川', '郵便', 'レターパック', '切手', '宅急便', 'ゆうパック'],
    account: '荷造運賃',
  },
  { keywords: ['ガソリン', 'エネオス', '車検', '自動車税'], account: '車両費' },
  // お金・税
  { keywords: ['印紙', '事業税', '登記', '証明書'], account: '租税公課' },
  { keywords: ['損害保険', '火災保険', '賠償責任'], account: '損害保険料' },
  { keywords: ['会費', '商工会'], account: '諸会費' },
];

export function suggestTaxAccounts(text: string): TaxAccount[] {
  const t = text.trim().toLowerCase();
  if (!t) return [];
  const names = new Set<string>();
  for (const hint of ACCOUNT_HINTS) {
    if (hint.keywords.some((k) => k && t.includes(k.toLowerCase()))) names.add(hint.account);
  }
  return [...names].map((n) => BY_NAME.get(n)).filter((a): a is TaxAccount => Boolean(a));
}
