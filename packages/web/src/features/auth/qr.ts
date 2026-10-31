/**
 * QR コードの符号化 (byte mode・誤り訂正 M)。otpauth URI を認証アプリに読ませるためだけに使う。
 *
 * 外部の QR 生成サービスへ秘密鍵を送らない (§7.10 C7)。依存を足さずに web の中で閉じるため、
 * Project Nayuki の QR Code generator (MIT License, Copyright (c) Project Nayuki) の手順を、
 * この用途に要る分 (byte mode・M 固定・型番 1〜40 の自動選択・マスクの自動選択) だけ写した。
 * 画面からは遅延読込で呼び、初期 JS の予算に入れない (Q-7・NFR-07)。
 */

/** 誤り訂正 M の、ブロックあたりの誤り訂正コード語数 (添字は型番) */
const ECC_CODEWORDS_PER_BLOCK_M = [
  -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28,
  28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
];
/** 誤り訂正 M のブロック数 (添字は型番) */
const NUM_ERROR_CORRECTION_BLOCKS_M = [
  -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28,
  29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
];
/** 形式情報の誤り訂正レベルの2ビット。M は 0b00 */
const FORMAT_BITS_M = 0;

export interface QrMatrix {
  size: number;
  /** modules[y][x] が true なら暗いモジュール */
  modules: boolean[][];
  version: number;
  mask: number;
}

const getBit = (value: number, index: number): boolean => ((value >>> index) & 1) !== 0;

function numRawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

const numDataCodewords = (version: number): number =>
  Math.floor(numRawDataModules(version) / 8) -
  (ECC_CODEWORDS_PER_BLOCK_M[version] as number) * (NUM_ERROR_CORRECTION_BLOCKS_M[version] as number);

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function reedSolomonDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < result.length; j += 1) {
      result[j] = gfMultiply(result[j] as number, root);
      if (j + 1 < result.length) result[j] = (result[j] as number) ^ (result[j + 1] as number);
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] = (result[i] as number) ^ gfMultiply(coef, factor);
    });
  }
  return result;
}

function alignmentPatternPositions(version: number, size: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

/** データのコード語を作る。モード指示子・文字数・本体・終端・パディングまで */
function dataCodewords(bytes: Uint8Array, version: number): number[] {
  const bits: number[] = [];
  const append = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };
  append(0x4, 4);
  append(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) append(b, 8);
  const capacity = numDataCodewords(version) * 8;
  append(0, Math.min(4, capacity - bits.length));
  append(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) append(pad, 8);
  const codewords = new Array<number>(bits.length / 8).fill(0);
  bits.forEach((bit, i) => {
    codewords[i >>> 3] = (codewords[i >>> 3] as number) | (bit << (7 - (i & 7)));
  });
  return codewords;
}

function addEccAndInterleave(data: readonly number[], version: number): number[] {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS_M[version] as number;
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK_M[version] as number;
  const rawCodewords = Math.floor(numRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const divisor = reedSolomonDivisor(blockEccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i += 1) {
    const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    k += dat.length;
    const ecc = reedSolomonRemainder(dat, divisor);
    if (i < numShortBlocks) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const result: number[] = [];
  const width = (blocks[0] as number[]).length;
  for (let i = 0; i < width; i += 1) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i] as number);
    });
  }
  return result;
}

class Grid {
  readonly size: number;
  readonly modules: boolean[][];
  readonly isFunction: boolean[][];

  constructor(size: number) {
    this.size = size;
    this.modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    this.isFunction = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  }

  setFunction(x: number, y: number, dark: boolean): void {
    (this.modules[y] as boolean[])[x] = dark;
    (this.isFunction[y] as boolean[])[x] = true;
  }
}

function drawFormatBits(grid: Grid, mask: number): void {
  const data = (FORMAT_BITS_M << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const { size } = grid;
  for (let i = 0; i <= 5; i += 1) grid.setFunction(8, i, getBit(bits, i));
  grid.setFunction(8, 7, getBit(bits, 6));
  grid.setFunction(8, 8, getBit(bits, 7));
  grid.setFunction(7, 8, getBit(bits, 8));
  for (let i = 9; i < 15; i += 1) grid.setFunction(14 - i, 8, getBit(bits, i));
  for (let i = 0; i < 8; i += 1) grid.setFunction(size - 1 - i, 8, getBit(bits, i));
  for (let i = 8; i < 15; i += 1) grid.setFunction(8, size - 15 + i, getBit(bits, i));
  grid.setFunction(8, size - 8, true);
}

function drawFunctionPatterns(grid: Grid, version: number): void {
  const { size } = grid;
  for (let i = 0; i < size; i += 1) {
    grid.setFunction(6, i, i % 2 === 0);
    grid.setFunction(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ] as const) {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) grid.setFunction(x, y, dist !== 2 && dist !== 4);
      }
    }
  }
  const positions = alignmentPatternPositions(version, size);
  const last = positions.length - 1;
  positions.forEach((py, i) => {
    positions.forEach((px, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1)
          grid.setFunction(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    });
  });
  drawFormatBits(grid, 0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i += 1) {
      const dark = getBit(bits, i);
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      grid.setFunction(a, b, dark);
      grid.setFunction(b, a, dark);
    }
  }
}

