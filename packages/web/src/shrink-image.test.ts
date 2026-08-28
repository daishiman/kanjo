/**
 * 証憑画像の縮小の取り決め。
 *
 * 守りたいのは2つ。「文字が読める大きさを下回らない」ことと、「容量のために縮める処理が
 * かえって容量を増やさない」こと。前者は長辺の下限、後者は拡大禁止として現れる。
 */
import { describe, expect, it } from 'vitest';
import { MAX_EDGE, canShrink, targetSize } from './shrink-image.js';

/** File はブラウザの型。中身は縮小の判定に使わないので、名前と種類だけの軽い偽物で足りる */
const file = (name: string, type: string): File => ({ name, type }) as File;

describe('証憑画像の縮小', () => {
  it('文字が読める下限(150dpi 相当)を割らない長辺にする', () => {
    // A4 の長辺 297mm を MAX_EDGE で写した時の解像度。書類のスキャンの下限 150dpi を超えること
    expect((MAX_EDGE / (297 / 25.4)) | 0).toBeGreaterThanOrEqual(150);
  });

  it('大きな写真は縦横比を保ったまま長辺を上限に合わせる', () => {
    // よくあるスマホの横位置(4:3)
    expect(targetSize(4032, 3024)).toEqual({ width: 1800, height: 1350 });
    // 縦位置。長辺が高さ側でも同じ扱いにする(領収書は縦に撮ることが多い)
    expect(targetSize(3024, 4032)).toEqual({ width: 1350, height: 1800 });
  });

  it('元から小さい画像は拡大しない', () => {
    // 引き伸ばしても細部は戻らず、容量だけ増える
    expect(targetSize(1200, 900)).toEqual({ width: 1200, height: 900 });
    expect(targetSize(MAX_EDGE, 1000)).toEqual({ width: MAX_EDGE, height: 1000 });
  });

  it('極端に細長い画像でも短辺が 0 にならない', () => {
    // 長いレシートを1枚に収めて撮ると、この形に近づく。0px の canvas は描画に失敗する
    const size = targetSize(20000, 40);
    expect(size.width).toBe(MAX_EDGE);
    expect(size.height).toBeGreaterThanOrEqual(1);
  });

  it('PDF と、ブラウザが解けない形式には手を出さない', () => {
    expect(canShrink(file('請求書.pdf', 'application/pdf'))).toBe(false);
    // HEIC は多くのブラウザで解けない。縮められないなら原本のまま送る(送れないより良い)
    expect(canShrink(file('IMG_0001.heic', 'image/heic'))).toBe(false);
    expect(canShrink(file('領収書.jpg', 'image/jpeg'))).toBe(true);
    expect(canShrink(file('スクショ.png', 'image/png'))).toBe(true);
  });
});
