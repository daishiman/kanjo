---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: 個人事業主として事業と家計が一体になっている実態に対し、freee(事業帳簿)とMoney Forward(家計)へ分かれて記録された収入・支出を、二重計上を明細単位で消し込んだうえで1つの一覧表へ束ね、月ごとの『トータルの収入・支出・収支(プラスマイナス)』と費用の推移を、消し込んだ根拠ごと確認できる状態を保つ。
- **ゴール (U3)**: G1=月ごとのトータル収入・トータル支出・トータル収支(プラスマイナス)を、事業と家計を合算した1つの一覧表として確認できる状態にする, G2=Money Forward の日付と freee の発生日が一致し金額も一致する支出は『事業で使う費用』として freee を正に事業側へ一度だけ計上し、それ以外の支出は家計側へ計上して、二重計上のない支出合計を出す状態にする, G3=事業側へ寄せた金額と件数を一覧表の中に明示し、合計が『事業費(freee正) + 家計費(MF残余)』として利用者の手で検算できる状態にする, G4=金額または発生日が一致せず自動で事業費へ寄せられなかった重複候補を『要確認』として理由付きで列挙し、利用者が一度『同じ/違う』を判断すれば、次回以降の取込でその判断が再適用される状態にする, G5=トータル支出の推移(増加/減少/横ばい/判定不可)を、既存の trend.ts と同じ統計基準(Mann-Kendall / Theil-Sen)で判定し、費用が増えているのか減っているのかを示す状態にする, G6=合算後も事業側・家計側の内訳を保持し、トータルの増減がどちらの側のどの科目で起きているかまで辿れる状態にする, G7=期間を切り替えても、合算・消し込み・トレンド判定が同じ規則で再計算され、期間ごとに矛盾した数字が出ない状態にする

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G2 G4 G7 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G1 G7 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G3 G4 G6 G7 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G2 G3 G4 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G1 G7 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G1 G2 G3 G5 G6 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G4 G5 G6 G7 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G4 G7 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
