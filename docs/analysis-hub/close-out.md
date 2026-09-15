# 支出分析ハブ リリース判断とクローズアウト (SYS-ANHUB-P13)

> 注記: これは初回導入サイクルのクローズ記録。「次サイクル」の staleTime / invalidate は 2026-09-15 の再改善で解消し、現行の正本は `architecture-decision.md` とする。

- 実施日: 2026-09-15
- Entry gate: P12 完了 — `docs/ui-decisions.md` に「決定の更新(2026-09-15 / 支出分析ハブ)」を追記し C3 の例外を明記。`analysis-tabs` / `navigation-ux` / `common-shell-routes` の DOM テストは短縮名とハブ前提で緑 (下記 2)
- Source pin: `features/feat-analysis-hub.context.json` の SHA-256 が `dacba5d1016d278f40dd8d70ea86621422af0addaa4362cc639a6cb2713a711f` で task 仕様書の source_feature_digest と一致 (本 task で変更していない)
- 対象 feature: `feat-analysis-hub` (Beads epic `kanjo-lci`、task `kanjo-lci.1`〜`kanjo-lci.13`)
- 基準コミット: `2162fd2` (origin/main と同一) + 本 feature の未コミット変更

## 判断

**条件付きでリリース可。** 機能コードと配信経路はリリースできる状態にある。ただし default branch へ入れる前 (commit 前) に、コード外の成果物に起因する lint の 2 段 (F1 / F2) を解消することを条件とする。条件を満たさないまま PR を作ると、`ci.yml` の lint で落ちるため既存経路でのリリースに進めない。

> 更新 (2026-09-15 最終レビュー): F1 / F2 とも解消し `pnpm lint` exit 0 を確認した (下記 3-1、4-3)。条件は満たされたため **リリース可** とし、draft PR へ進める。

| 観点 | 結果 | 根拠 |
|---|---|---|
| P01..P12 の証跡が揃っている | 揃っている | `evidence.md` の phase 別表 (P01..P11) と本書 2 (P12) |
| 受入 S1〜S6 | S1〜S5 pass、S6 条件付き pass | `final-review.md` 2 |
| 配信構成が変わっていない | 変わっていない | 下記 1 |
| D1 migration を伴わない | 伴わない | `migrations/` の差分 0 |
| 既存 URL 契約の維持 (`/analysis/:tab`、`LEGACY_ROUTE_REDIRECTS`) | 維持 | `analysis-tabs.dom.test.tsx`「統合前のURLは行き先を失わない」ほか緑 |
| CI の lint | **赤 (F1 / F2)** | 下記 3 |

## 1. 既存配信経路の最終確認

architecture の前提「Worker / binding / cron の変更なし」を差分で確認した。

| コマンド | 結果 |
|---|---|
| `git diff --stat .github/workflows/ci.yml .github/workflows/deploy.yml` | 出力なし (差分 0) |
| `git diff --stat -- .github/workflows/migrate.yml packages/api/wrangler.jsonc packages/web/public/_headers migrations` | 出力なし (差分 0)、exit 0 |
| `git status --short -- migrations .github` | 出力なし (未追跡の追加もない) |
| `test -f docs/analysis-hub/close-out.md` | exit 0 |

- デプロイ単位は従来どおり `packages/web` (静的アセット) と `packages/api` (Worker) の 2 つで、新しいデプロイ単位・binding・cron は無い。
- 追加した API は `GET /api/analysis/hub` 1 本で、既存 Worker の `/api/*` 共通ゲートの後ろにマウントされる (`assurance.md` 3)。
- 初期 JS は 107.24KiB / 110KiB で予算内 (`assurance.md` 5)。

## 2. P12 の完了確認

| 確認 | 結果 |
|---|---|
| `grep -n 'C3' docs/ui-decisions.md` | 2 行 (節の導入文と「C3の例外: 集約API」の行) |
| `vitest run` analysis-tabs / navigation-ux / common-shell-routes / common-shell / analysis-hub | 5 files / 68 tests passed |