function drawCodewords(grid: Grid, codewords: readonly number[]): void {
  const { size } = grid;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!(grid.isFunction[y] as boolean[])[x] && i < codewords.length * 8) {
          (grid.modules[y] as boolean[])[x] = getBit(codewords[i >>> 3] as number, 7 - (i & 7));
          i += 1;
        }
      }
    }
  }
}

const MASKS: ReadonlyArray<(x: number, y: number) => boolean> = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(grid: Grid, mask: number): void {
  const invert = MASKS[mask] as (x: number, y: number) => boolean;
  for (let y = 0; y < grid.size; y += 1) {
    for (let x = 0; x < grid.size; x += 1) {
      const row = grid.modules[y] as boolean[];
      if (!(grid.isFunction[y] as boolean[])[x] && invert(x, y)) row[x] = !row[x];
    }
  }
}

const FINDER_CORE = [true, false, true, true, true, false, true];

/** 1:1:3:1:1 の並びのうち、前後どちらかに明るい 4 モジュール (端を含む) が続くものを数える */
function finderLikeCount(seq: readonly boolean[]): number {
  const size = seq.length;
  const lightRun = (from: number, to: number) =>
    seq.slice(Math.max(from, 0), Math.min(to, size)).every((dark) => !dark);
  let count = 0;
  let idx = 0;
  while (idx + 7 <= size) {
    if (!FINDER_CORE.every((dark, k) => seq[idx + k] === dark)) {
      idx += 1;
      continue;
    }
    if (idx === 0 || idx === size - 7 || lightRun(idx - 4, idx) || lightRun(idx + 7, idx + 11)) {
      count += 1;
      idx += 7;
    } else {
      idx += 4;
    }
  }
  return count;
}

/** 連続する同色の長さに応じた罰点 (N1)。5 個で 3 点、以降 1 個ごとに 1 点 */
function runPenalty(seq: readonly boolean[]): number {
  let result = 0;
  let run = 1;
  for (let i = 1; i <= seq.length; i += 1) {
    if (i < seq.length && seq[i] === seq[i - 1]) {
      run += 1;
      continue;
    }
    if (run >= 5) result += run - 2;
    run = 1;
  }
  return result;
}

/**
 * 読み取りにくさの罰点 (JIS X 0510 の4規則)。小さいマスクを選ぶ。
 * 規則の端の扱いは実装ごとに揺れるため、検算に使う segno と同じ解釈に揃えている。
 */
function penalty(modules: readonly boolean[][]): number {
  const size = modules.length;
  const columns = Array.from({ length: size }, (_, x) => modules.map((row) => row[x] as boolean));
  let result = 0;
  let dark = 0;
  modules.forEach((row, y) => {
    const column = columns[y] as boolean[];
    result += runPenalty(row) + runPenalty(column);
    result += (finderLikeCount(row) + finderLikeCount(column)) * 40;
    row.forEach((cell, x) => {
      if (cell) dark += 1;
      const above = modules[y - 1];
      if (above && x > 0 && cell === row[x - 1] && cell === above[x] && cell === above[x - 1]) result += 3;
    });
  });
  result += 10 * Math.floor(Math.abs((dark / (size * size)) * 100 - 50) / 5);
  return result;
}

/**
 * 文字列を QR の行列にする。収まる最小の型番を選び、mask を省けば罰点の最も小さいものを選ぶ。
 * 型番 40 にも収まらない長さは例外にする (otpauth URI では起きない長さ)。
 */
export function encodeQr(text: string, fixedMask?: number): QrMatrix {
  const bytes = new TextEncoder().encode(text);
  let version = 1;
  for (; version <= 40; version += 1) {
    const needed = 4 + (version <= 9 ? 8 : 16) + bytes.length * 8;
    if (needed <= numDataCodewords(version) * 8) break;
  }
  if (version > 40) throw new RangeError('QR に収まらない長さです');
  const size = version * 4 + 17;
  const codewords = addEccAndInterleave(dataCodewords(bytes, version), version);

  const build = (mask: number): Grid => {
    const grid = new Grid(size);
    drawFunctionPatterns(grid, version);
    drawCodewords(grid, codewords);
    applyMask(grid, mask);
    drawFormatBits(grid, mask);
    return grid;
  };

  if (fixedMask !== undefined) return { size, modules: build(fixedMask).modules, version, mask: fixedMask };
  let best = { mask: 0, score: Number.POSITIVE_INFINITY, grid: build(0) };
  for (let mask = 0; mask < 8; mask += 1) {
    const grid = mask === 0 ? best.grid : build(mask);
    const score = penalty(grid.modules);
    if (score < best.score) best = { mask, score, grid };
  }
  return { size, modules: best.grid.modules, version, mask: best.mask };
}

/** 暗いモジュールを1本の SVG path にする。1モジュール = 1単位、quiet zone は呼ぶ側の viewBox が持つ */
export function qrPath(matrix: QrMatrix, offset: number): string {
  const parts: string[] = [];
  matrix.modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) parts.push(`M${x + offset} ${y + offset}h1v1h-1z`);
    });
  });
  return parts.join('');
}
