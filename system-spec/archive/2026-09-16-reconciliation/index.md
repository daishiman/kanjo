---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: 照合画面を、帳簿 (freee の仕訳) と口座 (MoneyForward の取引) の差異を『どこから解消するか』判断し、一件ずつ確認・照合・別取引として処理・除外・元に戻すまでを 1 画面で完結できる作業場にする。月次クローズで利用者が差異の総量 (事業支出・MF未計上・要確認候補・解消率) を掴み、対応キューから優先度の高い差異を選び、判定根拠 (一致度と一致の理由) を見て迷わず決め、誤操作をすぐ戻せる状態にし、照合の完了が月次クローズ進捗に反映されるようにする。
- **ゴール (U3)**: G1=/analysis/reconciliation を 04-reconciliation.png どおりの照合画面にする。問いの見出しと説明文・5 タブ・KPI 4 枚 (事業支出 / MF未計上の件数と金額 / 要確認一致候補 / 解消済みの割合ドーナツ)・左の絞り込み (データソース・ステータス・対象年月・リセット) と対応キュー (要確認の候補 / MF未計上 / 金額の差異 / 日付の近い取引)・中央の照合候補一覧 (検索・一括チェック・ステータス・日付・MF の取引内容・金額・freee の候補・差額・一致度・ページ送りと件数切替)・右の取引の詳細パネル (MF の取引 / freee の候補 / 一致の理由 / 一致度バー / 同じ取引として照合 / 別の取引として処理 / 仕分けを開く / 直前の操作と元に戻す)・下段の 2 表 (MFにありfreeeにない支出 / 自動一致できなかった候補 と各導線)・下部の選択中バー (選択をクリア / 選択した取引を照合) を、トークン・共通 Button・PageShell の上に組む。読込・空・失敗・部分成功・確認の各状態も持つ。, G2=照合に必要な判定を packages/core の純関数に置く。一致度 (金額一致 50 + 日付差 同日30/1日20/2日10/3日5 + 内容類似×20 の 100 点満点)・一致の理由・ステータス (未処理/要確認/照合済み/除外)・対応キュー 4 分類 (要確認の候補 / MF未計上 / 金額の差異=±3日かつ内容類似で金額不一致 / 日付の近い取引=金額一致で日付差1〜3日)・KPI を 1 か所で算出し、保存済みの判断と除外を反映する。buildExpenseProjection・ハブのバッジ・総収支と件数を一致させ、規則を docs に書きテストで固定する。, G3=照合操作を保存し元に戻せるようにする。既存の duplicate_verdicts と freee 除外表を再利用し、照合画面用の API (一覧・KPI・キューを返す GET と、照合 / 別取引 / 除外 / 一括照合の POST)、verdict 取消 API、MF 側除外、照合操作の履歴表 (直前の操作と元に戻すに使う) を migration 付きで追加する。一括は最大 200 件で部分成功を返す。, G4=共通シェルを画像に揃える。サイドバーの文言 (概要/データ取込/現金入力/明細仕分け/サブスク/累計収支/支出分析/決算書/AI分析/予算/トレードオフ/設定/使い方/改善リクエスト) とグループ・件数バッジ (データ取込=要確認の取込件数・明細仕分け=未整理明細数・サブスク=判定待ち候補数・照合=要確認件数)、ページ見出し・パンくず・コマンドパレットのラベル追随、月次クローズ進捗 3/4 (データ取込/仕分け/照合は直近の締め月について自動判定、月次レビューは利用者の完了操作を月単位で D1 に保存し取消可)、ヘッダー (防衛ライン：正常 の表記・未記録 Nか月・最終更新・⌘K 検索・ダウンロード・ヘルプのアイコンボタン・アバター)、フッター (外部送信しない / 税務上の正本は freee / 毎晩バックアップ と 利用規約・プライバシー・データ出典・v1.0) と改善を送るボタン。, G5=画像で使われるアイコンを全て lucide-static 由来の SVG として RouteIcon (または同等の登録表) に追加し、KPI・キュー・ステータス・一致の理由・操作ボタン・ヘッダー・フッター・サイドバーで表示する。絵柄の重複検査テストを維持する。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G3 G4 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G3 G4 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G4 G5 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G3 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G3 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G2 G3 G4 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G4 G5 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G2 G4 G5 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