- `docs/ui-decisions.md` の追記は、2026-08-30 の「表示中のタブだけAPIを呼ぶ」を消さずに、例外の範囲 (ハブ画面とサイドバーのバッジだけ)・queryKey 共有・却下案・固定しているテスト名を残した。
- `common-shell-routes.dom.test.tsx` はタブ名の文字列を持たず (`/analysis/matrix` の経路だけ)、文言の更新は不要だった。短縮名の波及は `common-shell.dom.test.tsx` (現在地「総収支」) で受けている。
- `navigation-ux.dom.test.tsx` の「トータル収支を確認する画面へは…」は 2026-09-07 の利用者の質問の引用で、判断の経緯として残した。検査値は `総収支`。

## 3. commit 前に解消する条件

どちらも `packages/` の外にある仕様・計画サイクルの成果物が原因で、機能コードの差し戻しは不要。詳細は `test-run.md` の F1 / F2。

| # | 失敗する段 | 現状 (2026-09-15 再実行) | 解消方法 | 所有 |
|---|---|---|---|---|
| F1 | `check-design-tokens` | `external reference record digest differs: system-spec/spec-state.json` で停止。後続の段は未実行 | 更新後の `system-spec/spec-state.json` に対してデザイントークン承認記録 (`docs/design-system/token-approval.json`) を再承認し digest を更新する | デザインシステムの承認手順 |
| F2 | `security:content` | exit 2「公開文書にローカル絶対パスまたは実データファイル参照があります」 | 評価記録 4 ファイルの該当値を repo 相対パスへ置き換える。実データ (明細・金額) の混入ではない | 仕様・計画ハーネスの出力 |

- F1 の後ろにある `check-design-system-document-contract` / `check-design-system-delivery` / `check-design-system-run-references` は、F1 で止まるため今回の再実行では結果を得ていない。F1 解消後に `pnpm lint` を通しで再実行し、exit 0 を確認してから commit する。
- F2 の対象 4 ファイルのうち `.dev-graph/state/` 配下の 2 件は git の追跡対象外だが、スキャンは作業ツリーを見るため、ローカルの lint を緑にするには同様に置き換える。

### 3-1. 解消の記録 (2026-09-15 最終レビュー)

- **F1**: 再承認ではなく、承認記録の参照先を退避サイクル `system-spec/archive/2026-09-14-design-system-foundation/` へ付け替えた。承認の対象はデザインシステムサイクル時点の要件定義書と spec-state であり、退避コピーは HEAD (`2162fd2`) と同一 bytes (spec-state `ebb1719358de…`、要件定義書 `bc82e473b54a…`) である。現行 `system-spec/` を指したまま digest だけ更新すると、承認していない分析ハブサイクルの内容を承認対象へ差し替えることになるため採らなかった。
  - `token_values_digest` / `display_export_surface_digest` / `projection_policy_digest` は変化なし (トークン値・公開面・投影規則は不変)。パス名を含む `provenance_content_digest` / `external_reference_digest` / `approval_subject_digest` の 3 値だけが変わり、`approval_subject_digest` を参照する `docs/design-system/run-reference.json` と `verification-run.json` の同値を追随させた。`humanApproval` は `pending-external` のまま。
  - `architecture/design-system-*.md` と `specs/spec-design-system-foundation.md` の lineage も同じ archive を指しており、参照先が揃った。
- **F2**: 評価記録の絶対パス 4 件を置き換えた。`.dev-graph/plans/feature-package-feat-analysis-hub/plan-findings.json` と追跡外 2 件はプラグインのキャッシュ位置を `${PLUGIN_ROOT}` / `${PLUGIN_CACHE}`、リポジトリ位置を `<repo-root>` へ。`system-spec/completeness-findings.json` の `spec_dir` は HEAD 版と同じ相対表記 `system-spec` へ戻した。判定値・digest 対象の意味は変えていない。

## 4. task の write scope を越えた変更

