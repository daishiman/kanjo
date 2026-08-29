/**
 * ZIP(無圧縮 / store方式)の組み立て。依存ゼロ。
 *
 * なぜ自前か: 添付される証憑は JPEG・PNG・PDF で、いずれも既に圧縮済み。
 * deflate をかけても数%しか縮まらないのに、ライブラリ1つと CPU 時間が増える。
 * store 方式なら必要なのは CRC32 とヘッダの組み立てだけで、Workers の CPU 制限にも当たらない。
 *
 * ここはバイト列を作る純関数だけを持ち、R2 からの読み出しやストリーミングは持たない。
 * 分けているのは、Worker 側が「1ファイル読む → ヘッダ＋中身を流す → 捨てる」を繰り返せるようにするため。
 * 全ファイルをメモリに載せてから返す作りにすると、証憑100MBぶんで Worker が落ちる。
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

/** CRC32。ZIP のローカルヘッダとセントラルディレクトリの両方で同じ値が要る */
export function crc32(bytes: Uint8Array, seed = 0): number {
  let c = (seed ^ 0xffffffff) >>> 0;
  for (let i = 0; i < bytes.length; i++) c = (CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * ZIP に載せる1ファイル。
 * `crc` と `size` を呼び出し側が持つのは、中身を保持せずにセントラルディレクトリを
 * 後から書けるようにするため(ストリーミングに必要)。
 */
export interface ZipEntryMeta {
  /** ZIP 内のパス。区切りは常に '/' */
  name: string;
  crc: number;
  size: number;
  /** ローカルヘッダの先頭からのバイト位置 */
  offset: number;
  /** 最終更新日時。省略時は 1980-01-01(ZIP の下限) */
  date?: Date;
}

const utf8 = new TextEncoder();

/** DOS 形式の日付・時刻。ZIP の下限(1980年)より前は丸める */
function dosDateTime(date: Date | undefined): { time: number; date: number } {
  const d = date && !Number.isNaN(date.getTime()) && date.getFullYear() >= 1980 ? date : new Date(1980, 0, 1);
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * 汎用フラグ bit 11 = ファイル名が UTF-8。
 * 日本語のファイル名を出すので必須。立てないと Windows の展開で文字化けする。
 */
const FLAG_UTF8 = 0x0800;

const writer = (size: number) => {
  const buf = new Uint8Array(size);
  const view = new DataView(buf.buffer);
  let at = 0;
  return {
    u16(v: number) {
      view.setUint16(at, v, true);
      at += 2;
    },
    u32(v: number) {
      view.setUint32(at, v >>> 0, true);
      at += 4;
    },
    bytes(v: Uint8Array) {
      buf.set(v, at);
      at += v.length;
    },
    done: () => buf,
  };
};

/** ローカルファイルヘッダ。この直後にファイルの中身をそのまま繋げる */
export function zipLocalHeader(entry: ZipEntryMeta): Uint8Array {
  const name = utf8.encode(entry.name);
  const { time, date } = dosDateTime(entry.date);
  const w = writer(30 + name.length);
  w.u32(0x04034b50);
  w.u16(20); // 展開に必要なバージョン(2.0)
  w.u16(FLAG_UTF8);
  w.u16(0); // 無圧縮
  w.u16(time);
  w.u16(date);
  w.u32(entry.crc);
  w.u32(entry.size);
  w.u32(entry.size);
  w.u16(name.length);
  w.u16(0);
  w.bytes(name);
  return w.done();
}

/**
 * セントラルディレクトリと EOCD。全ファイルを流し終えた最後に1回だけ繋げる。
 * ZIP64 は使わない(証憑は1ファイル8MB上限・総量も4GBに遠く届かない)。
 */
export function zipCentralDirectory(entries: readonly ZipEntryMeta[]): Uint8Array {
  const parts: Uint8Array[] = [];
  let size = 0;
  for (const entry of entries) {
    const name = utf8.encode(entry.name);
    const { time, date } = dosDateTime(entry.date);
    const w = writer(46 + name.length);
    w.u32(0x02014b50);
    w.u16(20); // 作成バージョン
    w.u16(20); // 展開に必要なバージョン
    w.u16(FLAG_UTF8);
    w.u16(0);
    w.u16(time);
    w.u16(date);
    w.u32(entry.crc);
    w.u32(entry.size);
    w.u32(entry.size);
    w.u16(name.length);
    w.u16(0); // extra
    w.u16(0); // comment
    w.u16(0); // disk
    w.u16(0); // internal attrs
    w.u32(0); // external attrs
    w.u32(entry.offset);
    w.bytes(name);
    const part = w.done();
    parts.push(part);
    size += part.length;
  }

  const offset = entries.reduce((acc, e) => acc + 30 + utf8.encode(e.name).length + e.size, 0);
  const eocd = writer(22);
  eocd.u32(0x06054b50);
  eocd.u16(0);
  eocd.u16(0);
  eocd.u16(entries.length);
  eocd.u16(entries.length);
  eocd.u32(size);
  eocd.u32(offset);
  eocd.u16(0);
  parts.push(eocd.done());

  const out = new Uint8Array(size + 22);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export interface ZipFile {
  name: string;
  data: Uint8Array;
  date?: Date;
}

/**
 * 小さい ZIP を一発で作る。索引CSVの同梱やテストで使う。
 * 証憑本体のような大きいものは、API 側が local header → 中身 → central directory を
 * 順に流す(このメモリ確保を通さない)。
 */
export function buildZip(files: readonly ZipFile[]): Uint8Array {
  const metas: ZipEntryMeta[] = [];
  const chunks: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const meta: ZipEntryMeta = {
      name: f.name,
      crc: crc32(f.data),
      size: f.data.length,
      offset,
      date: f.date,
    };
    const header = zipLocalHeader(meta);
    chunks.push(header, f.data);
    offset += header.length + f.data.length;
    metas.push(meta);
  }
  chunks.push(zipCentralDirectory(metas));

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/**
 * ZIP 内のファイル名を安全にする。
 * パス区切り・制御文字・Windows の禁止文字を落とす。展開先を親ディレクトリへ逃がさない。
 */
export function sanitizeZipName(raw: string): string {
  const cleaned = raw
    // biome-ignore lint/suspicious/noControlCharactersInRegex: 制御文字の除去が目的
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/^\.+/, '')
    .trim();
  if (!cleaned) return 'file';
  return cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
}
