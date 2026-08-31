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
| cloudflare-wrangler-d1-config | 2026-08-13 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers/wrangler/configuration/ | 2026-08-27T03:38:13Z | 2026-08-27T03:38:13Z |