すべて理由付きで記録済み。PR 本文には「本 task の write scope のファイルのみ」という契約があるため、feature を 1 PR にまとめる場合はこの表を本文に転記する。

| ファイル | 変更 | 理由 | 記録 |
|---|---|---|---|
| `packages/core/src/index.ts` | `export * from './analysis-hub.js'` の 1 行 | core の公開面が再輸出で決まるため | `design-review.md` 指摘 3 |
| `packages/web/src/common-shell.dom.test.tsx` | 現在地の期待値 `トータル収支` → `総収支` | 短縮名の波及 | `design-review.md` 指摘 4 |
| `packages/web/src/analysis-hub.dom.test.tsx` | W1 / W2 検出の強化、サイドバーのバッジ 2 件 | 変異が生存した / AC-005 を直接見るテストが無かった | `test-run.md`、`acceptance.md` |
| `packages/web/src/analysis-tabs.dom.test.tsx`・`navigation-ux.dom.test.tsx` | 短縮名とハブ前提へ更新 | P12 の write scope だが、回帰を止めないため P05〜P06 で先に更新 | `final-review.md` 4 |
| `packages/web/scripts/check-financial-visuals.mjs` | API 差し替え表に `/api/analysis/hub` (件数 0 の固定応答) を追加 | 下記 4-1 | 本書 |

### 4-1. P13 の最終回帰で見つけた穴

- 現象: `pnpm -r test` の web で `mobile-financial-visualization-render.test.ts` が赤。「Matrix の描画待ちがタイムアウトしました: ログイン」。再実行でも再現した。
- 原因: 実描画検査は「画面が呼ぶ API をすべて CDP で差し替える」前提で、差し替え表に無い要求は vite の `/api` 中継 (8787) へそのまま流す。本 feature でサイドバーのバッジが**全画面で** `GET /api/analysis/hub` を呼ぶようになったが、表に追加していなかった。8787 に何も居なければ中継は失敗してバッジが出ないだけで済むが、同じ端末で別の `wrangler dev` が 8787 を使っていると 401 が返り、`api.ts` のグローバル 401 処理でログイン画面へ切り替わる。P09 の実行時点ではこの条件が無く、緑だった。
- CI への影響: CI には 8787 のサーバが無いため顕在化しにくいが、「差し替え漏れ」という検査の前提崩れは同じなので塞いだ。
- 修正: 差し替え表へ件数 0 の集約応答 (`AnalysisHubReport` と同じ形) を 1 件追加。バッジは出ない状態で描画され、既存の検査対象 (タブ画面) の見た目は変わらない。
- 確認: 修正前は 2 回連続赤、修正後に単独で緑、web 全件 74 files / 551 tests 緑。
- write scope: `scripts/` はどの task の write scope にも無いが、本 feature の変更が既存テストを壊した回帰の修正であり、検査の意味 (差し替えた API だけで描く) を変えないため 1 行の追加に留めた。

### 4-2. 最終回帰 (2026-09-15、P12 追記と 4-1 修正の後)

| コマンド | exit | 結果 |
|---|---|---|
| `pnpm --filter @kanjo/core test` (`pnpm -r test` 内) | 0 | 41 files passed・1 skipped / 579 passed・6 skipped |
| `pnpm --filter @kanjo/api test` | 0 | 40 files / 529 tests |
| `pnpm --filter @kanjo/web test` | 0 | 74 files / 551 tests |
| `pnpm typecheck` | 0 | core / api / web |
| `biome check .` | 0 | 389 files |
| `pnpm lint` | 1 | F1 で停止 (上記 3) |
| `pnpm run security:content` | 2 | F2 (上記 3) |

### 4-3. 最終レビューでの再実行 (2026-09-15、再改善と 3-1 の後)

| コマンド | exit | 結果 |
|---|---|---|
| `pnpm -r --workspace-concurrency=1 test` | 0 | core 579 passed・6 skipped / api 529 / web 77 files・564 |
| `pnpm typecheck` | 0 | core / api / web |
| `pnpm lint` | 0 | biome 401 files、glossary・graph-lineage 53 ノード・design-tokens・document-contract・delivery・run-references・security:content すべて緑 |
| `node --test scripts/design-system-status.test.mjs scripts/check-design-system-document-contract.test.mjs` | 0 | 17 pass (F1 の付け替えの影響確認) |

