---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: 設定画面を、『集計ルールと復元設定を、安全に管理しますか？』という問いに 1 画面で答え切る場にする。利用者は左の節ナビ (集計ルール・名義・統計・現金上書き・データ・バックアップ、続けてアカウント・その他の管理) で目的の節へ移り、集計ルール (勘定科目と取引先の表記ゆれを 1 つの一覧で正規化後のカテゴリへまとめる) を行ごとに編集・並べ替え・一括削除し、右の『この設定の説明』でそのルールが何に影響し、いつ誰が変えたかを確かめて直前の保存値へ戻せる。名義の表示名・統計の最小月数・現金上書き (空欄と 0 円を区別) を同じ下書きで編集し、下部の保存バーで未保存の件数を見て 1 回で保存する。設定だけを JSON で書き出して別の日に復元でき、毎晩 2:00 の自動バックアップを状態・メモ付きで一覧し、現在の設定と比べてから戻せる。設定の変更で集計・分析・レポートの前提が黙って壊れないこと、戻せない操作が 0 件であることを本質とする。
- **ゴール (U3)**: G1=/settings を 18-settings.png どおりの画面にする。パンくず『管理 / 設定』、期間タブ、見出し『設定』と問い『集計ルールと復元設定を、安全に管理しますか？』と説明文、左の節ナビ (集計ルール・名義・統計・現金上書き・データ・バックアップ、続けてアカウント・その他の管理)、集計ルールの表 (チェックボックス・並べ替えハンドル・元の表記・正規化後のカテゴリ select・削除・+ルールを追加)、右の『この設定の説明』(元の表記・正規化後のカテゴリ・影響するもの・最終更新と更新者・このルールを元に戻す・設定のヒント)、名義・統計・現金上書き・データ (4 種の出力)・復元・バックアップの各節、下部の保存バー (未保存 N 項目・変更をリセット・設定を保存) を描く。375px 幅でも崩れない。, G2=設定の意味を core の 1 か所で決める。集計ルールは種別 (勘定科目 / 取引先) を持つ 1 つの一覧で、勘定科目は従来どおり取込時に、取引先は集計時に 手動編集 > 仕分けルール > 集計ルール(取引先) > 自動分類 の順で適用し、照合は NFKC・大小文字を揃えた完全一致、同じ元表記は並び順で優先する。無効の行は効かない。現金上書きは支払い・受け取りそれぞれ空欄=上書きしない / 0=0 円で上書き を区別し、適用範囲 (全期間 / 月指定) で core の現金集計に実際に効かせる。名義 4 つの表示名と統計の最小月数 (既定 6、範囲 3〜24) を同じ core の規則で検証する。, G3=設定を安全に保存する。全節の編集を 1 つの下書きに集め、未保存の件数を数え、localStorage へ自動保存・復元し、リセットと離脱の前に確認する。保存は baseSavedAt つきの 1 回の PUT で、他所の更新と競合したら 409 で上書きを防ぐ。設定の変更は追記のみの変更履歴表に 変更前・変更後・更新者・日時 を残し、右パネルの最終更新・更新者と『このルールを元に戻す』(直前の保存値を下書きへ戻す) はそこから導く。復元や移行で入った値の更新者は『システム』とする。, G4=設定を持ち出し・戻せるようにする。設定のエクスポートは集計ルール・名義・統計・現金上書きだけを版番号つき JSON で出し、復元は同じ形だけを受ける (厳密な形の検証・サイズ上限・差分プレビューと確認・復元直前に現在の設定を自動退避)。取引は消えない。マトリクス CSV・取引 CSV・レポート HTML は選択中の期間で出す。自動バックアップは毎日 JST 2:00 に実行し、各回に 状態 (成功 / 失敗)・メモ・設定部分の要約 を持たせて失敗も一覧に出し、『比較』でその日の設定と現在の設定の差分を見てから『復元』できる。, G5=既存のデータと安全性を壊さない。migration は追加のみで既存行の書き換えは 0 件、既存の設定値は初回に同じ意味で引き継ぐ。設定系の変更 API は認証・パスワード変更強制・スキーマ確認・canonicalMutationFence の内側に置き、公開向けの入力検証 (詳細を外に出さない) と本文サイズ上限を掛ける。外部送信は 0 件で、画像に無い既存の設定機能 (パスワード変更・利用者管理・名義割当・仕分けルール・科目候補・手動編集・ベンダー記憶・未記帳月・HTML 版からの初期移行) は 1 つも消さない。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G2 G3 G5 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G3 G5 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G3 G4 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G4 G5 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G4 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G2 G3 G4 G5 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G3 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G3 G4 G5 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
