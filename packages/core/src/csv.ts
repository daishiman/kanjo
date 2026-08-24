/**
 * CSVパースと文字コード判別。HTML版 parseCSV / decodeBuf を忠実に移植。
 */

/** UTF-8(fatal) → 失敗時 Shift-JIS フォールバック */
export function decodeBuf(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  try {
    // ignoreBOM明示はworkers-typesの型都合(既定値と同じ挙動=BOMは除去される)
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(u8);
  } catch (_e) {
    return new TextDecoder('shift_jis').decode(u8);
  }
}

/** RFC4180相当の素朴なCSVパーサ（HTML版と同一挙動。全セル空の行は捨てる） */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
    } else {
      if (ch === '"') q = true;
      else if (ch === ',') {
        row.push(cell);
        cell = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell);
        cell = '';
        if (row.some((c) => c !== '')) rows.push(row);
        row = [];
      } else cell += ch;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    if (row.some((c) => c !== '')) rows.push(row);
  }
  return rows;
}
