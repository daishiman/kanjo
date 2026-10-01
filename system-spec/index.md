---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: サブスクの名寄せ (統合) を一度決めたら、その結果がサブスク画面の一覧・KPI・月次推移・年換算の比較・詳細パネルと、他画面のサブスク集計まで、1つの正本から一貫して反映されるようにし、利用者が固定費を正しい単位で見直せる状態にする。あわせて、統合・登録・変更・見直し判断を続けて・同時に行っても操作が失われたり失敗で止まったりせず、どの操作が待機中・処理中・完了・失敗かを利用者が把握できるようにする。(5 Whys: 統合しても行が消えない → 同じサービスが複数行に分かれて合計と見直し候補が二重に見える → 統合結果が行の構成と他画面の集計に同じ経路で届いていない → 固定費の実額と見直し判断を信頼できる数字で行えない)
- **ゴール (U3)**: G1=統合した取引名・ベンダーは統合先の1行にまとまり、統合元の行は一覧から消え、KPI・月次推移・年換算の比較・詳細パネル・他画面のサブスク集計が同じ名寄せ結果を示す。, G2=統合・登録・変更・見直し判断を連続・同時に行っても、操作が失われたり「サーバー側で処理に失敗しました」で止まったりせず、各操作の状態 (待機中・処理中・完了・失敗と再試行) を利用者が把握できる。, G3=サブスク画面が添付画像 (デザイン 09-subscriptions) の構成と操作どおりになる (一覧の行チェックと全選択、選択バーからの複数件統合、詳細パネル 概要/取引履歴/関連データ、マッチした生の取引名、検出理由、年換算の比較、カバー率)。, G4=統合と操作の管理が安全である (ログインした利用者だけが、全利用者で共通の共有テナントのデータだけを変更できる、統合を取り消して統合前へ戻せる、古い画面からの上書きを防ぐ、操作の記録に実データを外部へ出さない)。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G1 G2 G4 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G4 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G3 G1 G2 G4 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G4 G2 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G2 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G1 G2 G4 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G3 G2 G1 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G1 G2 G3 G4 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
