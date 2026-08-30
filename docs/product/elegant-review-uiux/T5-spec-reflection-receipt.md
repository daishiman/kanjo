# T5. 仕様反映の受領書 — 共通ナビゲーションと認知負荷の改善

**記録日**: 2026-08-30 / **対象ブランチ**: `devgraph/feat-ui-navigation-cognitive-load` / **base**: `main`

**Beads**: `kanjo-ay0`(epic)、`kanjo-ay0.1`〜`kanjo-ay0.13` / **dev-graph node**: `feat-ui-navigation-cognitive-load`

コード変更が仕様・設計文書へ与える影響を層ごとに判定し、反映したものと、反映不要と判断した
理由を残す。判定単位は「その層が所有する契約が変わったか」であり、コードが触れたかではない。

## 何が変わったか(判定の入力)

1. **画面数**: 「見る」群の3画面(増減マトリクス `/matrix`・支出トレンド `/trends`・統計診断 `/diagnosis`)を
   `/analysis/:tab` へ統合。**17 route → 15 route + 3タブ(計18単位)**。実測で確認済み
   (`APP_ROUTES` 15件、`ANALYSIS_TABS` 3件、`taskDetail` 18件、アイコン18種)。
   旧URLは `LEGACY_ROUTE_REDIRECTS` で各タブへ `replace` リダイレクト。
   サブスク分析は統合していない(集計単位が支払先で違い、書き込み操作を持つため)。
2. **新機能: 画面検索(Cmd+K / Ctrl+K)**。`CommandPalette.tsx` + `route-search.ts`。ネイティブ `<dialog>`。
3. **`taskDetail` フィールド新設**(全routeで必須)。用語リンク53件。
4. **アイコン**を全単位へ付与(単色stroke SVG、18種)。
5. **現在地の強調を6重→2重**へ削減(実測でコントラストを測り3つを削除)。
6. **コンポーネント抽出**(`Layout.tsx` 295→165行)。
7. **サイドバー行高**をデスクトップで44→36px(タップ環境は44pxのまま)。
8. **テスト方式**をCSS正規表現照合から実Chrome(CDP)の実描画計測へ移行。

## 反映した層

| 層 | ファイル | 反映内容 |
|---|---|---|
| 製品正本 | `docs/spec-v1.1.md` | §4.1 の P2/P3/P14 を `/analysis/:tab` のタブへ(パスと表示名)、表の直後に「画面単位とルート数の関係」注記(15ルート+3タブ=18、サブスク分析を統合しない理由、旧URLリダイレクト)、§10.1 を17画面→15ルート+3タブへ、画面検索(Cmd+K)とサイドバー行高の2段構えを追記 |
| 詳細仕様 | `specs/ui-navigation-cognitive-load.md` | 冒頭に画面単位の定義、用語表へ「単位」「画面検索」、ユースケース2件追加、`FR-002` を18単位・図形の署名へ、`FR-008`(画面検索)・`FR-009`(タブ状態をURLに持つ)・`FR-010`(説明文を捨てない)新設、非機能へ行高の根拠と `<dialog>` の採用理由、UI状態遷移へ Tabs / Command palette、`BR-003` へ弱い強調の禁止、`BR-004`/`BR-005` 新設、データモデルへ `ANALYSIS_TABS`/`SEARCH_ROUTES`/`LEGACY_ROUTE_REDIRECTS`、互換性へリダイレクト方針、`AC-007`〜`AC-009` 新設と全AC充足、未決事項へ未実施2点とサイドバー高さ |
| 運用ガイド | `docs/ui-navigation-guidelines.md` | 行高を `--nav-row-min` の2段構えへ(WCAG 2.5.5 は AAA、ポインタ環境は SC 2.5.8 の24px)、強調を増やさない規準(1.11:1 の塗りは hover と見分けられない)、route追加手順へ `taskDetail` と画面検索、新節「画面を束ねるとき」(統合の可否条件・URL状態・旧URL・説明文の移送)、リリース前チェックへ3件、検証方式を実描画計測へ書き換え、計測でカバーできない2点を明記 |
| 機能ノード | `features/feat-ui-navigation-cognitive-load.context.json` | `goal` を18単位+画面検索へ、`scope_in` へ統合・画面検索・行高を追加、`acceptance` へ画面検索と旧URLリダイレクトの2件を追加し「17route」表記を更新、`updated_at` |
| タスク正本 | `tasks/feat-ui-navigation-cognitive-load/SYS-UINAV-P01〜P13.md`(13件) | 各フェーズ末尾へ「実装で確定した結果(2026-08-30)」を**追記**。過去の記述は書き換えず、「17 route」を18単位として読む旨と、フェーズ固有の確定事項を足した |

