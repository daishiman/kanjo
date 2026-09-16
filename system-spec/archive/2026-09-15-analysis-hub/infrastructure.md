---
status: confirmed
category: infrastructure
aggregate: 確定
spec_cells: [infrastructure.web, infrastructure.mobile, infrastructure.tablet, infrastructure.desktop-windows, infrastructure.desktop-linux, infrastructure.desktop-macos]
serves_goals: [G3]
---

# インフラ (infrastructure)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-infrastructure-web-ah-observed-001。裏付け質疑 (`qa_refs`): `qa-frontend-web-ah-decision-003` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G3 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリではストア配信とアプリ更新の経路を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS/Android)を提供していたなら、本カテゴリではストア配信とアプリ更新の経路を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、本カテゴリではストア配信とアプリ更新の経路を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、本カテゴリではストア配信とアプリ更新の経路を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、本カテゴリではストア配信とアプリ更新の経路を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-ah-001 / appr-foundation-analysis-hub-001、2026-09-14) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | Google SRE の容量計画を、全画面でハブ API を呼ぶ構成の D1 読取り量に反映した。1 リクエストの読取り本数を D1 の上限 (Free 50 / Paid 1000) に対し既存 /total-cashflow と同程度に保つ。TanStack Query の staleTime とクエリ共有で、画面遷移ごとの再取得を抑える。 |
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | Google SRE の『運用対象を増やさない』を、Worker・binding・cron・デプロイ経路を変えず、既存 Worker に GET ルートを 1 本足すだけにする確定内容に反映した。新しい監視対象や運用手順は発生しない。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3

#### 主たる接地根拠: `qa-infrastructure-web-ah-observed-001`

**問**

ハブの配信とインフラ構成は現行どうなっていて、変更は要るか。

**答**

packages/api/wrangler.jsonc の Worker kanjo-console が SPA を Workers Assets (binding ASSETS) で配信し、D1 (DB)・R2 (FILES)・cron (0 18 * * * の夜間処理) を持つ。GitHub Actions は ci.yml (lint・typecheck・test:aux・audit・web/core テスト・api テスト・build 等)・deploy.yml・migrate.yml。ハブは既存 Worker に GET ルートを 1 本足し SPA に画面を 1 つ足すだけで、binding・cron・migration・デプロイ経路の変更は無い。ハブ API は 1 リクエストで loadDataset と freee 系 3 テーブルを読むため、既存の /total-cashflow と同程度の D1 読み取りになる (d1-limits.ts の制限内)。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-14 にリポジトリ (HEAD 2162fd2) の該当ファイルを読んで確認した観測事実。answered_at は確認直後に date -u で実測した時刻。 対象: packages/api/wrangler.jsonc, .github/workflows/{ci,deploy,migrate}.yml, packages/api/src/d1-limits.ts。 / 回答時刻: 2026-09-14T11:38:26Z)

#### 裏付け質疑: `qa-frontend-web-ah-decision-003`

**問**

サイドバーの件数バッジのためにハブ API を全画面で使う。既存方針『表示していないタブの API は呼ばない』との関係と、データ更新時の扱いをどうするか。選択肢: (A) Layout とハブで同じクエリを共有。queryKey ['analysis-hub', 期間 key] を共有して 1 回の取得で両方をまかなう。『呼ばない』の対象は 5 タブ個別 API に限り、ハブ API は例外として docs に明記する。総収支の判定・除外や取込の更新後はこのキーを無効化し、staleTime で画面遷移ごとの再取得 (D1 読み取り) を抑える (推奨) / (B) バッジは支出分析内だけ。

**答**

(A) Layout とハブで同じクエリを共有 を選択した。サイドバー (components/Layout.tsx) とハブ画面は同一の queryKey ['analysis-hub', 期間 key] で GET /api/analysis/hub を共有し、TanStack Query のキャッシュで 1 回の取得を両方に使う。C3『表示していないタブの API は呼ばない』の対象は 5 タブ個別の API (/business-spend・/total-cashflow・/matrix・/trends・/diagnosis) に限り、ハブ API はその例外として docs/ui-decisions.md に明記する。総収支の判定 (POST /total-cashflow/verdicts)・freee 除外・取込などハブの件数を変える更新が成功したら invalidateQueries({ queryKey: ['analysis-hub'] }) で前方一致の無効化をする。staleTime を設けて、画面遷移のたびに loadDataset と freee 系 3 テーブルの D1 読み取りが走らないようにする。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-14 に AskUserQuestion で推奨案を選択した (完成度評価 FAIL の差し戻しを受けた再質問)。answered_at は回答直後に date -u で実測した時刻で、選択時刻の上限値。 / 回答時刻: 2026-09-14T11:57:13Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: ハブに必要な集計を packages/core の純関数と、1 回で返す集約 API (GET /analysis/hub) に置く。期間の収支サマリーと前 12 か月比、5 視点それぞれの現在の状態 (照合の要確認件数・総収支の重複候補件数・マトリクスの正常判定・推移の支出前 12 か月比・診断の改善余地) と優先度を返し、ハブ表示中に 5 タブ分の既存 API を呼ばない。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | core に analysisHub(dataset) 相当の純関数を置き、API に GET /analysis/hub を足す。 | core 単体テストが期間合計・前 12 か月比 (前期間データ無しは null)・5 視点の状態・優先度・改善余地を固定データで検証し、API 統合テストが認証付きで 200 と期間メタを返し、ハブ表示中の DOM テストで既存 5 API への呼出しが 0 件である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: 期間の収支サマリーに総収入・総支出・純収支と前 12 か月比 (増減率と前期間の金額) を出し、純収支の説明パネルを右に置く。前期間データが無い場合は比較を『比較データなし』と表示する。
- **I4**: core にハブ集計関数を置き、GET /analysis/hub が期間メタ・サマリー・5 視点の状態・優先度を返す。前期間の計算は core へ移し AI 側もそれを使う。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

本章へ引く card は 0 件である。配信構成 (Worker kanjo-console・Workers Assets・D1・R2・cron) と binding を変えないサイクルで、infrastructure 固有に適用すべき設計知識が無いことを確認した上での確定である。本章に効く制約は D1 の上限 (Free 50 / Paid 1000 クエリ/invocation、出典 cloudflare-d1-limits) だけで、ハブ API の 1 リクエストの読取り本数を既存 /total-cashflow と同程度に保つことで満たす。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-14T11:57:54Z)

- `ref-system-design-knowledge/references/resource-map.yaml` (本章へ引く card は 0 件。未着手ではなく、上の適用記述で0 件である理由を述べた上での確定である)

## 最新ドキュメント出典

- (このカテゴリに割り当てた取得済みドキュメントなし。全体出典は index.md 参照)
