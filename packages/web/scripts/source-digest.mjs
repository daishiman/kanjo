// 証跡に載せる「どのソースを測ったか」の指紋を、証跡を作る側が自分で計算する。
//
// かつてこの値は `--source-digest=` で外から渡され、スクリプトはそれを JSON に書き写すだけだった。
// つまり指紋が自己申告で、何を対象にどう計算したのかはどこにも残らなかった。
// (実際、過去の digest の算出方法はリポジトリから失われた。記録漏れではなく、この構造の必然だった。)
// なので値・対象・算出手段の三点を必ず同時に出す。個別ハッシュを併記するのは、
// digest が動いたときにどのファイルが変わったのかを人が突き合わせずに済ませるため。

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * 指紋の対象。feat-mobile-financial-visualization の
 * 本番ソース・契約テスト・Chrome検査スクリプト一式(パスは packages/web からの相対)。
 * ここに並んでいないものは測っていない。増減させたら digest は必ず変わる。
 */
export const DIGEST_SOURCES = [
  'scripts/cdp.mjs',
  'scripts/check-financial-visuals.mjs',
  'scripts/check-mobile-financial-layout.mjs',
  'scripts/headless-chrome.mjs',
  // 指紋の作り方が変われば指紋も変わるべきなので、この一覧自身も対象に含める。
  'scripts/source-digest.mjs',
  'scripts/viewports.mjs',
  'src/components/FinancialCharts.tsx',
  'src/components/FinancialFigure.tsx',
  'src/components/ReportChart.tsx',
  'src/components/charts.ts',
  'src/components/figure-view-model.ts',
  'src/mobile-financial-layout.test.ts',
  'src/mobile-financial-visualization-render.test.ts',
  'src/mobile-financial-visualization.dom.test.tsx',
  'src/styles.css',
];

export const DIGEST_METHOD =
  'sha256(各対象ファイルについて "<ファイルのsha256>  <packages/webからの相対パス>\\n" を' +
  'パスの昇順(コードポイント順)で連結した文字列)';

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

/** 対象ファイルが commit に固定されているかを注記する。git が使えなければ null。 */
function commitAnnotation(paths) {
  const git = (args) => execFileSync('git', args, { cwd: WEB_ROOT, encoding: 'utf8' });
  try {
    const sha = git(['rev-parse', 'HEAD']).trim();
    // digest は working tree を測るので、commit と一致しているかは別に言う必要がある。
    // porcelain の行頭2文字は状態で、未staged は先頭が空白。出力全体を trim すると
    // 1行目のその空白だけが消えてパスが1文字欠けるので、行ごとに状態を外す。
    const dirty = git(['status', '--porcelain', '--', ...paths])
      .split('\n')
      .filter(Boolean)
      .map((line) => line.slice(3).trim());
    return { sha, sourcesMatchCommit: dirty.length === 0, uncommittedSources: dirty };
  } catch (error) {
    return {
      sha: null,
      sourcesMatchCommit: null,
      uncommittedSources: null,
      reason: String(error.message ?? error),
    };
  }
}

/**
 * 対象ファイルを読んで指紋を組み立てる。
 * 対象が1つでも読めなければ例外にする。黙って飛ばすと、対象0件でも digest が出てしまい、
 * 「何も測っていない緑」がそのまま証跡の指紋になる。
 */
export function computeSourceDigest() {
  if (DIGEST_SOURCES.length === 0) throw new Error('digest の対象ファイルが0件です');
  const paths = [...DIGEST_SOURCES].sort();
  const sources = paths.map((path) => {
    let content;
    try {
      content = readFileSync(join(WEB_ROOT, path));
    } catch (error) {
      throw new Error(`digest の対象ファイルを読めません: ${path} (${error.message ?? error})`);
    }
    return { path, sha256: sha256(content) };
  });
  return {
    algorithm: 'sha256',
    method: DIGEST_METHOD,
    root: 'packages/web',
    sourceDigest: sha256(sources.map((source) => `${source.sha256}  ${source.path}\n`).join('')),
    commit: commitAnnotation(paths),
    sources,
  };
}
