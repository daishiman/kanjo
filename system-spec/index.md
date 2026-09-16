---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: 家計と事業を合わせた本当の収支を、重複と除外の判断ごと 1 画面で確かめて月次クローズの『照合→総収支』を終えられるようにする。利用者が総収支を開いた時点で、期間の総収入・総支出・純収支と前期比、月ごとの推移が総合/事業/家計で読め、その数字に効いている重複候補・freee 除外・要確認を同じ画面の判定作業で片付け、誤った判断はその画面を開いてから行った操作を新しい順に遡って元に戻せる状態にする。
- **ゴール (U3)**: G1=/analysis/total-cashflow を 05-total-cashflow.png どおりの構成にする。問いの見出しと説明・データの見方リンク・5 タブ・総合/事業/家計のセグメント・選択中期間と前期の表示・KPI 3 枚 (総収入/総支出/純収支と前期比の額と率)・月次の収入/支出の棒と純収支の折れ線チャート・重複除外の判定作業・freee から除外した明細・自動一致の候補 (日付と金額の一致で自動に寄せた組)・進捗の通知・下部の選択バーを、共通シェル・トークン・Button の上に組む。既存の 9 列月次表は『月次の内訳を表示』で開閉できる検算根拠として残す。, G2=重複・除外の判定作業を 3 ペインにする。左に 重複候補/freee除外/要確認 の件数付きナビ、中央にソース/判定フィルタ・検索・チェック選択付きの明細表、右に選択明細の MF 明細と freee 対応候補の並列詳細・一致度・『同じ取引/別の取引/集計から除外』・直前の操作と元に戻す を置き、複数選択と下部の選択バーで一括判定できるようにする。, G3=総収支に必要な集計を packages/core の純関数と API に置く。総合/事業/家計ごとの期間合計と前期 (前年の同じ期間) 比較、月次系列、判定作業の 3 区分と件数、候補ごとの一致度、自動一致の候補の一覧を、既存の消し込み不変条件 (freee 正本・未判断候補の隔離・same の総額不変・different の独立残余加算) を保ったまま返す。除外した freee 取引が唯一の候補だった要確認の MF 明細は、要確認から出して公私仕分けで数える。, G4=判定と除外の操作を D1 に記録し元に戻せるようにする。freee 除外は理由区分 (振替/内部移動/帳簿のみ/二重登録/その他) とメモに分けて一括設定でき、既存の自由記述理由は失わずに移行する。判定・除外・戻すの操作履歴を残し、画面を開いてから行った操作を新しい順に取り消すと総額が操作前と一致し、同じ取消の再送や古い表示からの取消で意図しない操作を戻さない。再読込後は取り消せない (操作履歴は残る)。判定・除外・操作履歴はバックアップに含め、復元しても戻る。, G5=一致度・判定作業の区分・自動一致の候補の扱いを単純で説明可能な規則として docs に明記しテストで固定する。日付と金額が一致する組は既存どおり自動で freee 正本へ寄せ、一覧は確認用で『同じ取引にする』は same 判定の記録だけとし総額を変えない。共通ヘッダー/フッターの文言 (防衛ライン・毎朝バックアップ等) を画像に揃え、サイドバーは支出分析 > 総収支 の現在地と照合の件数バッジが表示されることを確認する。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G4 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G2 G4 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G2 G5 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G2 G4 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G4 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G3 G4 G5 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G2 G5 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G4 G5 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
