---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: 『次に何を改善すると最も効くのか』を、診断画面の 1 画面で決められるようにする。利用者が診断を開いた時点で、選んだ期間の収支データから見つかった改善余地が年間の改善インパクト順に並び、なぜその順位なのか (根拠の数値・出典・信頼度) と、対応にどれだけ手間がかかるか、いま自分がどこまで対応したかが読め、次の操作 (明細仕分け・予算・サブスク・照合) へそのまま進める状態にする。改善余地の見つけ方は登録制にして、新しい観点をあとから同じ画面の型で足せるようにする。
- **ゴール (U3)**: G1=/analysis/diagnosis を 08-diagnosis.png どおりの構成にする。期間タブ (1年/2年/3年/任意) と期間表示、問いの見出し『次に改善すると、最も効くのはどこですか?』と説明、条件の帯 (分析の範囲 事業/家計/総合・表示する指標 支出/収入/純収支・比較対象 前期間/前年)、診断結果カード (最も効く改善の見出しと年間改善余地の金額・補足・信頼度・データカバー率)、健全性カード (0-100 のスコアと区分)、主なシグナル 3 件、改善アクションの優先順位の表 (# ・優先度・課題・年間改善インパクト・対応の手間・ステータス・次のアクション)、改善インパクトの見込みのウォーターフォールチャート (改善余地合計→項目ごとの削減→改善後の支出見込み) と注記、診断根拠の表 (データソース・対象期間・カバー率・主な内容)、完了すると変わる指標 (年間支出・固定費比率・月次収支の平均・貯蓄率の before→after)、選択した項目の詳細パネル (優先度・タイトル・説明・概要/関連データ/明細サンプルのタブ・なぜ優先度が高いのか・関連する数値・主な内訳・実行ボタン 2 つ)、下部の選択バー (選択中の課題・年間改善インパクト・対応の手間・実行ボタン) を、共通シェル・トークン・共通 Button/PageShell・chart.js の共通設定の上に組む。既存の科目別プロファイル表と自動診断は『統計の詳細を表示』で開閉できる根拠として下部に残す。, G2=改善余地の見つけ方を登録制にする。検知器の定義 (id・表示名・課題文の作り方・年間改善インパクトの見積り方・対応の手間・優先度の決め方・次のアクションの行き先・根拠に使う数値と明細の取り出し方・信頼度の出し方) を packages/core に置き、今回は固定費の見直し・急増した費目・重複支払いの候補・サブスクの重複候補・未分類明細・通信費の見直しを登録する。画面・API・表は検知器の定義から描き、検知器を足すときに画面と API のコードに検知器 id の分岐を増やさない。, G3=健全性スコアを規則ベースの合成指標として定義する。固定費比率・貯蓄率・収支の安定性・データカバー率の 4 要素を、それぞれ定義済みの変換で 0-100 の要素スコアにし、定義済みの重み (30%/30%/25%/15%) で合成して 0-100 の総合スコアと区分 (健全・注意・要改善) を出す。画面はスコアだけでなく内訳 (要素ごとの実測値・要素スコア・重み・寄与点) を開閉で示し、どの要素が点を落としているかが読めるようにする。算式・重み・区分の境界は docs と境界値テストで固定し、外部の基準値に依存しない。, G4=改善アクションの対応状況を D1 に保存して引き継ぐ。検知器と対象から決まる安定した action_key を持つ新表を作り、利用者が選んだ状態 (未着手・対応中・対応済み・見送り) と任意のメモ・決定時刻を保存する。期間の切替・再取込・再ログインをまたいで同じ判断が復元され、対応済みと見送りは既定では一覧から畳まれて改善余地の合計にも入らない (畳んだ件数と金額は注記で示し、切替で再表示できる)。検知結果が消えた action_key の記録は消さずに残し、同じ課題が再発したときに前回の判断を示す。, G5=診断から根拠と実行先へ辿れるようにする。詳細パネルの『明細サンプル』は検知の根拠になった明細を数件その場で示し、『明細仕分けで確認』は /classify へ期間・範囲・カテゴリ・取引先の絞込クエリを渡して開き、『予算に反映』は /budget へ対象科目と提案する上限額を渡して開く。サブスクの重複候補は /subscriptions へ、重複支払いの候補は /analysis/reconciliation へ、freee 由来の課題は /analysis/total-cashflow へ、対象を絞った状態で開く。診断根拠の表の各行はデータ取込 (/import) の該当ソースへ辿れる。期間タブは全体の期間選択を操作し、範囲・指標・比較対象・選択した課題・畳みの切替は URL に保持して再読込と共有で同じ表示に戻る。URL の値が形式違反なら既定値へ倒して画面を出す。, G6=診断の計算規則を単純で説明可能な形で docs に明記しテストで固定する。年間改善インパクトの見積り方 (検知器ごとの根拠と年換算の仕方)、優先度の決め方 (改善インパクトと対応の手間の組合せ)、信頼度とデータカバー率の出し方、改善後の見込みの積み上げ方、完了すると変わる指標の before→after の出し方、要確認の明細を数値に含めない規則、事業/家計/総合の取引集合を総収支・推移と一致させる規則を docs/diagnosis-screen.md に書き、境界値付きの core テストと DOM テストで固定する。既存の pnpm test / typecheck / lint と packages/web の check 系スクリプト (視覚検査を含む) を緑のまま保つ。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G4 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G4 G5 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G3 G5 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G4 G6 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G1 G6 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G2 G3 G4 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G2 G5 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G2 G6 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
