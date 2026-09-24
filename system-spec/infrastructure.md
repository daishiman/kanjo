---
status: confirmed
category: infrastructure
aggregate: 確定
spec_cells: [infrastructure.web, infrastructure.mobile, infrastructure.tablet, infrastructure.desktop-windows, infrastructure.desktop-linux, infrastructure.desktop-macos]
serves_goals: [G1, G4]
---

# インフラ (infrastructure)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-guide-infrastructure-web-001。裏付け質疑 (`qa_refs`): `qa-guide-infrastructure-web-evidence-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、infrastructure ではストア配布・自動更新の配信経路を決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、infrastructure ではストア配布・自動更新の配信経路を決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、infrastructure ではストア配布・自動更新の配信経路を決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、infrastructure ではストア配布・自動更新の配信経路を決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、infrastructure ではストア配布・自動更新の配信経路を決める必要があった。対象を web のみとする利用者決定 (qa-guide-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | 使い方画面を遅延読み込みの chunk に閉じ、初期 JS 予算 110KiB を check:js-budget で守る形へ反映した。/api/guide が失敗しても本文 (core の定数) は描き、数値の枠だけを読み込み失敗として示す。 |
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | 使い方画面のために新しい cron・binding・環境変数を足さず、夜間の 0 18 * * * の計画上限にも触れない形へ反映した。/api/guide は既存の api Worker の 1 経路として配備される。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G4

#### 主たる接地根拠: `qa-guide-infrastructure-web-001`

**問**

使い方画面サイクルでインフラに何を足すか。

**答**

足さない。新しいバインディング・環境変数・cron は無く、/api/guide は既存の api Worker に載る。web の新しい画面は遅延読み込みの chunk に閉じ、初期 JS 予算 110KiB を超えない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-guide-001) と決定 qa-guide-decision-001〜007 の範囲に収まる確定内容。利用者が決めていない具体値は除き、同カテゴリの -003 (agent-inference) に分けた。 / 回答時刻: 2026-09-23T12:37:28Z)

#### 裏付け質疑: `qa-guide-infrastructure-web-evidence-001`

**問**

infrastructure 章の裏付けとして、現行実装について何を観測したか。

**答**

api は Cloudflare Workers と D1 (packages/api/wrangler.jsonc)、夜間の scheduled 処理は crons 0 18 * * * (wrangler.jsonc:31)。web は Vite ビルドを Workers の静的配信で出す。初期 JS 予算 110KiB を check:js-budget が検査する。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測。answered_at は観測後に実測した時刻。 / 回答時刻: 2026-09-23T12:37:28Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: /guide を 19-guide.png どおりの画面にする。問いの見出しと説明、共通の期間と前後移動、4 ステップ (取込む・整える・確認・計画) と各『元画面を開く』、使い方ガイド (左の目次 6 項目＋用語と目安、月次の流れステッパー、総収支の読み方 = 総収入 − 総支出 = 純収支 を選択期間の実データで、含まれるもの・振替は除外・freee の権限、期間の切り替えによる表示の違い表)、右カラム (このページの数値・関連ページ・ガイド内を検索)、よくある疑問と対処法 5 行 (データの出所・確認の条件・関連ページ)、下部固定バー (現在のトピックと主要な元画面へのボタン) を描く。
- **G4**: 共通シェルのフッタを画像に合わせつつ、表示を事実どおりに保つ。ヘッダは『防衛ライン』のまま (画像の『取引ライン』には合わせない)、フッタ 1 文目は『取込データは外部送信しません』とし、AI 実行時に集計データを渡す事実を補足で必ず見せる。ガイドの API は利用者ごとに分離し、他人の数値を返さない。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | 使い方画面が画像の全構成要素を描画する。 | DOM テストで、問いの見出し・期間の前後移動・4 ステップと 4 つの元画面リンク・目次 7 項目・ステッパー・総収支の 3 枚 (実データの金額)・含まれるもの 3 枚・期間の表 4 行・このページの数値 4 項目・関連ページ 5 件・ガイド内検索・よくある疑問 5 行・下部固定バーの存在を確認し、全て通る。 |
| O4 | 既存の品質ゲートを緑のまま保つ。 | pnpm lint・typecheck・test・skills:test・初期 JS 予算・verify:full が全て exit 0。 |
| O5 | 使い方の API が利用者ごとに分離され、AI 送信の補足が 3 か所で読める。 | 他の利用者のセッションで /api/guide がこの利用者の数値を 1 つも返さないことを API テストで確かめ、AI 実行時に集計データを渡す補足がフッタの title・プライバシー欄・使い方画面の 3 か所にあることを DOM テストで確かめ、いずれも通る。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Guide.tsx を pages/guide/ 配下へ分割し、問いの見出し・期間・4 ステップ・目次と本文・右カラム・よくある疑問・下部固定バーの構成に作り直す。選択中のトピックと検索語を URL に保つ。
- **I3**: GET /api/guide を追加し、選択期間の総収入・総支出・純収支 (振替除外)・最終更新・データの出所を core の guide-screen で JSON に写す。利用者ごとに分離し期間クエリを検証する。
- **I6**: 共通シェルのフッタ 1 文目を『取込データは外部送信しません』に変え、AI 送信の補足を 3 か所に置く。ヘッダの『防衛ライン』は変えない。common-shell のテストを更新する。
- **I7**: 期間の前後移動 (shiftedPeriod) を core へ移し、決算書と使い方画面で共有する。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

本章へ引く card は 0 件である。使い方画面を既存の api Worker と静的配信に載せ、binding・環境変数・cron を足さない判断は、Operations と Reliability の上流指針 (doctrine) の側で記録した。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-23T12:41:26Z)

- `ref-system-design-knowledge/references/resource-map.yaml` (本章へ引く card は 0 件。未着手ではなく、上の適用記述で0 件である理由を述べた上での確定である)

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-workers-static-assets | 2026-07-03 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers/static-assets/ | 2026-09-23T12:39:53Z | 2026-09-23T12:39:53Z |
