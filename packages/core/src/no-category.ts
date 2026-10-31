/**
 * 『カテゴリなし』の予約の値 (spec-classify-bulk-save FR-18・BR-04)。
 *
 * 一括保存で区分だけを指定し、埋める大項目がどこにも無い明細に入れる値。保存した値はそのまま残し、
 * 数えるときだけ未分類と同じに扱う。読み替えを集計ごとに書くと、どこか 1 か所だけ
 * 『カテゴリなし』の行が生まれて画面ごとに合計が食い違うので、読み替えはここ 1 か所に置く。
 */

export const NO_CATEGORY = 'カテゴリなし';

/** 予約の値を編集の値・一括指定・候補の名前に入れたときの 400 の文 (code は reserved_category) */
export const RESERVED_CATEGORY_MESSAGE =
  '『カテゴリなし』は予約の値のため、カテゴリとして選んだり候補の名前にしたりできません';

/** 表示されない書式の文字 (ゼロ幅スペース・BOM・ソフトハイフン・双方向の制御など、Unicode の Cf) */
const FORMAT_CHARS = /\p{Cf}/gu;

/**
 * 判定の結果を名前ごとに覚える。名前の種類は候補の数ほどしか無いが、集計は明細ごとに呼ぶので、
 * 正規化 (約 100ns) を明細の数だけ繰り返すと Workers の CPU 時間に響く。種類が想定より増えたら捨てて作り直す
 */
const verdicts = new Map<string, boolean>();
const VERDICTS_MAX = 1024;

/**
 * 画面で『カテゴリなし』と見分けがつかない書き方を、すべて予約の値とみなす。
 * 書式の文字を除き、NFKC で半角カナと分解した濁点を寄せ、前後の空白を除いて比べる。
 * 『カテゴリ無し』『カテゴリナシ』のように見て違いが分かる書き方は予約の値ではない
 */
export const isNoCategory = (v: string | null | undefined): boolean => {
  if (!v) return false;
  const known = verdicts.get(v);
  if (known !== undefined) return known;
  const verdict = v.replace(FORMAT_CHARS, '').normalize('NFKC').trim() === NO_CATEGORY;
  if (verdicts.size >= VERDICTS_MAX) verdicts.clear();
  verdicts.set(v, verdict);
  return verdict;
};

/** 集計では未分類として数える。空の値は読み替えない (総収支が取込値へ戻すため) */
export const categoryForTotals = (big: string): string => (isNoCategory(big) ? '未分類' : big);
