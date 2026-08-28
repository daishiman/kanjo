/**
 * 証憑の画像を、送る前にブラウザ側で縮める。
 *
 * 領収書に必要なのは「日付・金額・店名が読めること」だけで、カメラの原寸は要らない。
 * スマホの写真は1枚3〜5MBあり、そのまま貯めると保存容量(R2)を食い、上限8MBに触れて
 * 「撮り直してください」と突き返す羽目になる。縮めてから送れば、その場面自体が起きない。
 *
 * 縮小はここで完結する。保存されるのは既に縮んだファイルなので、API もスキーマも変わらない。
 * 縮められない画像(HEIC など、ブラウザが解けない形式)は原本のまま送る。
 * 送れないより、大きいまま送れたほうがよい。
 */

/** 縮小後の JPEG 品質。文字の輪郭が潰れない下限として 0.82 を採る */
const QUALITY = 0.82;

/**
 * 長辺の上限(px)。
 *
 * 判読の下限から決めている。A4(長辺297mm)の領収書を画面いっぱいに撮ったとき、
 *   1200px → 約103dpi。但し書きや税率の小さな字が滲む
 *   1600px → 約137dpi。本文は読めるが、細字の但し書きは怪しい
 *   1800px → 約154dpi。書類のスキャンで下限とされる150dpiを超え、細字も残る
 * 「読めるギリギリ」は1600px前後なので、その一段上の1800pxを採る。
 * レシート(幅58〜80mm)はA4より字が大きく、この値なら余裕がある。
 *
 * 原寸4000px級の写真がここまで縮むと、面積比でおよそ1/5、容量は数百KBに収まる。
 */
export const MAX_EDGE = 1800;

/**
 * 縮小後の寸法を決める。縦横比は保ち、元より大きくはしない。
 *
 * @param width 元の幅(px)
 * @param height 元の高さ(px)
 * @returns 送る画像の寸法
 */
export function targetSize(width: number, height: number): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  // 元から上限以下の画像は触らない。引き伸ばしても容量が増えるだけで、失われた細部は戻らない
  if (longEdge <= MAX_EDGE) return { width, height };
  const scale = MAX_EDGE / longEdge;
  // 短辺は 0px になりえないよう1pxで止める(極端に細長い画像で描画が失敗するのを防ぐ)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** 縮小の対象。画像でないもの(PDF)と、ブラウザが解けない形式はそのまま送る */
export const canShrink = (file: File): boolean =>
  file.type.startsWith('image/') && file.type !== 'image/heic' && file.type !== 'image/heif';

/**
 * 画像を縮めた File を返す。縮められないとき・縮めても小さくならないときは原本をそのまま返す。
 * 「元より大きくなったら原本」を入れているのは、PNG のスクリーンショットなどを
 * JPEG に変換すると却って太る場合があるため。
 */
export async function shrinkImageFile(file: File): Promise<File> {
  if (!canShrink(file)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const size = targetSize(bitmap.width, bitmap.height);
    if (size.width === bitmap.width && size.height === bitmap.height && file.type === 'image/jpeg') {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], jpegName(file.name), { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/** 中身が JPEG になるので拡張子も合わせる(拡張子と中身が食い違うと後で開けない環境がある) */
const jpegName = (name: string): string => `${name.replace(/\.[^.]+$/, '')}.jpg`;
