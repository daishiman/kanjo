---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: トレードオフ画面を、『新しい支出を増やすなら、何を見直しますか？』という問いに 1 画面で答え切る場にする。利用者が新しい支出 (支出名・金額・単発 / 毎月・開始月・メモ) を置くと、事業経費を科目×取引先ごとに並べた見直し候補 (月額・年額・必要度・直近の推移・理由) から削減先を選べ、core が決まったルールで出す推奨の組み合わせと理由を参考に、年間の差額と防衛ラインへの影響を確かめてから、その条件を記録して予算・サブスク・明細の画面で手を打てる状態にする。アプリ自身は LLM を呼ばず、試算の数字はすべて core の 1 か所から導く。
- **ゴール (U3)**: G1=/tradeoff を 15-tradeoff.png どおりの画面にする。見出し『トレードオフ』と問い『新しい支出を増やすなら、何を見直しますか？』と説明文、分析期間 (グローバル) のカード、1.新しい支出を設定 (支出名・金額・単発 / 毎月・開始月・メモ)、2.見直し候補の選択 (検索・カテゴリ絞込・選択をすべてクリア、# / カテゴリ・取引先 / 月額 / 年額 / 必要度 / 直近の推移 / 損益・メモ の表と件数表示)、3.推奨の組み合わせ (内容・年間削減額・充足度・実行のしやすさ・リスクの表と、選択中の組み合わせの理由・関連ページへのリンク)、計算例 (毎月と単発)、右側の試算結果 (新しい支出・見直しによる削減額・年間の差額と警告・防衛ラインへの影響・計算の前提)、下部の選択中バー (件数・年間削減額・年間差額・選択をクリア・この条件で試算) を、既存のデザイントークン・共通 Button・PageShell の上に組む。読込・空・失敗の各状態を持つ。, G2=試算の数字を core の純関数 1 か所で導く。毎月の支出は月額×12、単発の支出は発生月だけに計上し、見直しの削減は選択した候補の月額合計×12 で年額にする。年間の差額 = 新しい支出の年額 − 削減の年額。防衛ラインへの影響は、既存 defenseLine の月の余裕×12 を『防衛ライン余裕』、そこから年間の差額を引いた値を『試算後の余裕』とし、試算後が 0 以上なら維持、負なら割れると文字で示す。 差額の符号は『新しい支出の年額 − 削減の年額』で、正は支出増 (赤の警告)、負は捻出できる。, G3=見直し候補を事業経費の科目×取引先ごとに直近 3 か月の平均月額で作る。必要度 (低 / 中 / 高) と直近の推移 (過去 3 か月の減少 / 横ばい / 増加) を core が推定し、『損益・メモ』には検知器の改善案や推移から作る自動の理由を出す。利用者は必要度を上書きしメモを書け、それらは D1 に保存して自動の値より優先する。, G4=推奨の組み合わせを core の決まったルールで出す。候補 2〜4 件の組み合わせのうち年間削減額が新しい支出の年額以上になるものを選び、充足度・実行のしやすさ (必要度の低い候補が多いほど易しい)・リスク (必要度の高い候補を含むほど高い) で順位を付けて上位 4 件を示し、選んだ組み合わせの理由の文と関連ページ (サブスク・予算・明細) へのリンクを添える。アプリは LLM を呼ばない。, G5=試算条件と候補ごとの上書きを安全に記録する。『この条件で試算』を押すたびに条件 (支出名・金額・単発 / 毎月・開始月・メモ・選んだ候補・差額) を既存 tradeoff_plans へ履歴として追加し、画面は最新の 1 件を復元する。保存一覧と翌月の突合は画面から外すが、既存の行と突合の関数は消さない。列と表は追加のみの migration で足し、入力は zod で検証し文字数に上限を設け、利用者ごとに分離する。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G3 G5 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G5 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G2 G3 G4 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G5 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G1 G5 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G2 G3 G4 G5 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G2 G3 G4 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G1 G2 G3 G4 G5 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
