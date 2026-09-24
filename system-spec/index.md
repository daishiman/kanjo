---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: 改善リクエスト画面を、『画面の文脈を保ったまま、改善を共有しますか？』という問いに 1 画面で答え切る場にする。使っていて困ったことを、そのとき見えていた画面 (個人情報を伏せた画像) と診断情報ごと 1 画面で送り、送った依頼の状態・履歴・関連する依頼を同じ画面で追い、Claude Code / Codex がそのまま着手できる指示文として取り出す。送る前に何が伏せられるかを利用者が確かめられ、送った後も誤って消した依頼を戻せることで、改善の経路から個人情報と記録の欠けを無くす。
- **ゴール (U3)**: G1=/improvement を 20-improvement.png どおりの画面にする。問いの見出しと説明・使い方リンク、共通の期間、作成フォーム (スクリーンショット任意と撮り直し/削除、本文 0/1000、プライバシー確認 2 つ必須、自動マスキングの対象の説明、送信)、一覧 (ID・内容・関連ページの検索、すべて/受付/対応中/完了/再確認の件数タブ、選択、ID・関連ページ・概要・状態・作成日・更新日の表、10 件ずつのページング)、詳細パネル (IMP 番号と状態、本文、添付画像と拡大、マスク済み診断情報、アクティビティ、関連する依頼、状態の変更・再発行・Claude Code 用 / Codex 用のコピー・削除)、空状態、読み込み失敗と再読み込み、画面キャプチャの浮動パネル (キャプチャする・範囲を選択する)、選択中バー、コピー完了トーストを描く。, G2=本文・関連ページ・診断はブラウザで辞書を使わない規則、サーバで辞書を含む core の規則を掛ける。画像は撮影用 DOM 複製で伏字にしてプレビューを表示し、利用者が送信前に確認する。サーバは画像の形式と大きさを検証するが、画像内の情報は再マスクしない。, G3=画面の数字と判定を core の 1 か所から導く。状態の体系と遷移、概要の切り出し、IMP 番号の表示、検索・件数タブ・ページング、関連する依頼、アクティビティの表示、診断情報の表示用要約 (OS・ブラウザ・画面サイズ・利用環境・伏せたセッション ID)、マスク規則を core の純関数に置き、API は JSON に写すだけ、web は描くだけにする。, G4=依頼と添付を安全に保つ。利用者ごとの分離、入力検証 (本文 1000 字・プライバシー確認 2 つ・画像の形式と大きさ)、削除は論理削除で『元に戻す』で戻し 30 日後に夜間処理で本文・画像・履歴を完全消去、使い捨てトークンの再発行、夜間バックアップへ添付を入れない不変条件を API と DB の両方で守る。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G3 G4 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G4 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G2 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G2 G4 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G4 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G3 G4 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G3 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G1 G4 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
