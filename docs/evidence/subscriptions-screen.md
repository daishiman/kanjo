# サブスク画面 — 証跡

タスク仕様書 `tasks/feat-subscriptions-screen/sys-subs-p01.md` .. `p13.md` (package: `.dev-graph/plans/feature-package-feat-subscriptions-screen/task-specs/`) が求める証跡の所在。

マトリックス画面 ([`../matrix/evidence-index.md`](../matrix/evidence-index.md)) と同じく、**既に正本があるものはポインタ**、**他にどこにも無いもの (テスト実行記録・受入判定・保証確認・途中の失敗と是正・リリースノート) はこのファイルが本体**とした。

| 名前 | 所在 |
|---|---|
| 仕様の正本 | `specs/spec-subscriptions-screen.md`、`features/feat-subscriptions-screen.md` (受入 S1..S5) |
| 設計判断 | `architecture/subscriptions-*.md` 8 本 |
| 受入 19 項目・数値の定義・見直し候補の規則 | [`../subscriptions-screen.md`](../subscriptions-screen.md) |
| 仕様反映の受領書 | [`subscriptions-spec-reflection-receipt.md`](subscriptions-spec-reflection-receipt.md) |
| 計画の検証 | `.dev-graph/plans/feature-package-feat-subscriptions-screen/plan-findings.json` |
| テスト実行記録 | 下記「1. テスト実行記録」 |
| 受入判定 | 下記「2. 受入基準の判定」 |
| 保証確認 | 下記「3. 保証確認」 |
| 途中の失敗と是正 | 下記「4. 途中の失敗と是正」 |
| リリースノート | 下記「5. リリースノート」 |

## 1. テスト実行記録

2026-09-18、ローカル (macOS) で実行した。値はすべてコマンドの出力から写した。

| コマンド | exit | 結果 |
|---|---|---|
| `pnpm verify:full` | 0 | 下の各行を `&&` でつないだもの。最初の失敗より後ろは走らないので、全段の通過をこの 1 行で確かめている |
| `pnpm test` (core) | 0 | Test Files 49 passed / 1 skipped (50)、Tests 784 passed / 6 skipped (790) |
| `pnpm test` (api) | 0 | Tests 636 passed (636) |
| `pnpm test` (web) | 0 | Tests 718 passed (718) |
| `pnpm --filter @kanjo/core exec vitest run test/subs-screen-contract.test.ts` | 0 | Tests 50 passed (50) |
| `pnpm typecheck` | 0 | core / api / web すべて Done |
| `pnpm lint` | 0 | biome、glossary (59 語すべて使用)、report-css、graph-lineage、design-tokens (直書き 0 件)、design-system の各検査、`security:content` (公開文書の実データ参照チェック) |
| `pnpm build` の `check:js-budget` | 0 | `初期JS budget: 102.95KiB / 110KiB (assets/index-D64PsrZg.js=102.95KiB)` |
| `check:financial-routes` / `check:mobile-layout` ほか実描画の検査 | 0 | `check-financial-visuals.mjs` を含め、verify:full の build 以降の段がすべて通過 |
| `validate-system-plan.py --staging .dev-graph/plans/feature-package-feat-subscriptions-screen` | 0 | `status: pass`、`violations: []`、P01..P13 exact 13、digest `sha256:43c180442d323619da959ba559d05c4cc62b59a5e1b0c231fe45d360537324fe` |
| `pnpm run evidence:check` | 1 | **stale**。design-system の changed-path-manifest の `base_revision` が `35fffe4` で、HEAD (`4e3583c`) と違う。本サイクルの前から残っている不一致で、サブスク画面の変更とは関係しない。直すには design-system 側で manifest を作り直す必要があり、本 feature の範囲外 |

## 2. 受入基準の判定

`features/feat-subscriptions-screen.md` の acceptance に対する判定。19 項目の細目は [`../subscriptions-screen.md`](../subscriptions-screen.md) の「要件表」にあり、各行が固定するテスト名を持つ。

