---
status: confirmed
category: infrastructure
aggregate: 確定
spec_cells: [infrastructure.web, infrastructure.mobile, infrastructure.tablet, infrastructure.desktop-windows, infrastructure.desktop-linux, infrastructure.desktop-macos]
serves_goals: [G1, G2]
---

# インフラ (infrastructure)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-002 |
| モバイル (mobile) | 対象外 | 理由: 配信基盤は Cloudflare Workers の単一経路で、モバイル向けの別基盤を持たない |
| タブレット (tablet) | 対象外 | 理由: 配信基盤は Cloudflare Workers の単一経路で、タブレット向けの別基盤を持たない |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: デスクトップ配布物を持たずブラウザのみで提供するため対象外 |

## 適用された設計知識

- `ref-system-design-knowledge/references/resource-map.yaml` (resource-map 未定義。関連cardを選定・深化してから確定する)

---

### 無料枠運用下での添付物の容量・オペレーション試算

- project candidate: `infrastructure-free-tier-envelope-for-improvement-artifacts` (`deepened`)
- 解決対象: infrastructure 章は resource-map.yaml に read_when 対応するカードが存在せず、設計知識 0 件のまま status: confirmed になっている。確定セル infrastructure×web (qa-002) の判断を支える容量・費用の根拠が章に残らない。

#### 目的

resource-map 未定義の空白を埋め、本仕様が無料枠内に収まることの根拠と、収まらなくなる条件を章へ明示する。

#### 解決する問題

- 保持期間や実行頻度の決定を、実測なしの感覚で下げると保全水準だけが後退する
- 無料枠の上限を超える条件を書き残さないと、超えたことに気づけない
- D1 Time Travel の復元範囲がプラン依存 (Paid 30 日 / Free 7 日) であることを見落とすと、復旧手段の見積もりを誤る

#### 適用条件

- D6 (30 日保持) の妥当性: 月 50 件 × (スクリーンショット約 200KB + 診断情報約 30KB) ≒ 12MB/月。30 日保持で常駐 12MB は R2 Standard 無料枠 10GB-month の約 0.12% (appr-004)
- D7 (日次バックアップ維持) の妥当性: 統合 JSON 30 世代で数十〜百数十MB、無料枠の 1〜2%。Class A は月 1000 回前後で無料枠 1,000,000 回の 0.1% 未満
- D1 の 1 行 / BLOB 上限 2,000,000 bytes が、診断情報の総バイト上限を決める物理的な天井である

#### 非適用条件

- 本番 D1 への migration 適用 (scope_out)。feat-prod-d1-schema-recovery の完了が前提
- 有料プランへの移行を前提とした設計。無料枠前提を崩す判断は別途承認を要する

#### トレードオフ

- 無料枠に収まることを優先して保持期間を短くすると、過去の改善要望を遡れる範囲が狭まる
- 日次バックアップ維持は R2 に 30 世代を常駐させるが、削減額が 0 円のため頻度低下の動機がない

#### 失敗モード

- 投稿件数が試算の 10 倍 (月 500 件) を超えても試算が更新されず、無料枠超過に気づかない
- 設定の存在をもって夜間バックアップが機能していると見なす (qa-019 が否定した誤り)
- Time Travel の 30 日をプラン確認なしに前提とする

#### goalへの寄与

G4 (既存データを一件も失わない) を費用制約の内側で成立させる根拠。G11 (最小保持) の 30 日という数値が費用ではなく方針から選ばれたことを示す。

## 章の注記 (chapter_notes)

> 正本 `spec-state.json` の `chapter_notes` を描く。**利用者の回答ではない。**確定内容 (質疑録) と混ぜて読まないために節を分けてある。

### 今回の feature scope

本章の仕様は確定済みであり、今回の feature `feat-mobile-financial-visualization` では**変更しない**。

- feature scope: 変更対象は ui-ux / frontend のみ (承認: `appr-mobile-scope-narrowing-001`)
- 本章の spec cell state は「確定」のまま維持する。「今回触らない」ことと「仕様が存在しない (対象外)」ことは別軸であり、feature scope を cell state へ書くと D1・認証・Workers の実在する契約が仕様上消え、以後の completeness 評価や dev-graph の要件導出がその前提で走ってしまう。
- 境界維持の検証は ui-ux / frontend 側の制約と受入条件で行う (`qa-mobile-boundaries-001`)。

- 正本へ入れた理由: feature 単位の「今回触らない」を恒久的な spec cell state (確定/対象外) と取り違えた降格が起きたため、意図を state とは別の軸で保持する。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-wrangler-d1-config | 2026-08-28 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers/wrangler/configuration/ | 2026-08-27T03:38:13Z | 2026-08-30T00:00:00Z |
| cloudflare-r2-pricing | 2026-08-07 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/r2/pricing/ | 2026-08-30T00:00:00Z | 2026-08-30T00:00:00Z |
