# 支出分析ハブ 受入判定 (SYS-ANHUB-P07)

- 判定日: 2026-09-15
- 判定基準: `specs/spec-analysis-hub.md` の「テストと受入条件」節 AC-001..AC-006 (task 仕様書の要約ではなく仕様書の文言を正とした)
- 入力: `docs/analysis-hub/test-run.md` (P06)、実装一式 (P05)、本判定のために追加した検証 (下記「判定のために追加した検証」)

## 判定一覧

| AC | 判定 | 要約 |
|---|---|---|
| AC-001 | pass | 画像の構成要素 8 種を描画。直書き色 0 件、Button / PageShell 経由 |
| AC-002 | pass | `?focus=` の再現・置換・不正値の既定化。`/analysis/:tab` と旧 URL 転送のテストが緑 |
| AC-003 | pass | ハブ表示中の呼出しは `GET /api/analysis/hub` 1 本、5 タブの API は 0 件 |
| AC-004 | pass | BR-001..005 を境界値付きで検証し、規則を docs に明記 |
| AC-005 | pass | 5 タブ名が短縮形。サイドバーの件数バッジが集約応答の要確認件数と一致 |
| AC-006 | 条件付き pass | test / typecheck / check 系と狭幅は緑。lint の 2 段だけがコード外の成果物で赤 (commit 前に対応) |

P05 への差し戻し: なし。

## AC-001 画面構成・トークン・共通部品

仕様: /analysis で画像の構成要素がすべて描画され、トークン・共通 Button/PageShell 経由で直書き色 lint 0 件。

- 構成要素: `packages/web/src/analysis-hub.dom.test.tsx`
  - 「/analysis はタブへ転送せず、ハブの構成要素を描く」— 問いの見出し・URL コピー・5 タブ・収支サマリー・分析ルート一覧 (5 行)・読み順 (5 段)
  - 「選択中の分析パネルは『わかること・主なデータソース・対象外のデータ』を出す」
  - 「?focus=total-cashflow で総収支の行・右パネル・下部バーが選択状態になる」— 下部バー
- 直書き色: `scripts/check-design-tokens.mjs` と同じ正規表現・同じ除外 (テスト・test-support・コメント) で `packages/web/src` の ts/tsx 71 ファイルを走査し 0 件。`check-design-tokens` 自体は F1 (spec-state digest) で直書き検査の前に止まるため、同条件の走査で代替した。
- 共通部品: URL コピーと行選択は `components/Button.js` の `Button`。本文 landmark は `Layout` が全ルートに被せる `PageShell` (`common-shell-routes.dom.test.tsx`「共通 PageShell が route metadata の reading/data 幅を実描画へ渡す」が緑)。

## AC-002 focus の保持と既存 URL

仕様: ?focus= で選択状態が再現され、/analysis/:tab と旧 URL 転送の既存テストが緑。

- `analysis-hub.dom.test.tsx`
  - 「?focus=total-cashflow で総収支の行・右パネル・下部バーが選択状態になる」
  - 「不正な focus は既定 (照合) として扱う」— 押下状態の行も既定 1 件だけ
  - 「行を選ぶと URL の focus が置き換わる」— navigation type が `REPLACE` (履歴を積まない)
  - 「URL コピーは focus だけを載せ、成否を role=status で伝える」「クリップボードへ書けないときは失敗を role=status で伝える」
  - 「/analysis/:tab は従来どおりタブを表示し、ハブを描かない」
- `analysis-tabs.dom.test.tsx`「統合前のURLは行き先を失わない」(LEGACY_ROUTE_REDIRECTS) を含む 5 件、「タブ名の無いURLはハブを出し、綴りの違うURLは既定のタブへ寄せる」を含めて全件緑。

## AC-003 ハブの API 呼出し

仕様: ハブ表示中の呼出しは GET /api/analysis/hub の 1 本で、既存 5 API は 0 件。

- `analysis-hub.dom.test.tsx`「ハブ表示中は集約 API 1 本だけを呼び、5 タブの API を呼ばない」— 集約 API がちょうど 1 回、タブ API パターン 7 種への呼出しが 0 件。
- サイドバーのバッジも同じ queryKey (`analysisHubQueryKey`) を使うため、シェルとハブで要求は 1 本にまとまる。
- API 側: `packages/api/src/analysis-hub.test.ts` — 200 で期間メタ・サマリー・5 視点、他利用者の行を混ぜない、Cookie なし 401、一時パスワード変更前 403。

## AC-004 規則の検証と文書化

仕様: core テストが前期間比・優先度・正常判定・改善余地を境界値付きで検証し、規則が docs に明記されている。