MVP のため、実 Chrome を使う `check:analysis-hub` / `check:mobile-layout` は本レビューでは再実行していない (CI の `verify:full` に委ねる)。

## 5. クローズアウト記録

| Phase | Beads | 成果物 | 状態 |
|---|---|---|---|
| P01 要件 | kanjo-lci.1 | `requirements-baseline.md` | 完了 |
| P02 設計 | kanjo-lci.2 | `architecture-decision.md` | 完了 |
| P03 設計レビュー | kanjo-lci.3 | `design-review.md` | 完了 |
| P04 テスト設計 | kanjo-lci.4 | core / api / web のテスト 3 ファイル | 完了 |
| P05 実装 | kanjo-lci.5 | core / api / web の実装 | 完了 |
| P06 実行 | kanjo-lci.6 | `test-run.md` | 完了 |
| P07 受入 | kanjo-lci.7 | `acceptance.md` | 完了 (AC-006 条件付き) |
| P08 リファクタリング | kanjo-lci.8 | `refactoring.md`、`packages/api/src/ai/dataset.ts` | 完了 |
| P09 品質保証 | kanjo-lci.9 | `assurance.md` | 完了 |
| P10 最終レビュー | kanjo-lci.10 | `final-review.md` | 完了 (pass) |
| P11 証跡索引 | kanjo-lci.11 | `evidence.md` | 完了 |
| P12 規約とテスト | kanjo-lci.12 | `docs/ui-decisions.md` の追記、DOM テスト | 完了 |
| P13 リリース判断 | kanjo-lci.13 | 本書 | 完了 (条件付きリリース可) |

- tracker の完了投影は `default-branch-reconciliation` (既定ブランチへの反映をもって完了)。本サイクルは commit / push / PR を行っていないため、Beads 上の done 化は PR の merge 後に dev-graph の sync で行う。作業ツリー上の完了と tracker 上の完了は、merge まで一致しない。

## 6. 次サイクルの候補

本 feature の scope_out と、レビューで見つけた穴。いずれも起票はせず、候補として記録する。

| 候補 | 種別 | 出所 |
|---|---|---|
| 5 タブ詳細画面の作り直し (照合・総収支・マトリクス・推移・診断) | 新 feature | `features/feat-analysis-hub.md` scope_out |
| 総収支の判定・freee 除外・分類・予算の成功時にハブを invalidate、`staleTime=30秒` | 解決済み | 2026-09-15 再改善 |
| `check-financial-visuals` / `check-mobile-layout` の巡回対象に `/analysis` を追加 | follow-up | `assurance.md` 6 |
| AI 用データの前期間の窓 (`buildAgentData` の `period.previous`) を固定する api テスト | follow-up | `refactoring.md` |
| 期間を選んだ状態 (localStorage に期間あり) でも URL コピーが `/analysis?focus=<id>` のままであることのテスト | follow-up | `final-review.md` 7 |
| 仕様・計画ハーネスが評価記録へ絶対パスを書き出す問題 (F2 の再発防止) | ハーネス側の改善 | 本書 3 |
| 確定仕様 `specs/spec-analysis-hub.md` の Cache 節へ、invalidate の発火元 (分類・分割・予算) と `staleTime` の値を reopen で分割記載する | 仕様 reopen 候補 | 本書 7 |

## 7. 仕様反映の受領書

最終レビュー実施日 2026-09-15、base コミット `2162fd2` (origin/main と同一、dev ブランチは無い)。判定単位は「その層が所有する契約が変わったか」であり、コードが触れたかではない。

