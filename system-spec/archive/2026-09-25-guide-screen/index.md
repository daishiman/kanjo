---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: 使い方画面を、『この数字を、どう読み・どこへ戻ればよいですか？』という問いに 1 画面で答え切る場にする。月次の流れ (取込む→整える→確認→計画) の中で今見ている数字が何を含み何を除くか・どの期間の・どこから来た値かを、選択中の期間の実データで示し、つまずいたら該当の元画面へ 1 クリックで戻れるようにする。数字の読み違い (振替の二重計上・家計と事業の混同・信頼度や防衛ラインの誤解) による判断ミスと、迷って作業が止まることを無くす。
- **ゴール (U3)**: G1=/guide を 19-guide.png どおりの画面にする。問いの見出しと説明、共通の期間と前後移動、4 ステップ (取込む・整える・確認・計画) と各『元画面を開く』、使い方ガイド (左の目次 6 項目＋用語と目安、月次の流れステッパー、総収支の読み方 = 総収入 − 総支出 = 純収支 を選択期間の実データで、含まれるもの・振替は除外・freee の権限、期間の切り替えによる表示の違い表)、右カラム (このページの数値・関連ページ・ガイド内を検索)、よくある疑問と対処法 5 行 (データの出所・確認の条件・関連ページ)、下部固定バー (現在のトピックと主要な元画面へのボタン) を描く。, G2=説明と計算を一致させる。信頼度を 高 (80 以上) / 中 (50〜79) / 低 (49 以下) の 3 段階＋% で全画面に見せる。防衛ラインの算出 (個人生活費と事業固定費の直近 3 か月平均) は変えず、ガイドの説明を実装どおりに書く。ガイドの文言は信頼度の段階と防衛ラインの算出を core の同じ定数から引く。, G3=画面の数字と文言の対応を core の 1 か所から導く。ガイドの節・ステップ・よくある疑問・期間の表・このページの数値・関連ページ・検索を core の純関数 (guide-screen) に置き、API は JSON に写すだけ、web は描くだけにする。, G4=共通シェルのフッタを画像に合わせつつ、表示を事実どおりに保つ。ヘッダは『防衛ライン』のまま (画像の『取引ライン』には合わせない)、フッタ 1 文目は『取込データは外部送信しません』とし、AI 実行時に集計データを渡す事実を補足で必ず見せる。ガイドの API は利用者ごとに分離し、他人の数値を返さない。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G2 G3 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G4 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G2 G4 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G4 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G1 G4 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G2 G3 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G2 G3 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G1 G3 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
