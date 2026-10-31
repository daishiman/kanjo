---
status: confirmed
category: infrastructure
aggregate: 確定
spec_cells: [infrastructure.web, infrastructure.mobile, infrastructure.tablet, infrastructure.desktop-windows, infrastructure.desktop-linux, infrastructure.desktop-macos]
serves_goals: [G1, G5]
---

# インフラ (infrastructure)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-tradeoff-infrastructure-web-001。裏付け質疑 (`qa_refs`): `qa-tradeoff-infrastructure-web-evidence-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G1, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、infrastructure ではアプリストアへの配布と審査の手順を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、infrastructure ではタブレット向けの配布物の分割を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、infrastructure ではWindows のインストーラと更新サーバを決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、infrastructure ではLinux の配布形式 (AppImage など) の選定を決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、infrastructure ではmacOS の配布と更新サーバを決める必要があった。対象を web のみとする利用者決定 (qa-tradeoff-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | runtimeSchemaGuard の期待 head を 0050 (予定) へ進め、migration が未適用の環境では tradeoff を含む API が schema_unavailable で止まる形へ反映した。 |
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | 本番反映を既存の Migrate → Deploy の順とゲートに乗せ、新しい手順を足さない形へ反映した。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G1, G5

#### 主たる接地根拠: `qa-tradeoff-infrastructure-web-001`

**問**

web のトレードオフ画面のインフラ要件は何か。

**答**

既存の構成 (Cloudflare Worker の api と D1、静的配信の web) を変えない。画面は lazy import のまま初期 JS 予算 (check:js-budget の CI 実測) を超えない。migration を足すので runtimeSchemaGuard の EXPECTED_D1_MIGRATION を同じ変更で進め、本番反映は既存の Migrate → Deploy の手順とゲートに従う。新しい binding や外部サービスは足さない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-tradeoff-001) と決定 qa-tradeoff-decision-001〜009 の範囲に収まる確定内容。利用者が決めていない具体値は除き、同カテゴリの -003 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T15:19:22Z)

#### 裏付け質疑: `qa-tradeoff-infrastructure-web-evidence-001`

**問**

infrastructure 章の裏付けとして、現行のトレードオフ画面まわりについて何を観測したか。

**答**

トレードオフ画面は packages/web/src/AuthenticatedApp.tsx:35 で lazy import され、初期 JS に入らない。web の build は build:bundle → check:js-budget (scripts/check-initial-js-budget.mjs) → strip:manifest の順 (packages/web/package.json:9)。api は Cloudflare Worker で D1 を binding する。runtimeSchemaGuard は D1 の d1_migrations の head を EXPECTED_D1_MIGRATION と照合し、遅れていれば schema_unavailable を返す。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-21T15:19:22Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: /tradeoff を 15-tradeoff.png どおりの画面にする。見出し『トレードオフ』と問い『新しい支出を増やすなら、何を見直しますか？』と説明文、分析期間 (グローバル) のカード、1.新しい支出を設定 (支出名・金額・単発 / 毎月・開始月・メモ)、2.見直し候補の選択 (検索・カテゴリ絞込・選択をすべてクリア、# / カテゴリ・取引先 / 月額 / 年額 / 必要度 / 直近の推移 / 損益・メモ の表と件数表示)、3.推奨の組み合わせ (内容・年間削減額・充足度・実行のしやすさ・リスクの表と、選択中の組み合わせの理由・関連ページへのリンク)、計算例 (毎月と単発)、右側の試算結果 (新しい支出・見直しによる削減額・年間の差額と警告・防衛ラインへの影響・計算の前提)、下部の選択中バー (件数・年間削減額・年間差額・選択をクリア・この条件で試算) を、既存のデザイントークン・共通 Button・PageShell の上に組む。読込・空・失敗の各状態を持つ。
- **G5**: 試算条件と候補ごとの上書きを安全に記録する。『この条件で試算』を押すたびに条件 (支出名・金額・単発 / 毎月・開始月・メモ・選んだ候補・差額) を既存 tradeoff_plans へ履歴として追加し、画面は最新の 1 件を復元する。保存一覧と翌月の突合は画面から外すが、既存の行と突合の関数は消さない。列と表は追加のみの migration で足し、入力は zod で検証し文字数に上限を設け、利用者ごとに分離する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O1 | トレードオフ画面が画像の全構成要素を描画する。 | DOM テストで、見出しと問い・分析期間カード・1.新しい支出の 5 入力・2.候補表の 8 列と検索とカテゴリ絞込と全クリア・3.推奨の表と理由とリンク・計算例 2 種・右側の試算結果と防衛ラインへの影響と計算の前提・下部の選択中バーが描画され、読込・空・失敗の状態テストが緑である。 |
| O5 | 試算条件と上書きの記録が追加のみで安全に行われる。 | migration が CREATE TABLE / ALTER TABLE ADD COLUMN だけで、api テストで zod の上限・認証・利用者分離・最新 1 件の復元を検査し、既存の tradeoff_plans の行と tradeoffReview の契約テストが緑のままである。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: Tradeoff.tsx を pages/tradeoff/ 配下へ分割し、見出しと問い・分析期間カード・1.新しい支出・2.見直し候補・3.推奨の組み合わせと計算例・右側の試算結果・下部の選択中バーの構成に作り直す。
- **I3**: core に科目×取引先の候補集計・推移・必要度・自動の理由を新設し、上書きの新表と保存 API を足す。
- **I5**: tradeoff_plans に開始月・メモ列を足し、POST で履歴を追加、GET で最新 1 件を返して画面で復元する。保存一覧と突合の表示を外す。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

既存の構成を変えずに機能を足す原則を適用した。新しい binding や外部サービスは足さず、migration 1 本と EXPECTED_D1_MIGRATION の更新だけでデプロイ手順に乗せる。画面は lazy import のまま初期 JS 予算の外に置く。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T15:19:22Z)

- `ref-system-design-knowledge/references/resource-map.yaml` (本章へ引く card は 0 件。未着手ではなく、上の適用記述で0 件である理由を述べた上での確定である)

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-workers-limits | 2026-09-05 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers/platform/limits/ | 2026-09-21T15:23:17Z | 2026-09-21T15:23:17Z |
