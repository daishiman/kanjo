---
status: confirmed
category: infrastructure
aggregate: 確定
spec_cells: [infrastructure.web, infrastructure.mobile, infrastructure.tablet, infrastructure.desktop-windows, infrastructure.desktop-linux, infrastructure.desktop-macos]
serves_goals: [G3, G5]
---

# インフラ (infrastructure)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-infrastructure-web-ov-observed-001。資するゴール: G3, G5 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリではストア配布・自動更新の経路と、概況 API との版互換をどう保つかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、本カテゴリではストア配布・自動更新の経路と、概況 API との版互換をどう保つかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、本カテゴリではストア配布・自動更新の経路と、概況 API との版互換をどう保つかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、本カテゴリではストア配布・自動更新の経路と、概況 API との版互換をどう保つかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、本カテゴリではストア配布・自動更新の経路と、概況 API との版互換をどう保つかを決める必要があった。概況は web のレスポンシブ (狭幅で右パネルをドロワー化) で提供し、対象を web のみとする利用者決定 (qa-target-platforms-ov-001 / appr-foundation-overview-001、2026-09-14) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | Google SRE の『変更は小さく、検証してから広げる』を、migration 0040 が CREATE TABLE だけなので deploy.yml の自動判定で apply に分類され、checkpoint → db:migrate:remote → check-d1-migrations.mjs → wrangler deploy → smoke 2回 の既存順序に乗るという観測 (qa-infrastructure-web-ov-observed-001) に照らして確認した。 |
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | SRE のトイル削減を、Worker・cron (0 18 * * * の1本)・R2 の30日保持を変えず、保留と月次レビューのバックアップ追加を BACKUP_SNAPSHOT_SQL の変更だけで済ませるという観測 (qa-infrastructure-web-ov-observed-001、qa-database-web-ov-observed-001) に照らして確認した。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3, G5

#### 主たる接地根拠: `qa-infrastructure-web-ov-observed-001`

**問**

配信・デプロイ・migration 適用・夜間バックアップの構成は何で、概況の作り替えがどの制約に触れるか。

**答**

Worker kanjo-console が静的アセット (../web/dist、SPA) と /api/* を配信し、D1 は DB=kanjo-db、R2 は FILES=kanjo-files、cron は 0 18 * * * (JST 03:00) の1本 (packages/api/wrangler.jsonc:29-31) で nightlyBackup (packages/api/src/index.ts:168-186) が R2 に backups/YYYY-MM-DD.json を30日保持で書く。deploy.yml は CI 成功の push でだけ動き、plan-auto-migration.mjs が pending migration を判定して DROP TABLE / DROP COLUMN / RENAME を含むと blocked にし (.github/scripts/plan-auto-migration.mjs:45-52,72-91)、apply なら checkpoint → db:migrate:remote → check-d1-migrations.mjs → wrangler deploy → smoke 2回の順で進む (deploy.yml:70-86)。migrate.yml は confirm=APPLY と承認 manifest を照合する手動経路である。web の build は初期 JS (entry と static import) の gzip 合計を 110KiB 以下に制限する check-initial-js-budget.mjs (:7) を含む。概況の作り替えは Worker・cron・R2 の構成を変えず、migration 0040 は CREATE TABLE だけなので自動適用の apply 経路に乗る。触れる制約は (1) EXPECTED_D1_MIGRATION を migration と同じ変更で更新しないと deploy 後に /api/* が 503 になること、(2) Layout が全ページで読む未処理件数の取得コードが初期 JS に入るため 110KiB 予算を超えないこと、の2つである。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: Explore サブエージェントが 2026-09-14 に packages/api・packages/core・packages/web・migrations・.github を読み、file:line を付けて報告した観測事実。報告受領後に date -u で実測した時刻を answered_at (上限値) とした。 / 回答時刻: 2026-09-14T11:54:38Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: 月次クローズ4ステップをデータから判定する。「月次レビュー完了」と「後で確認」は D1 に保存し、バックアップと復元でも保つ。
- **G5**: 読込・空・エラー状態、WCAG 2.2 AA、レスポンシブ (右パネルのドロワー化)、外部送信なし・認証必須を維持する。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | snooze と月次レビュー完了がバックアップ→復元の往復で保たれる。 | API テストが snooze と月次レビューを書き、バックアップを取り、全消去後に復元して行が一致することを assert する。 |
| O4 | 画像正本の表示順と広幅レイアウトを保ち、概況の描画検査が8幅で通る。 | `system-spec/ui-ux.md#表示順の正本` の順序、広幅の Review 3列・比較/内訳2列、横はみ出しなしを scripts/check-financial-visuals.mjs が観測し、Overview エントリを8幅で描画して exit 0 になる。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I9**: 本文のデータ最終更新と出典リンク

### 本章に効く確定意思決定

- **dec-review-state-storage**: 『後で確認』(保留) と『月次レビュー完了』の状態をどこに保存するか
  - 採択: D1 に2テーブル (review_snoozes・monthly_close_reviews) を追加し、夜間バックアップと復元の対象にする (`d1`)
  - 目的適合: G3 の『D1 に保存し、バックアップと復元でも保つ』に直接合う。端末やブラウザを替えても未処理件数と月次クローズの判定が変わらない

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

本章に直接効く card は Clean Code の『Explicit effects』だけで、migration の適用・バックアップ・配信という副作用を既存のパイプライン (deploy.yml の自動 migration 判定、cron 1本の nightlyBackup) の外へ増やさないことに適用した (qa-infrastructure-web-ov-observed-001)。新しい cron・R2 バケット・Worker は作らない。触れる制約は EXPECTED_D1_MIGRATION の同時更新 (怠ると 503) と初期 JS 110KiB 予算の2つである。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 記録時刻: 2026-09-14T12:20:03Z)

- `ref-system-design-knowledge/references/resource-map.yaml` (本章へ引く card は 0 件。未着手ではなく、上の適用記述で0 件である理由を述べた上での確定である)

## 最新ドキュメント出典

- (このカテゴリに割り当てた取得済みドキュメントなし。全体出典は index.md 参照)
