---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: 支出分析のマトリックス画面を、『どの月・どのカテゴリに支出が偏っているか』をヒートマップ 1 枚で特定し、偏っているセルを選んでその正体 (含まれる取引・前月比・前年同月比・データの出典) まで降り、該当明細へ移動して手を打つところまでを 1 画面で完結できる発見の場にする。月次クローズの『確認』段階で、利用者が表示モード (全部 / 構成比 / 前年差)・集計の対象 (総合 / 事業 / 家計)・行の分類 (カテゴリ / 取引先) を切り替えながら偏りを探し、偏りが大きい 3 点の示唆を読み、選択中のセルから明細へ一直線に進める状態にする。
- **ゴール (U3)**: G1=/analysis/matrix を 06-matrix.png どおりの画面にする。問いの見出し『どの月・カテゴリに支出が偏っていますか？』と説明文・データの最終更新と再取得・期間タブ (1年 / 2年 / 3年 / 任意 と対象範囲の表示)・3 つの切替 (表示モード=全部 / 構成比 / 前年差、集計の対象=総合 / 事業 / 家計、行の分類=カテゴリ / 取引先)・単位と濃淡凡例 (少ない→多い)・月×カテゴリのヒートマップ表 (行ヘッダ固定・月列は横スクロール・右端に合計と平均の列・下端に合計と平均の行・セル選択の枠)・下部の選択中バー (選択中のセル名と金額・前月比・前年同月比・該当明細を確認)・空状態 (『表示するデータがありません』とデータ取込への導線) を、既存のデザイントークン・共通 Button・PageShell の上に組む。読込・空・失敗の各状態を持つ。, G2=『選択中のセルの詳細』パネルを実装する。セルを選ぶと、カテゴリ×年月の見出しとバッジ (この月のカテゴリ内で最大 などの位置づけ)・支出金額・前月比 (矢印と増減額と増減率)・前年同月比・このセルに含まれる取引の一覧 (日付・取引先・内容・金額・区分)・データの出典 (決済手段と更新日時)・『明細を開く』導線を出し、閉じるで解除できるようにする。, G3=『偏りが大きい 3 点』を core の純関数で算出して表示する。順位・対象 (カテゴリと年月)・金額・前月比・前年同月比・要因の示唆を、月内偏り (その月の平均と標準偏差) と行内偏り (その行の平均と標準偏差) の大きい方に増加ボーナスを足したスコアの降順で 3 件選ぶ。要因の示唆は AI を呼ばず、増減パターン (急増 / 増加 / 継続高水準 / 減少後も高水準 / 前年比のみ増 / その他) を判定して金額・比率・件数を差し込む決定論テンプレートで生成する。選定規則と文テンプレートを docs に明記しテストで固定する。, G4=マトリックスの集計を core の純関数とセル指向の API に置き換える。月×(カテゴリ | 取引先)、総合 / 事業 / 家計、金額 / 構成比 / 前年差、行と列の合計と平均、濃淡の階級 (表示中の全データセルの最小〜最大を 7 階級に等分した表全体共通スケール。合計行・平均行・合計列・平均列は算出から除外)、偏り上位 3 点、セル内訳の取引と出典を 1 か所で算出し、GET /api/matrix をこの形へ拡張したうえで、セル内訳は選択時に取得する。取引先軸は期間合計の上位 20 取引先 + 『その他』1 行にまとめる。前月比・前年同月比は比較対象が表示期間の外にあっても実データがあれば参照する。既存の matrix CSV 出力と総収支・分析ハブ・推移の数値と突き合わせて一致させる。, G5=共通シェルと既存資産を壊さずに載せる。サイドバー・ヘッダー・フッターは既存実装をそのまま使い、表記ゆれ (サイドバーの『マトリクス』を画像の『マトリックス』へ) の統一だけ行う。総収支・推移・診断・分析ハブと機能を重複させず、既存の色の凡例・未記帳月の扱い・期間選択 (usePeriod) を引き継ぐ。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G4 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G4 G5 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G2 G5 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G4 G5 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G4 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G3 G4 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G2 G5 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G3 G4 G5 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
