# P01 要求・現状UI監査

- Feature: `feat-ui-navigation-cognitive-load`
- Task: `SYS-UINAV-P01` / Beads `kanjo-ay0.1`
- Source digest: `sha256:be365873e506ea86341c1df37ab821656834663dd168ce6eb1aa4beb7bd13ccd`
- Privacy: コードと匿名fixtureのみを確認。`data/`、口座明細、実金額、`.dev.vars` は未使用。

## 依存・変更境界・品質ゲート

| Phase | 依存 | Write scope | 完了ゲート |
|---|---|---|---|
| P01 | なし | 本書 | 二重active、17 route、編集導線、情報密度の基準を確定 |
| P02 | P01 | `phase-02-navigation-contract.md` | current/icon/spacing/mobile契約を確定 |
| P03 | P02 | `phase-03-design-review.md` | 認知負荷・a11y・可逆性に高重大度指摘なし |
| P04 | P03 | `phase-04-test-design.md` | RED→GREENで再現可能な検証を定義 |
| P05 | P04 | `routeMetadata.ts`、`Layout.tsx`、`RouteIcon.tsx`、`styles.css`、`navigation-ux.dom.test.tsx` | 共通実装とDOM契約PASS |
| P06 | P05 | `phase-06-test-run.json` | web test/typecheck/build PASS |
| P07 | P06 | `phase-07-acceptance.md` | 申告2画面と代表導線の実ブラウザ確認PASS |
| P08 | P07 | P05の共通3ファイル | 17画面の共通表示規則に重複なし |
| P09 | P08 | `phase-09-quality-assurance.md` | 375/768/1280/1600、200%相当、keyboard、reduced-motion PASS |
| P10 | P09 | `phase-10-final-review.md` | 仕様・設計・差分照合、高重大度0 |
| P11 | P10 | `phase-11-evidence-index.md` | 匿名の再現可能な証跡索引を確定 |
| P12 | P11 | `docs/ui-navigation-guidelines.md` | 将来の追加規則を文書化 |
| P13 | P12 | `phase-13-pr-readiness.md` | commit/push/PR/deployを除く提出直前確認PASS |

## 変更前ベースライン

| 観点 | 確認した事実 | 重大度 | 改善方針 |
|---|---|---:|---|
| 現在地 | `Layout.tsx` は `/` だけ `end` を指定。`/tax/receipts` で `/tax` と `/tax/receipts` の2リンクがactiveになる | 高 | 全routeを完全一致で判定し、currentを0〜1件へ固定 |
| route識別 | `APP_ROUTES` 17件に可視labelはあるがicon keyがない | 高 | 全件必須・重複なしの型付きLucide icon keyを正本へ追加 |
| 選択表現 | desktop currentは青い背景と白文字だけ | 高 | `aria-current=page`、太字、境界、現在地indicatorを併用 |
| 間隔 | nav行の最小高は36px、icon-label tokenなし、sidebar幅218px | 高 | 44px hit targetとicon/label/group/sidebar tokenを共通化 |
| モバイル | bottom tabとdrawerはいずれも文字のみ | 中 | bottom tabとdrawerにも同じicon+label契約を適用 |
| 情報階層 | 17 routeは共通`PageHeader`で目的を表示。多くのページはKPI/状態/主操作を直後に置く一方、長いtask文は初期表示の文字量を増やす | 中 | headerは短い目的を保ち、補足詳細は既存のinline disclosureへ。説明の追加で補わない |
| 編集 | 公私仕分けは対象名・変更内容fieldset・保存・閉じる・未保存確認・保存失敗を実装済み。税務・予算・現金・設定も対象近傍の保存状態を持つ | 低 | 既存の安全契約を保持。画面を遮る共通modalへの全面置換は行わず、共通style/監査で一貫性を確認 |
| 通常遷移 | 通常のページ移動にmodalは使っていない | なし | 現状維持。drawerは狭幅ナビに限定 |

## 場面と情報設計

- 場面: 個人事業主が自席のPCまたはスマートフォンで、17画面を移動しながら月次確認・分類・申告準備を1画面ずつ進める。
- 中心対象: 現在の業務画面と、その画面で扱う収支・明細・申告準備。
- 最頻操作: 画面を選ぶ、現在地を確認する、要対応を1件ずつ処理する。
- 起きてはいけないミス: 別画面を現在地と誤認する、未保存の編集を失う、税務上の警告や保存失敗を見落とす。
- 成功時の感情: 「いまどこにいて、次に何をすればよいか迷わず、やめても壊れない」。

## 要件フラグ（今回差分）

| フラグ | 判定 | 理由 |
|---|---|---|
| 認証あり | OFF（差分なし） | 既存認証を維持し、今回変更しない |
| AI機能あり | OFF（差分なし） | AI画面は既存機能。今回のAI処理・費用・データ境界は不変 |
| リアルタイム同期 | OFF | 要件なし |
| メール送信 | OFF | 要件なし |
| 公開フォーム | OFF | 要件なし |

## 判定

- P01 acceptance: PASS
- 高重大度の未解決: 0（上表の高項目はP02〜P05で解消する実装対象として確定）
- スコープ外: 会計計算、API、データ、認証、インフラ、deploy、commit、push、PR。