タスク13件のうち、特に厚く書いたのは次の3件。

- **P07(受入)**: 受入8件がすべて充足(うち2件は「実装不要と判定」)であることを表で示し、
  「visual確認」の解釈(本タスクは browser runtime を指定していないため実Chrome/CDPの数値計測を採る)を
  明記したうえで、**意匠の妥当性の人手レビュー**と**Chrome以外のブラウザ**は計測でカバーできず
  **未実施**であることを、充足として数えずに残した。
- **P08(共通化と全ページ整合)**: 抽出先4件と持たせた責務、`Layout.tsx` 295→165行。
- **P12(文書更新)**: 本受領書と同じ更新一覧。

### 反映しなかった既存記述について

`docs/spec-v1.1.md` の P番号(P1〜P17)は振り直していない。`tasks/tax-preparation-tasks.md` など
他文書が P16/P17 を参照しており、番号の詰め直しはその参照を壊す。P2/P3/P14 は「支出分析 — <タブ名>」
としてタブであることを行内で示し、表の直後の注記でルート数との関係を説明する形にした。

`docs/spec-v1.1.md` §9 の API 表にある `GET /matrix` `GET /diagnosis` は**画面パスではなくAPIパス**であり、
本変更でAPI契約は変わっていないため触っていない。

## 反映不要と判断した層

### `system-spec/`(全8章 + index + spec-state.json)— 影響なし

**理由**: 前例(`docs/product/elegant-review-tax-preparation/T5-spec-reflection-receipt.md`)の判定を
コピーせず、`00-requirements-definition.md`・`frontend.md`・`ui-ux.md` を実際に読んで確認した。結論は同じである。

- `00-requirements-definition.md` の U1 は「本番D1スキーマをコードの前提版へ一致させ続ける」であり、
  G1〜G4 はいずれも本番D1復旧・Migrate/Deploy分離・乖離の検知と説明・データ無損失。
  意思決定 D1〜D4 も migration gate / pre-apply backup / runtime schema guard / スキーマ不一致時の文言である。
  **server-error-recovery イニシアチブ専用の仕様ハーネス成果物**であることを確認した。
- 本featureに最も近い `frontend.md`(`serves_goals: [G3]`)と `ui-ux.md`(同 `[G3]`)を読んだが、中身は
  **プラットフォーム別の収集状態表**(Web=確定、mobile/tablet/desktopは対象外)と
  **設計知識カード**(Clean Architecture、Information Design)だけで構成されている。
  個別機能の画面一覧・route・ナビゲーション契約を**1つも持たない**。
  `ui-ux.md` 内の「画面」への言及は知識カードの適用条件の説明文であり、本アプリの画面を指していない。

本変更は同じイニシアチブのゴールを1つも変更せず、章が持つ抽象度の情報(収集状態・確定マーカー・
`serves_goals`)も変えない。よって章の更新対象にならない。

**判定の例外検討**: 行高を SC 2.5.5(AAA)ではなく SC 2.5.8(AA)で根拠づけ直した件は、
アクセシビリティの横断的な判断基準であり `ui-ux.md` への追記を検討した。同章は具体的な寸法契約を
1つも持たず知識カードだけで構成されているため、ここに個別の px 値を書くと章の抽象度が壊れる。
代わりに `docs/ui-navigation-guidelines.md`(契約)と `specs/ui-navigation-cognitive-load.md`(非機能要件)へ
根拠つきで置いた。この層の抽象度を上げる作業は本変更の範囲外とする。

### `docs/data-schema.md` — 影響なし

**理由**: 変更は表示構造とclient側 metadata に閉じており、永続データの形が変わっていない。
`taskDetail` も `ANALYSIS_TABS` も `routeMetadata.ts` の client metadata で、D1にもR2にも到達しない。

### `docs/requirements.md` / `docs/metrics.md` / `docs/ci-cd-operations.md` / `docs/runbooks/` — 影響なし

