---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: 現金入力画面を、『現金と交通費を、漏れなく記録しますか？』という問いに 1 画面で答え切る場にする。銀行・カードの取込に乗らない現金の支払い・受け取りと交通費を、外出から戻ったその場で入力し、同じ画面で一覧・合計を見て訂正まで済ませる。入力途中の離脱や誤削除で記録が欠けないこと (下書きの自動保存と、論理削除による元に戻す) を通じて、集計・月次クローズ・AI分析の入力である台帳から現金の欠けを無くす。
- **ゴール (U3)**: G1=/cash を 17-cash.png どおりの画面にする。問いの見出しと説明、共通の期間 (1年 / 2年 / 3年 / 任意) と対象期間カード、通常入力 / 交通費入力のタブ、現金明細の入力 (日付・事業/個人・収支・金額・内容・カテゴリ・担当者・メモ 0/200・入力をクリア・現金明細を追加・下書き自動保存の表示)、交通費の入力 (出発駅・到着駅・入替・片道運賃・往復・合計金額・業務の目的・メモ・交通費として追加)、現金明細の一覧 (月送り・キーワード検索・4 種の絞り込み・詳細検索・収入/支出/差額の合計・選択・編集/削除・ページング)、インラインの削除確認と元に戻す、空状態、下部固定の追加バーを描く。, G2=記録が消えない。入力途中の内容はブラウザ内に自動保存して復元でき、削除は論理削除として一覧と集計から外したうえで『元に戻す』で同じ行を復活でき、30 日後に夜間処理で完全に消える。, G3=画面の数字と判定を core の 1 か所から導く。合計・絞り込み・ページング・入力経路・交通費の合計・入力検証を core の純関数に置き、API は JSON に写すだけ、web は描くだけにする。, G4=現金明細の入力と変更を安全に保つ。利用者ごとの分離、入力検証、削除・復元の権限確認、削除済み行を集計へ混ぜない不変条件を API と DB の両方で守る。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G2 G4 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G4 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G2 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G4 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G2 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G2 G3 G4 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G2 G3 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G1 G2 G4 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