| 規則 | テスト (`packages/core/src/analysis-hub.test.ts`) | 境界値 |
|---|---|---|
| BR-001 優先度 | 「照合と総収支は要確認 0 件で中、1 件で高」「マトリクス・推移・診断は件数に関わらず中」 | 0 / 1 |
| BR-002 正常判定 | 「未記録月 0 で正常、1 で正常でない」「期間内の未記録月だけを数え、期間外の未記録月では正常を崩さない」 | 0 / 1 |
| BR-003 改善余地 | 「候補 0 件で 0 円、月額 1,000 円と 500 円で年 18,000 円」 | 0 件 |
| BR-004 前期間比 | 年またぎ、「前Nか月」、欠け 0 / 1 か月、全期間で null、前期間 0 で Infinity を返さない | 欠け 0 / 1、0 除算 |
| BR-005 総収支の再利用 | totalCashflowReport / buildExpenseProjection の件数と一致、要確認を支出に入れない | 要確認 0 / 1 以上 |

- 文書: `docs/analysis-hub/requirements-baseline.md` の業務ルール表 (BR-001..005)、`docs/analysis-hub/architecture-decision.md` の関数配置と null 規則。
- テストが規則を実際に縛っていることを mutation で確認 (test-run.md M1..M3、すべて赤)。

## AC-005 タブの短縮名と件数バッジ

仕様: 5 タブ名が短縮形で、サイドバー子行の件数バッジが要確認件数と一致する。

- 短縮名: `packages/web/src/routeMetadata.ts` の ANALYSIS_TABS が 照合 / 総収支 / マトリクス / 推移 / 診断。`common-shell.dom.test.tsx` の現在地が「確認 › 支出分析 › 総収支」、`navigation-ux.dom.test.tsx` が `総収支` を検査。
- バッジ: `analysis-hub.dom.test.tsx`「サイドバーの要確認バッジ」2 件
  - 照合 3 件・総収支 2 件をそのまま表示し、要確認を持たない視点 (応答に件数らしき値が混ざっても) には出さない。リンク名はタブ名のまま。
  - 要確認 0 件の視点には出さない (応答到着を別のバッジで待ってから確認)。
  - 実装を壊して検出できることを確認: 0 件でも出す / 全視点に出す / 件数を固定、の 3 変異がすべて赤。

## AC-006 既存ゲートと狭幅

仕様: 既存 test / typecheck / lint と check 系が緑で、狭幅でハブが横スクロールしない。

| ゲート | 結果 |
|---|---|
| `pnpm -r test` | 緑 (core 579 / api 529 / web 551 ※バッジ 2 件追加後) |
| `pnpm typecheck` | 緑 |
| `pnpm lint` | 赤 2 段 — F1 `check-design-tokens` (spec-state digest)、F2 `security:content` (評価記録の絶対パス)。どちらも `packages/` 外の仕様・計画成果物が原因。他 8 段は緑 |
| `check:thead` / `check:mobile-layout` / `check:financial-figure` | 緑 |
| `check:financial-routes` | 緑 (本 worktree の vite を 4185 で起動して実行。既定の 4175 は別 worktree が使用中) |
| `build:bundle` 直後の `check:js-budget` | 緑 107.24KiB / 110KiB |
| ハブ狭幅 | 緑 — 下記 |

ハブ狭幅: 既存 check 系は `/analysis` ハブを対象に含まないため、既存検査と同じ headless Chrome + API 差し替え (匿名データ) でハブを実描画して測った。

- 320 / 360 / 375 / 390 / 375 zoom200 / 768 / 1280 / 1600px のすべてで `documentElement.scrollWidth === clientWidth` (横スクロールなし)。
- 画面幅を越える要素は、横スクロール枠の 5 タブ (`overflow-x: auto`) と svg 内部の切り抜きだけで、枠外へのはみ出しは 0。
- 最下部までスクロールした状態で下部バーの「開く」リンクの中心点が他の要素に隠れず (モバイル下部ナビと重ならない)、高さ 44px。

条件: F1 / F2 は commit 前にコード外の成果物側で解消する (SYS-ANHUB-P13 close-out へ引き継ぎ)。コード変更に起因する未充足は無い。

## 判定のために追加した検証

- `packages/web/src/analysis-hub.dom.test.tsx` に「サイドバーの要確認バッジ」describe (2 件) を追加。AC-005 のバッジを直接検査するテストが存在しなかったため。write scope は P04 のテストファイルで、本 task の write scope 外の変更として close-out に記録する。
- 直書き色の同条件走査とハブ狭幅の実描画検査は、リポジトリに残さない一時スクリプトで実行した。
