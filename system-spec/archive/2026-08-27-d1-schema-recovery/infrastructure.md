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

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-wrangler-d1-config | 2026-08-13 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers/wrangler/configuration/ | 2026-08-27T03:38:13Z | 2026-08-27T03:38:13Z |
