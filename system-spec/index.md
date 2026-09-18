---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: サブスク画面を、『毎月の固定費に重複や見直し候補はありますか？』という問いに 1 画面で答え、見直すべき契約を見つけてその場で決着 (名称の統合・候補の採用 / 除外・見直し候補として確認) まで進められる場にする。利用者が銀行口座・クレジットカード・電子マネーの取引から検出された継続的な支払いを、月額・年換算・カテゴリ・データの出典つきで一覧し、見直し候補の理由を読み、同じサービスの表記ゆれを 1 つにまとめられる状態にする。
- **ゴール (U3)**: G1=/subscriptions を 09-subscriptions.png どおりの画面にする。問いの見出し『毎月の固定費に、重複や見直し候補はありますか？』と説明文、KPI 5 枚 (月額のサブスク合計・年換算の合計・直近 12 か月の支払額・売上比・見直し候補 N 件。月額と年換算は前期間比つき)、データソースのカバー率カード (銀行口座 / クレジットカード / 電子マネーの % と取込済み口座数) と最終更新・再取得、サブスク一覧 (ベンダー名・カテゴリで検索、ステータス絞込、行チェック、列=ベンダー名 / 正規化名 / ソース数 / 最新の金額 / 月額の推定 / 年換算 / カテゴリ / 候補、合計行)、月次のサブスク支出推移 (カテゴリ別の積み上げ棒と凡例)、年換算の比較 (カテゴリ別の月額 / 年換算 / 構成比 / 前期間比と合計行) を、既存のデザイントークン・共通 Button・PageShell・期間タブ (usePeriod) の上に組む。読込・空・失敗の各状態を持つ。ロゴ (サービスのアイコン) 画像は取得も表示もしない。, G2=一覧で選んだサブスクの『サブスクの詳細』パネルを実装する。正規化名・カテゴリ (変更可)・見直し候補バッジ、概要 / 取引履歴 / 関連データのタブ、正規化された名称 (編集可)、マッチした生の取引名 (チェックとソース種別)、月額の推定と年換算、直近の取引 3 件と『すべて見る (N件)』、データソース別件数、『名称を統合』『候補として確認』を出し、閉じるで解除できる。生の取引名を選ぶと画面下部に『N件の取引を選択中』バー (選択チップの解除・選択した N 件を統合・選択を解除) を出す。, G3=『見直し候補』を core の純関数で決定論的に判定し、KPI の件数・一覧の候補バッジ・『サブスク候補の検出理由』カードに同じ結果を出す。理由は AI を呼ばず、同じカテゴリ内の重複 / 金額の急増 / 直近の値上げ / 四半期見直しの期限切れ などの規則を判定し、金額・件数・月数を差し込む定型文で生成する。カードから『候補を採用』『候補から除外』『この候補を詳しく見る』を操作できる。規則と文テンプレートを docs に明記しテストで固定する。, G4=サブスク画面の数値を core の純関数 1 か所で算出し、GET /subscriptions をその形へ拡張する。推定月額 (年額払いは 12 等分) とその合計・年換算・前期間比 (直前の同じ長さの期間の最新月時点との差)、直近 12 か月の支払額、売上比、正規化名→カテゴリの既定辞書と利用者上書き、口座名の手がかりによる 銀行 / カード / 電子マネー の 3 分類とカバー率 (取込済み口座数 / 口座数、期間の口座×月のうち取引がある割合)、カテゴリ別の月次推移と年換算比較、見直し候補を算出する。既存の sourceNeutralSubscriptions・サイドバーのバッジ件数・総収支 / 推移の数値と突き合わせて一致させる。, G5=保存は既存表を再利用して拡張し、画像に無い旧 UI は画像の部品へ吸収して撤去する。名称の統合=既存ベンダーの aliases 追加、未登録候補の採用=sub_vendors 登録・除外=sub_vendor_exclusions、登録済みベンダーの見直し候補への判断 (確認 / 除外) とカテゴリは migration 0043 で足す。登録ベンダーの別名・対象科目の編集、四半期見直し、重複・急増アラート、未登録候補の各機能は失わず、詳細パネル・候補バッジ・検出理由・ステータス絞込へ移す。サイドバー・ヘッダー・フッター・月次クローズ進捗は既存実装をそのまま使う。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G4 G5 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G2 G5 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G2 G3 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G4 G5 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G4 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G3 G4 G5 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G2 G5 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G3 G4 G5 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
