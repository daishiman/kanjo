// 選ばれたファイルの中身を文字列で読む。
// File.text() は実機のブラウザにはあるがjsdomのFileには無く、環境によって静かに壊れる。
// FileReaderはブラウザにもjsdomにもあるので、読み取り経路をここに一本化する。
export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('ファイルを読み取れませんでした'));
    reader.readAsText(file);
  });
}