| | 内容 | 判定 | 根拠 |
|---|---|---|---|
| S1 (G1) | 構成要素がすべて描画され、トークンと共通部品経由、直書き色 0 件、ロゴ 0 件 | **達成** | web `subscriptions-screen.dom.test.tsx` (見出し・KPI 5 枚・9 列・詳細パネル・検出理由カード・推移・比較)、`check-design-tokens` 直書き 0 件。画面は共通 `Layout` の `PageShell` の中に描かれ、操作は共通 `Button` を使う。ロゴは web `ロゴ画像要素が 0 件` と `check-financial-visuals.mjs` で確認 |
| S2 (G2) | 行を選ぶと詳細パネルが同じ月額推定・年換算を示し、統合が aliases に反映され、再読込後も同じベンダーにまとまる | **達成** | web `行を選ぶと URL に vendor が付き詳細が開く` (再読込での復元を含む)、`2 件チェックで選択中バーが出て統合 API を呼ぶ`、api `統合は既存の別名とまとめ、同じ別名は冪等に無視する` |
| S3 (G3) | 見直し候補の規則と文テンプレートが docs にあり、境界値テストで固定、4 か所の件数が一致 | **達成** | 規則は [`../subscriptions-screen.md`](../subscriptions-screen.md)。core `見直し候補の並び`・指紋の境界値・`二重請求・急増 (dup / spike) は既存 alerts と同じ境界`。件数の一致は api `確認するとサイドバーのバッジと KPI が 1 減り、取消で戻る` |
| S4 (G4) | 一覧の合計行・比較の合計・KPI の月額合計が一致し、12 か月の支払額と売上比が既存関数と一致 | **達成** | core `一覧の推定月額の和 = 合計行 = KPI`、`年換算比較は月額の降順で fixture と一致する`、`推移の棒の和 = 直近12か月の支払額`、`KPI は fixture の検算値と一致する`。数値の正本は core の fixture で、画像の数値は写していない |
| S5 (G5) | migration 0043 後も既存データが残り、旧 UI の操作がすべて新しい画面から行える | **達成** | 0043 は `ALTER TABLE ... ADD COLUMN` と `CREATE TABLE IF NOT EXISTS` だけ (api `schema-guard` / `deletion-schema.test.ts`)。ローカル D1 に適用し、既存の登録ベンダー 8 件が残ることを確認。別名・対象科目・四半期見直し・未登録候補の採用 / 除外は web の関連データタブ・候補のテストで確認。旧 UI の「検知アラート」は表示だけの帯で、同じ規則 (dup / spike) が検出理由カードに出る |

## 3. 保証確認

| 観点 | 結果 |
|---|---|
| アクセシビリティ | 一覧の各行に詳細を開く `Button` があり、行のクリックと同じ操作をキーボードで行える。横に長い一覧はスクロール領域に `tabIndex=0` を持つ。詳細パネルは 3 タブを `role="tab"` で持つ。読込の失敗は `role="alert"` で読み上げる。用語ヘルプ (売上比・ベンダー名) は共通の `Term` を使う |
| 入力検証 | 更新 4 経路は不正な本文を 400、候補でないものを 409 で返す (api `未登録・他人のベンダーは 404、候補でなければ 409、不正な本文は 400`) |
| 応答の保存禁止 | 集計と詳細の応答は `Cache-Control: private, no-store` (api `集計と詳細の応答は保存させない`) |
| 所有者の絞り込み | 他人のベンダー・判断は 404、未ログインは 401、パスワード変更前は fence で止まる (api の同名テスト) |
| JS バンドル予算 | **達成**。`check:js-budget` が 102.95KiB / 110KiB (ローカル実測。CI の値はローカルより 0.5KiB ほど大きく出ることがある — [`../matrix/evidence-index.md`](../matrix/evidence-index.md) の記録) |
| ロゴ | 取得も表示もしない。`img`・背景画像・頭文字の図形が 0 件 (web テストと実描画の検査の両方)。ただし「ロゴを置くと落ちる」ことをわざと確かめる検査 (逆向きの確認) はしていない |
| 外部送信 | 取込データを外部へ送る経路を足していない。集計はすべて Worker と D1 の中で行う |

## 4. 途中の失敗と是正

| 失敗 | 原因 | 是正 |
|---|---|---|
| typecheck (TS2345) | `db.batch` の型は先頭要素を要求するのに、空になりうる配列を先頭に展開していた | 必ずある `sub_vendors` の更新を先頭に置いた。同じ batch の中なので原子性は変わらない |
| check-glossary | 旧 UI の撤去で、用語 `revenueShare` と `vendor` がどの画面でも使われなくなった | KPI の「売上比」と一覧の「ベンダー名」に用語ヘルプを付け直した |
| 実描画 (1024px) | 一覧と比較のカードが 1061px になり、本文の列 (220〜1009px) をはみ出した。grid の暗黙の auto 列が表の最小幅まで広がるため | `.subs-main, .subs-side` に `grid-template-columns: minmax(0, 1fr)` を指定した |
| security:content | 計画の検証記録と完成度評価の記録に、ローカルの絶対パスが入っていた | 以前のサイクルと同じ書式 (`<harness>/...`、`<repo-root>`、repo 相対) に置き換えた |

## 5. リリースノート

**整える > サブスク画面を作り直した。**

- 上に KPI を 5 枚並べた。月額合計・年額換算には前期間との差を出す。
- 一覧に推定月額・年換算・見直しの状態を並べ、行を選ぶと右に詳細 (概要・支払い履歴・関連データ) が開く。選んだ行は URL に残るので、再読込しても同じ詳細に戻る。
- 「見直し候補」をなぜ候補なのかの理由文つきで出すようにした。「確認済み」「対象外」を決めると候補から消え、サイドバーの件数も同じだけ減る。取り消せる。
- 同じサービスの別名 (カード明細の表記ゆれ) を 2 件選んで 1 つにまとめられるようにした。
- 以前は別の部品に分かれていた別名・対象科目・四半期見直し・未登録候補の採用 / 除外を、同じ画面の中に集めた。

**しないこと**: サービスのロゴの取得・表示。外部サービスや生成 AI による分類と理由文。