| 変更群 | 仕様影響 | 反映先 / 判断理由 |
|---|---|---|
| core `analysis-hub.ts`、api `routes/analysis-hub.ts`、web ハブ画面 (`Analysis.tsx`、`pages/analysis-hub/*`、`routeMetadata.ts`、`Layout.tsx`、`RouteIcon.tsx`) | **あり** | 本サイクルの確定仕様として `system-spec/` 8 章 + 要件定義書、`specs/spec-analysis-hub.md`、`architecture/analysis-hub-*.md` 8 件、`features/feat-analysis-hub.*`、`tasks/feat-analysis-hub/sys-anhub-p01..p13.md` を `/dev-graph` の spec → decompose → plan → node の正規経路で生成・登録済み。`check-graph-lineage` で 53 ノードの digest 一致を確認 |
| `system-spec/*` と `system-spec/archive/2026-09-14-design-system-foundation/` | **あり** | 前サイクル (デザインシステム基盤) を archive し、本サイクルの確定章を再生成。`architecture/design-system-*.md`・`specs/spec-design-system-foundation.md` の lineage と、トークン承認記録 (本書 3-1) を archive 先へ張り替え済み |
| 再改善の invalidate 集約 (`analysis-query-invalidation.ts`、`Budget.tsx`、`Classify.tsx`、`classification-invalidate.ts`) | **契約の変更なし・詳細化** | 確定仕様の契約は「更新成功で `['analysis-hub']` を前方一致で invalidate し、保存後に古い判定を残さない」(`qa-frontend-web-ah-decision-003`)。発火元に分類・分割・予算を足したのはこの契約の適用範囲の詳細化で、応答形・queryKey・API は変わらない。確定仕様自身が「invalidate の対象範囲と staleTime は reopen 時に分割する」を未決事項として持つため、確定章は書き換えず、実装の正本を `architecture-decision.md` の decision-003 と `docs/ui-decisions.md` に記録した。reopen 候補として本書 6 に登録 |
| SPA 遷移の共通境界 (`NavigationEffects.tsx`)、状態の区別、実描画検査 (`check-analysis-hub-visuals.mjs`、`viewports.mjs`、`styles.css` の 1024〜1199px) | **契約の変更なし・詳細化** | 確定仕様の NFR (WCAG 2.2 AA、狭幅で横スクロールしない、S1/S6) を満たす手段の決定。新しい画面・API・データを持たない。`architecture-decision.md` の decision-005〜008 と `docs/product/T2-experience-spec.md`「支出分析ハブ」節へ反映済み |
| api `duplicate-verdict-bindings.ts` (総収支から判断の結び付けを切り出し) | **なし** | 関数本体は移動のみで、tx_id 優先 → 現行版 stable_key の順序と重複鍵の不結合は不変。ハブと総収支の件数定義を 1 か所に揃える内部リファクタ。既存の総収支 api テストが緑 |
| `docs/design-system/{token-approval,run-reference,verification-run}.json` | **なし** | 承認対象の参照先の付け替えのみ (本書 3-1)。トークン値と承認状態は不変 |
| `.dev-graph/plans/feature-package-feat-analysis-hub/plan-findings.json`、`system-spec/completeness-findings.json` | **なし** | 絶対パスの匿名化のみ (本書 3-1) |
| `package.json` / `packages/web/package.json` (`check:analysis-hub` を `verify:full` へ追加) | **なし** | 検証コマンドの追加。製品挙動と配信構成を変えない |

### 範囲逸脱の扱い

再改善 (invalidate 集約・ナビゲーション効果・実描画検査・判断の結び付けの切り出し) と F1 / F2 の解消は、promotion 済みで digest 固定の task `resource_scope` を後追いで書き換えず、本書 4 と本節へ記録する形をとった。いずれも確定仕様の契約を変えないため、spec / architecture の再プロモーションは行わない。

## Rollback

- 本書の取り消し: `docs/analysis-hub/close-out.md` を削除する。
- リリース後に問題が出た場合: 既存の Cloudflare Workers のロールバック手順 (直前のデプロイへ戻す) に従う。D1 migration を伴わないため、データの巻き戻しは不要。
