---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: 支出分析の入口を、5 つの分析 (照合・総収支・マトリクス・推移・診断) のどこから見ればよいかを 1 画面で判断できるハブにする。利用者が支出分析を開いた時点で、期間の収支の結論と、各分析の要確認件数・変化・改善余地と優先度を見比べ、課題の発見から改善行動まで決まった読み順 (差異を消す→全体を掴む→偏りを見る→変化を追う→行動を決める) で迷わず進める状態にする。
- **ゴール (U3)**: G1=/analysis を 03-analysis-hub.png どおりのハブ画面にする。短い問いの見出し・URL コピー・5 タブ・期間の収支サマリー (総収入/総支出/純収支と前 12 か月比、総収支の説明パネル)・分析ルート一覧 (# / 分析の視点 / 目的 / 現在の状態 / 要確認の優先度 / 次の操作)・右の選択中の分析パネル (わかること / 主なデータソース / 対象外のデータ / 開く)・分析の読み順 5 ステップ・下部の選択中分析バーを、共通シェル・トークン・Button の上に組む。, G2=選択中の分析を URL (?focus=<tab id>) で保持し、URL コピー・再読込・戻る操作でも同じ分析が選ばれた状態を再現する。既存の /analysis/:tab 詳細と旧 URL の転送は壊さない。, G3=ハブに必要な集計を packages/core の純関数と、1 回で返す集約 API (GET /analysis/hub) に置く。期間の収支サマリーと前 12 か月比、5 視点それぞれの現在の状態 (照合の要確認件数・総収支の重複候補件数・マトリクスの正常判定・推移の支出前 12 か月比・診断の改善余地) と優先度を返し、ハブ表示中に 5 タブ分の既存 API を呼ばない。, G4=優先度・マトリクスの正常判定・改善余地を単純で説明可能な規則として定義し、規則を docs に明記してテストで固定する。優先度は照合と総収支が要確認 1 件以上なら高・0 件なら中、他の 3 視点は中。マトリクスは未記録月 0 なら正常。改善余地は tradeoffCandidates の月額合計 × 12 の年額。, G5=支出分析まわりの文言を画像に揃える。5 タブ名を 照合/総収支/マトリクス/推移/診断 の短縮形にし、サイドバーの支出分析の子行に要確認件数バッジを付ける。他画面のサイドバー文言と月次クローズ進捗の形は対象外とする。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G3 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G3 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G2 G5 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G2 G3 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G3 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G3 G4 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G2 G5 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G4 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
