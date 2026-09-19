---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: 家計収支画面を、『家計の総収入・総支出・純収支は、どう変わりましたか？』という問いに 1 画面で答え切る場にする。利用者が期間 (1年 / 2年 / 3年 / 任意) を選ぶと、家計全体の総収入・総支出・純収支とその前年差を最初に掴み、月別の推移で『いつ』動いたかを、事業と個人の内訳・生活費カテゴリ・名義別の収入で『どこが』動いたかを確かめ、振替を二重に数えていないことを納得したうえで、選んだ月やカテゴリの明細まで一直線に降りて手を打てる状態にする。家計全体の数字は総収支画面の『総合』と必ず一致し、事業と個人の和が家計全体に重複なく閉じることを、画面と集計の両方で保証する。
- **ゴール (U3)**: G1=/household を 10-household.png どおりの画面にする。問いの見出し、出典カード、期間タブ、KPI、月別推移、事業と個人の内訳、生活費カテゴリ、名義別収入、振替除外、名義ラベル、前年比較、下部バーを既存トークンと共通部品で構成する。期間は usePeriod / localStorage、URL は seg / month / cat だけを正本にし、選択期間の集計対象台帳行が 0 件なら空とする (振替のみ・除外行のみも空)。, G2=家計集計を totalCashflowLedger を正本とする core 純関数 1 か所に集め、家計全体 = 事業 + 個人、総収支画面との一致、前年比較の欠損規則をテストで固定する。, G3=カテゴリ詳細は current (期間合計)、monthTotal (選択月の全件合計)、transactions (最大 5 件のプレビュー) を別の意味として返し、カテゴリの『すべて見る』は月とカテゴリで絞った明細へ遷移する。, G4=内部名義値を変えず owner_labels と GET / PUT /api/settings/owner-labels で表示名を一元化し、家計・設定・明細へ反映する。, G5=選択月の除外振替を家計カード内に全件 (抜粋なし) 表示し、循環する『すべて見る』導線を置かない。振替は総収入・総支出へ含めず、対にならない行は『相手不明』と示す。既知の逸脱・未実施・一部適合は受入 PASS に数えない。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G2 G4 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G4 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G3 G4 G5 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G4 G5 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G2 G4 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G2 G3 G5 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G3 G4 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G1 G2 G5 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
