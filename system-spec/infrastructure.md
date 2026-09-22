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
| Web (web) | 確定 | 確定質疑: qa-budget-infrastructure-web-001。資するゴール: G3 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、インフラではスマートフォンのアプリストア配布とプッシュ通知の基盤をどう用意するかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、インフラではタブレットのアプリストア配布の基盤をどう用意するかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、インフラではWindows のインストーラと更新配信の基盤をどう用意するかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、インフラではLinux の配布形式 (パッケージ) と更新配信の基盤をどう用意するかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、インフラではmacOS のインストーラと更新配信の基盤をどう用意するかを決める必要があった。対象を web のみとする利用者決定 (qa-budget-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | 予算画面のインフラでは、予算の保存を 1 期間ぶんの D1 batch 1 回にまとめ、途中で失敗しても前の予算が残る形へ反映した。単独利用のため SLO は定めず、失敗は保存バーの通知と下書きからの再保存で回復させる。 |
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | 予算画面のインフラでは、新しい資源を増やさず既存の Deploy / Migrate の手順 1 本で反映できる形へ反映した。追加のみの migration なので、旧版の Worker が動いている間に新しい表ができても旧画面は影響を受けない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3

#### 主たる接地根拠: `qa-budget-infrastructure-web-001`

**問**

web の予算画面のインフラ要件は何か。

**答**

構成は変えない。既存の Cloudflare Worker と D1 の上に載せ、R2・キュー・新しいバインディング・外部サービスを足さない (qa-budget-decision-003)。無料枠 (Workers の CPU 時間・D1 の読み書き) の範囲で動くよう、予算の保存は行数に上限を置いて D1 の batch でまとめて書き、算出は 1 回の要求で完結させる。追加のみの migration 1 本を既存の Deploy / Migrate の手順で反映する (qa-budget-decision-001)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が正本として指示した画像 design/FINAL-UI/images/14-budget.png と、利用者承認 (appr-foundation-budget-001) の U1-U9、決定 qa-budget-decision-001〜004 から、利用者が決めていない具体値を除いて書き起こした要件。除いた値は同じ章の -002 (agent-inference) に分けた。 / 回答時刻: 2026-09-21T13:35:48Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: 予算を予算対象の 12 か月 (開始月 YYYY-MM) ごとに科目別の年額・計画による調整額・調整の理由で保存する表を D1 に追加のみの migration で設け、同じ期間は上書きし版は持たない。保存済みの行が無い期間を開いたときは既存 budgets の月額 × 12 を初期値として示す (既存行は書き換えない)。GET /api/budget-plans?start=YYYY-MM と PUT /api/budget-plans を設け、PUT は canonicalMutationFence に登録する。診断の予算カバー率と予算の着地見込みなど既存の budgets の読み手は、今月を含む予算対象の年額 ÷ 12 を返す core の関数を経由して同じ値を読む。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | 予算が期間ごとに保存され、既存の読み手が同じ値を読む。 | API 統合テストで、PUT が期間ごとに保存し同じ期間は上書きされ、未認証 401・フェンス違反の拒否・不正値の 400 を確かめる。migration が既存行を 1 行も書き換えないことを検査し、保存行の無い期間で既存月額 × 12 が初期値になること、診断の予算カバー率が新しい表の値から出ることを確かめる。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: 予算対象の期間別の年額表を追加のみの migration で設け、GET / PUT /api/budget-plans と fence 登録を行い、診断の予算カバー率など既存の budgets の読み手を同じ読み出し関数へ寄せる。

### 本章に効く確定意思決定

- **dec-budget-storage-unit**: 予算の保存単位をどうするか (期間を持たない科目別の月額 1 つか、予算対象の 12 か月ごとの年額か)。
  - 採択: 期間別の年額表を追加 (`opt-period-annual-table`)
  - 目的適合: 画像の予算対象 12 か月・年額入力と一致し、既存の月額を初期値に引き継げる。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

Serverless の制約 card (CPU 時間・書込枠) を予算画面に適用した。1 回の保存を 200 行以内の D1 batch に収め、算出は 1 要求の Dataset 読込みの上で完結させて、無料枠の書込 100,000 行 / 日に対して 1 回の操作が数百行に収まる形にした。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T13:35:48Z)

- `ref-system-design-knowledge/references/resource-map.yaml` (本章へ引く card は 0 件。未着手ではなく、上の適用記述で0 件である理由を述べた上での確定である)

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-workers-limits | 2026-09-05 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers/platform/limits/ | 2026-09-21T13:39:51Z | 2026-09-21T13:39:51Z |
