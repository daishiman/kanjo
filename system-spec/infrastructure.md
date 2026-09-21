---
status: confirmed
category: infrastructure
aggregate: 確定
spec_cells: [infrastructure.web, infrastructure.mobile, infrastructure.tablet, infrastructure.desktop-windows, infrastructure.desktop-linux, infrastructure.desktop-macos]
serves_goals: [G5]
---

# インフラ (infrastructure)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-ai-infrastructure-web-001。裏付け質疑 (`qa_refs`): `qa-ai-infrastructure-web-evidence-001` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、infrastructure ではApp Store / Google Play の配布と審査、プッシュ通知の基盤を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、infrastructure ではタブレット向けビルドの配布経路と対応 OS 版を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、infrastructure ではMSI / MSIX の配布と自動更新サーバを決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、infrastructure ではdeb / rpm / AppImage のどれで配るかと更新の経路を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、infrastructure ではdmg の配布と Sparkle などの自動更新を決める必要があった。対象を web のみとする利用者決定 (qa-ai-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | 反映の順序を Migrate → Deploy に固定する形へ反映した。migration 0046 は列の追加だけなので、適用後に旧 Worker が動いていても新しい列を読まないだけで壊れない。 |
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | 基盤の変更が D1 の列追加だけであることを、既存の deploy.yml と migrate.yml をそのまま使う形へ反映した。新しい secret・キュー・外部サービスの登録は発生しない。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G5

#### 主たる接地根拠: `qa-ai-infrastructure-web-001`

**問**

AI分析画面のために配信・実行・DB 反映の基盤をどう変えるか。

**答**

基盤は変えない。既存の Cloudflare Worker と D1 のまま、migration 0046 を既存の Migrate の手順とゲートで適用してから Deploy する。アプリから LLM を呼ぶ経路・キュー・外部ストレージは足さない (scope.out)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者承認 (appr-foundation-ai-analysis-001) と決定 qa-ai-decision-001〜008 の範囲に収まる確定内容。利用者が決めていない具体値は除き、同カテゴリの -003 (agent-inference) に分けた。 / 回答時刻: 2026-09-19T12:36:49Z)

#### 裏付け質疑: `qa-ai-infrastructure-web-evidence-001`

**問**

infrastructure 章の裏付けとして、既存の配信と反映の仕組みについて何を観測したか。

**答**

API は Cloudflare Worker (Hono) と D1 で、配信は .github/workflows/deploy.yml、D1 の migration 適用は .github/workflows/migrate.yml が担う。ルートの build は web の build と wrangler deploy --dry-run を行う (package.json:16)。AI 分析はアプリから LLM を呼ばず、外部の Claude Code / Codex がトークンで API を呼ぶ構成である。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測 / 回答時刻: 2026-09-19T12:36:49Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G5**: データの扱いと安全を固める。使用するデータのカードは実データ (対象期間・freee 事業取引の件数・MF 家計明細の件数・科目数・取引先数) を新しい API で返し、AI へは集計値だけを渡す。エージェント用と貼り付けの経路に body の上限を設け、キャンセル済み・期限切れのトークンを拒否する。段階を導くための列 (連番・データ取得時刻・差し戻し時刻と回数・取消時刻) は追加のみの migration で足す。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O5 | データの件数が実データと一致し、外部へ出るのは集計値だけである。 | API テストで、使用するデータの件数が同じ期間の D1 行数と一致し、エージェントへ渡すデータセットに明細行と摘要が含まれず、上限を超える body が 413 で止まることを確かめる。migration は追加のみで既存行の書き換えが 0 件である。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I6**: 使用するデータの件数 API を足し、エージェント経路と貼り付け経路へ body 上限を掛け、追加のみの migration で段階の記録列を足す。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

本章へ引く card は 0 件である。配信構成 (Worker・Workers Assets・D1) と binding を変えない判断を記録する。AI 分析はアプリが LLM を呼ばず、外部のエージェントがトークンで既存の API を呼ぶ構成なので、キュー・外部ストレージ・LLM の鍵を Worker に持たせない。変更は D1 の列追加だけで、既存の Migrate → Deploy の順序で反映できる。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-19T12:38:49Z)

- `ref-system-design-knowledge/references/resource-map.yaml` (本章へ引く card は 0 件。未着手ではなく、上の適用記述で0 件である理由を述べた上での確定である)

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-workers-limits | 2026-09-05 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers/platform/limits/ | 2026-09-19T12:40:44Z | 2026-09-19T12:40:44Z |
