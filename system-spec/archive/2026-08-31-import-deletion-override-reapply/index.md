---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: freee・マネーフォワード側で元データが後から書き換えられても、利用者が『今ある取込データを、どう消して・どう上書きして・どう入れ直すか』を自分で選んで実行でき、かつ一度自分で直した科目・項目・公私区分といった手当てが取込のたびに失われず継続的に再適用されることで、毎回の入力の手間を極限まで下げながら、帳簿を正しい最新状態へ収束させられる状態を保つ。
- **ゴール (U3)**: G1=取込済みデータを、取込単位・期間単位・データ種別単位・全件のいずれの粒度でも、利用者が意図して削除できる状態にする, G2=同じ対象を取り込み直すとき、既存と新規が食い違う箇所を実行前に可視化し、上書き・保持・個別選択を利用者が決められる状態にする, G3=削除と上書きのどちらの経路でも、手動で入れた記録(公私仕分け・分割・現金の記帳・証憑)が意図せず失われず、失う場合は事前に件数で示される状態にする, G4=削除・上書きは不可逆操作であることを踏まえ、実行前の確認・実行後の取り消し・監査可能な記録を備え、誤操作から回復できる状態にする, G5=削除・上書き後も、月次集計・現行指紋(import_active_targets)・取込履歴・残高などの派生状態が実データと矛盾しない状態へ必ず収束する, G6=利用者が一度直した科目・項目・公私区分などの手当てを、同じ取引先・同じ性質の明細へ継続的に再適用し、取込のたびに入力し直す手間をなくす, G7=取込元の変更と利用者の手当てが衝突したとき、前回取込時の原本値を基準に『利用者が変えたのか取込元が変わったのか』を機械的に区別し、既定でどちらを採るかを自動判定する。判定できない箇所だけ利用者へ問う

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G1 G2 G3 G4 G5 G6 G7 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G4 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G2 G3 G4 G6 G7 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G3 G4 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G4 G5 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G1 G2 G4 G5 G6 G7 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G2 G3 G4 G6 G7 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G4 G5 G6 G7 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