**理由**: 会計計算・API・データモデル・認証・インフラ・配信手順のいずれも変えていない。
テスト方式の変更(CSS正規表現照合 → 実Chrome計測)は `packages/web` 内のスクリプト構成の話で、
CI のジョブ契約(`pnpm test` / `typecheck` / `build`)は同じである。

### 確定申告feature所有の文書 — 対象外

`tasks/tax-preparation-tasks.md`、`architecture/arch-tax-preparation-boundary.md`、
`docs/product/elegant-review-tax-preparation/` は別featureの成果物である。
影響範囲のgrepで `tasks/tax-preparation-tasks.md:146`「T14 UI — ナビ契約の更新(15→17画面)」が
ヒットしたが、これは**確定申告featureが完了した時点の記録**であり、そのfeatureの履歴として正しい。
後から画面数が変わったからといって過去の完了記録を書き換えると、そのfeatureが何をしたのかが
読めなくなる。よって触っていない。現行の画面数は `docs/spec-v1.1.md` と `routeMetadata.ts` が持つ。

### `architecture/` / `docs/ui-decisions.md` / `features/feat-ui-navigation-cognitive-load.md` — 更新済み(本作業の対象外)

いずれもウェーブ3〜4の担当が更新済みのため、本作業では触っていない。内容は確認し、
本作業で書いた記述と矛盾しないことを確かめた。

## 未解決事項

### 1. `architecture/graph.json` に2ノードが未登録

`arch-ui-navigation-experience` と `arch-ui-navigation-frontend` が graph.json に登録されていない。
`specs/ui-navigation-cognitive-load.md` の `related_nodes` と
`features/feat-ui-navigation-cognitive-load.context.json` の `architecture_refs` は両ノードを参照しているため、
参照先が解決できない状態が残る。

**未対応の理由**: 登録は C02 atomic writer 経由で行う必要があり、PreToolUse フックが
`architecture/graph.json` への直接編集を拒否する。

### 2. `.dev-graph/state/graph.json` がリネーム前のパスを参照している

`architecture/ui-navigation-*.md` を指したままで、リネーム後の実ファイル名と一致しない。
**未対応の理由**は1と同じ(C02 atomic writer 経由が必要)。

### 3. `features/feat-ui-navigation-cognitive-load.md` の frontmatter が「17画面」のまま

同ファイルの**本文**には「画面数の更新(2026-08-30)」の節があり18単位として読む旨が書かれているが、
frontmatter の `goal` / `scope_in` / `acceptance` は着手時点の文言(「全17画面」「17route」)のままである。
本作業で更新した `features/feat-ui-navigation-cognitive-load.context.json` は同じフィールドを持つ
plan入力であり、こちらは18単位へ更新したため、**両者の文言が一致しない状態**になっている。

**未対応の理由**: 当該 `.md` は本作業の対象外(更新済みとして引き渡された)であり、
frontmatter は dev-graph が所有する。次に `/dev-graph` を回すときに context.json 側の文言へ寄せるのが妥当。

### 4. 実描画計測でカバーできない受入2点が未実施

- **意匠の妥当性の人手レビュー**(配色・余白が妥当かは計測で判定できない)
- **Chrome以外のブラウザでの描画差**(実描画検査はChromeのみ)

充足として数えず、`specs/ui-navigation-cognitive-load.md` の未決事項、
`SYS-UINAV-P07.md`・`P09.md`・`P13.md`、および `features/feat-ui-navigation-cognitive-load.md` の
受入節へ、いずれも**未実施**として明記した。

## 検証

本作業は文書のみで、コードには一切触れていない(`packages/web/` 配下は読み取りのみ)。
記述した数値は実測で確認した。

| 確認したこと | 結果 |
|---|---|
| `APP_ROUTES` のroute数 | 15 |
| `ANALYSIS_TABS` のタブ数 | 3 |
| `taskDetail` を持つ単位数 | 18 |
| 一意なアイコン識別子の数 | 18 |
| `LEGACY_ROUTE_REDIRECTS` の対象 | `/matrix` `/trends` `/diagnosis` → 各タブ |
| `features/*.context.json` のJSON妥当性と必須9キー | PASS |

テスト件数(52ファイル / 296テスト)と用語リンク53件は実装担当の報告値をそのまま引いており、
本作業では再実行していない。
