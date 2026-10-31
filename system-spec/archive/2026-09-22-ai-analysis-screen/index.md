---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: AI分析画面を、『AIに分析を依頼し、根拠と版を確認しますか？』という問いに 1 画面で答え切る場にする。利用者が共通の期間 (1年 / 2年 / 3年 / 任意) を選ぶと、AI へ渡すデータの中身 (件数と集計値だけで明細は渡さないこと) を確かめたうえで Claude Code / Codex 用の依頼をワンステップでコピーでき、依頼が今どの段階にあるか (待機中 / 実行中 / 完了 / 失敗 / キャンセル と進捗) を一覧で追い、取り消し・再実行・削除をその場で決着でき、返ってきたレポートを取り込んで要約 → 根拠データ → 改善提案 → 関連リンクの順に読み、版の履歴と 2 つの版の差を確かめてから、仕分け・予算・総収支などの画面で手を打てる状態にする。アプリ自身は LLM を呼ばず、データは利用者が依頼をコピーするまで外へ出ない。
- **ゴール (U3)**: G1=/ai を 12-ai.png どおりの画面にする。問いの見出し『AIに分析を依頼し、根拠と版を確認しますか？』と説明文、共通の期間タブ (1年 / 2年 / 3年 / 任意と範囲の送り)、1.依頼 (期間・補足指示 0/1000 と下書き自動保存・Claude Code 用 / Codex 用のコピー・使用するデータのカード・自動送信しない注記)、2.実行中の表 (ID・ステータス・依頼期間・作成日時・進捗・依頼内容・操作)、3.レポート (一覧の検索とアーカイブ表示・結果の取り込み・詳細のタブと版履歴と版比較)、下部の選択中バーを、既存のデザイントークン・共通 Button・PageShell の上に組む。読込・空・失敗の各状態を持つ。, G2=依頼の段階と進捗を core の純関数 1 か所で記録から導く。発行済みでデータ未取得 = 待機中 0%、データ取得済み = 実行中 50%、形式エラーで差し戻し = 実行中 75%、受信 = 完了 100%、結果なしで期限切れ = 失敗、取り消し = キャンセル。依頼には利用者ごとの連番から T-0001 形式の ID を振る。, G3=依頼の操作を画面で決着できるようにする。キャンセルはトークンを無効にして行を残し、再実行は同じ期間と補足指示で新しい依頼を発行し、削除は結果の無い依頼だけを消す (受信済みは削除不可)。依頼の発行とプロンプトのコピーを 1 操作にする。, G4=結果の取り込みとレポートの読み方を整える。取り込み先は選択中の依頼 (結果待ちが 1 件なら自動選択・無ければ無効)、JSON の構文エラーは行と位置を、契約違反は項目名を日本語で示し、入力は保持する。レポートは 要約 / 根拠データ / 改善提案 / 関連リンク のタブに問い順で振り分け、版履歴は補足指示の 1 行目 (無ければ既定文) を説明にし、2 つの版を並べて比較できる。一覧は名前で検索でき、アーカイブの表示を切り替えられる。, G5=データの扱いと安全を固める。使用するデータのカードは実データ (対象期間・freee 事業取引の件数・MF 家計明細の件数・科目数・取引先数) を新しい API で返し、AI へは集計値だけを渡す。エージェント用と貼り付けの経路に body の上限を設け、キャンセル済み・期限切れのトークンを拒否する。段階を導くための列 (連番・データ取得時刻・差し戻し時刻と回数・取消時刻) は追加のみの migration で足す。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G2 G5 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G3 G5 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G3 G4 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G4 G5 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G5 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
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
