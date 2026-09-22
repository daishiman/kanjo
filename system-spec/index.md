---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: データ取込画面を、『複数の明細ファイルを、安全に取り込みますか？』という問いに 1 画面で答え切る場にする。利用者が freee (事業) と マネーフォワード (家計) の CSV / Excel / テキスト明細を複数まとめて選ぶと、確定する前にファイルごとの取込元・対象期間・大きさ・重複・検証の結果を一覧で確かめ、取り込み予定の明細数・影響する取込元・重複の可能性・サブスク候補の要約を見てから、取り込めるファイルだけをまとめて確定でき、結果 (成功 / 失敗 / 重複の可能性 / サブスク候補) からそのまま次の画面へ進め、過去の取込を 1 回ごとに振り返って原本の取得・再取込・取り消しをその場で決着できる状態にする。誤った取込や二重取込で台帳を壊さないこと、取り込んだデータを外部へ送らないことを守る。
- **ゴール (U3)**: G1=/import を 16-import.png どおりの画面にする。問いの見出し『複数の明細ファイルを、安全に取り込みますか？』と説明文、共通の期間タブ、対象期間 (グローバル) のカード、3 段のステッパー (ファイル選択 / 内容確認 / 取込結果)、1.ファイルを選択 (ドラッグ&ドロップと選択ボタン、対応形式の説明、対応サービス (マネーフォワード・freee) の取得方法の案内、詳細設定の強制再取込と前回データを残す)、2.取込ファイル一覧の表、3.取込内容の確認の要約、4.取込結果の 4 枚のカード、5.取込履歴の表と履歴の詳細ペイン、下部の選択件数バーを、既存のデザイントークン・共通 Button・PageShell の上に組む。読込・空・失敗の各状態を持つ。, G2=確定の前に検査する 2 段階の取込にする。選んだファイルを一度だけアップロードしてサーバに期限付き (24 時間) で仮置きし、ファイルごとに取込元・対象期間・明細数・重複 (取込済みと同一の内容 / 重複の可能性)・検証 (問題なし / 警告あり / エラー) を返す。確定は検査 ID を指定するだけでファイルを再送せず、エラーのファイルは確定から自動で外す。未確定の仮置きは期限後に夜間保守で消す。, G3=ファイルの状態・検証の段階・取り込めるか否か・要約の数え方・取込 1 回の結果 (成功 / 一部成功 / 失敗) を core の純関数 1 か所で導き、api と web はその結果を読むだけにする。, G4=『前回データを残す』を画像の意味 (同一期間の既存明細を残し、まだ無い行だけ追加する。同一の行は重複スキップとして数える) に改め、既定をオンにする。オフのときは従来どおり月単位で入れ替える。強制再取込は同じ内容のファイルでも再適用する。, G5=取込履歴を 1 回の取込ごとの 1 行にまとめ、詳細ペインで取込日時・取込元・対象期間・ファイル数・取込明細数・結果とこの取込による影響 (新規追加・重複スキップ・サブスク候補) を示し、原本のダウンロード・再取込・取り消し (30 日以内は元に戻せる) を決着できるようにする。一括削除は取り消し済み・失敗の履歴の記録を片づけるだけで明細は消さない。, G6=取込の入口を守る。検査・確定・原本取得の経路に body の大きさの上限 (読み込む前に判定)・ファイル数と合計サイズの上限・取込専用のレート制限・同一オリジンの検査を置き、ファイル名や明細の文字列は HTML として解釈せずに描画する。取り込んだデータは外部へ送らない。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G1 G2 G3 G4 G5 G6 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G1 G2 G3 G4 G5 G6 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G2 G3 G4 G5 G6 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G1 G2 G3 G4 G5 G6 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G1 G2 G3 G4 G5 G6 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G1 G2 G3 G4 G5 G6 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G2 G3 G4 G5 G6 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G1 G2 G3 G4 G5 G6 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
