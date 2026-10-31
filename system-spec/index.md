---
kind: index
---

# システム構築仕様書 index

収集マトリクス (カテゴリ×プラットフォーム) の各章と集約状態の相互参照。
集約状態は 未着手 / 収集中 / 確定 / 対象外 の 4 値 (真理値表導出)。

## 要件定義書 (上位概念・憲法)

- [要件定義書](./00-requirements-definition.md) — 上位概念 U1-U9 の正本 (確定マーカー: `confirmed`)。各技術章は serves_goals でここのゴールへトレース (anchor) する。
- **本質的目的 (U1)**: 明細仕分け画面で選んだ明細を、提案の有無や表示中のページ・絞り込みに左右されずに、何がどの値で保存されるかを確かめたうえで一括で確定できるようにする。取込直後で取引先の記憶もルールも無い利用者でも未整理を月次クローズまで減らせるようにし、『選んだのに保存できない』『再試行を押しても何も起きない』『一覧が崩れて読めない』ことで仕分けが止まるのを無くす。
- **ゴール (U3)**: G1=一括保存を、提案が無くても使えるようにする。一括バーに区分・カテゴリ (大/中)・所有者・支払い方法の一括指定欄を置く (qa-classify-bulk-decision-041)。指定した項目は選択した全件に当てる。指定しない項目は、未整理の明細では各行の下書き→提案の順、確定済みの明細では下書き→今の値の順で埋め、手で決めた値を提案で置き換えない (qa-classify-bulk-decision-036・qa-classify-bulk-delegated-004)。区分とカテゴリは 1 組で決める。カテゴリ (大) を指定したらカテゴリ (中) も一括指定の値 (指定が無ければ空) にし、区分だけを指定したときは、埋める値のうち区分が同じものからカテゴリの組を取る (qa-classify-bulk-decision-035・qa-classify-bulk-delegated-003)。区分に合うカテゴリの組が、埋める値 (下書き・提案・今の値) のどこにも無い明細は、カテゴリを『カテゴリなし』にして保存する (qa-classify-bulk-decision-037・qa-classify-bulk-decision-048)。『カテゴリなし』は予約の値で持ち (qa-classify-bulk-decision-045)、集計では未分類と同じに数え (qa-classify-bulk-decision-046)、分類の状態は手動とする (qa-classify-bulk-decision-047)。一括指定の欄と編集パネルでは選べない (qa-classify-bulk-decision-048)。保存の前に、何件をどの値の出所で保存し、そのうち何件を『カテゴリなし』で保存するか、何件をどの理由で外すか (埋める値が無い行、確定済みで変わる値が無い行) を示し、外した行は失敗に数えない。再試行は書き込みの失敗 (write_failed) を返した明細にだけ出し、押せば必ずその明細だけを送り直す (qa-classify-bulk-decision-018)。書き込みの batch が失敗したときは、保存対象の全件が write_failed になる (qa-classify-bulk-decision-057)。見つからない・値が不正・分割がある明細には、再試行の代わりに理由を出す。要求全体が失敗したときは、選択を残し、文言を role=alert で出す。通信の失敗と 5xx は、書き込まれたかどうかが分からないので一覧と選択の読み出しを読み直し、『保存できたか確かめられませんでした。一覧を読み直しました。同じ内容で送り直しても二重には保存されません』と出す (qa-classify-bulk-decision-054)。409 (取込みか別の更新が進行中) はサーバの文言を出す (qa-classify-bulk-decision-056)。通信の失敗・5xx・409 の後には『同じ内容で再試行』を出し、押すと直前の要求の本文をそのまま送る (qa-classify-bulk-decision-054・qa-classify-bulk-decision-056)。一括保存は同じ要求を送り直しても最終の状態が変わらないので、二重には保存されない。自動では送り直さない。400・403・413 は送り直しても結果が変わらないので、再試行を出さずにサーバの文言を出す (qa-classify-bulk-decision-055)。, G2=取込直後でも明細に提案が付くようにする。記憶→ルール→MF 中項目の対応表の後ろに、取込 CSV の分類を使う提案を最後の由来として足す (qa-classify-bulk-decision-042・qa-classify-bulk-decision-040)。区分と所有者は現在の解決値をそのまま使い、信頼度は 60 (MF 中項目の対応表の 70 より下で、要確認の閾値 80 未満) とする (qa-classify-bulk-decision-042・qa-classify-bulk-decision-051)。個人の明細には大項目・中項目をそのまま由来『MF の分類』で付け、根拠文に『MFの分類をそのまま提案』と書く (qa-classify-bulk-decision-042)。集計ルール (取引先) が当たる個人の明細では、ルールを当てた後のカテゴリを提案し、根拠文を集計ルールの名前にする。由来の表示は集計ルールになる。ルールの値が個人のカテゴリの候補に無ければ提案を付けない (qa-classify-bulk-decision-028)。事業の明細には、勘定科目の対応表で大項目から引いた勘定科目を、中項目は空のまま由来『MF の分類 (対応表)』で付け、根拠文に大項目と勘定科目の対応を書く (qa-classify-bulk-decision-040・qa-classify-bulk-decision-052)。勘定科目の対応表に行の無い大項目の事業の明細には付けない (qa-classify-bulk-decision-050)。MF の大項目が空か『未分類』の明細には、個人・事業とも付けない (qa-classify-bulk-decision-039)。提案の付かない明細は、保存前の内訳に『提案なし』とその理由を出す。勘定科目の対応表は利用者ごとに DB の表に持ち、設定画面で行を足し引きする。行は MF の大項目の名前と、勘定科目の一覧から選んだ対応先の 1 組で、同じ大項目は 1 行だけ持つ。初期の行は 通信費→通信費、水道・光熱費→水道光熱費、交通費→旅費交通費、交際費→接待交際費、日用品→消耗品費 の 5 行で、既存の利用者には migration で、新しい利用者には作成時に入れる。中項目で科目が割れるもの (住宅・自動車・食費・教養・教育・特別な支出・税・社会保障・保険)、合う科目が一覧に無いもの (健康・医療・衣服・美容・趣味・娯楽)、振替か意味の無い値 (現金・カード・未分類)、中身を 1 つに決められないもの (収入・その他) の 14 の大項目は、初期の行に入れない (qa-classify-bulk-decision-049・qa-classify-bulk-decision-050)。KPI・ナビのバッジ・月次クローズは既存の 1 か所の関数から数え続ける。, G3=選択を表示に左右されないものにする。選択 (URL の sel に行の key で持つ、最大 50 件) は絞り込み・ページ・並べ替え・期間を変えても保ち、一括バーの選択一覧は表示外の選択も含めて全件を出す (qa-classify-bulk-decision-043)。分割の内訳行は選べず、チェックの代わりに理由を示す (qa-classify-bulk-decision-034・qa-classify-bulk-delegated-002)。分割の設定が不正な明細の行も選べず、理由『分割の設定を直してから保存してください』を示す (qa-classify-bulk-decision-038)。見出しの全選択は表示中の先頭から 50 件までで止め、止めたことを選択の件数の横に示す (qa-classify-bulk-decision-053)。保存はサーバが選択した明細を引き直し、G1 の順で値を解決する。一覧の応答から絞り込み後の全件を外し、選択の中身は行の key を受ける専用の API で読む (qa-classify-bulk-decision-043・qa-classify-bulk-decision-034・qa-classify-bulk-delegated-002)。, G4=取引一覧を 13-classify.png どおりに読めるようにする。『取引先 / 内容』を 2 段の 1 列にまとめた 6 列 (選択・日付・取引先/内容・金額・提案カテゴリ・信頼度) にし、表示件数の選択 (25 / 50 / 100 件) と全 N 件のページ送りを置く。編集パネルは明細を開いたときだけ幅を取り、閉じている間は一覧へ幅を渡す。それでも足りない幅では表の中だけを横スクロールし、1264px 幅でも文字を 1 字ずつ折り返さない (qa-classify-bulk-decision-044)。, G5=保存の経路を安全に保つ。選択の読み出し・一括保存・勘定科目の対応表の読み書きは、認証済みの利用者自身の行だけを扱い、他の利用者の行の key・txId・勘定科目の対応表の行は、存在を明かさず『見つからない』として扱う。入力は zod で検証する。選択は 50 件・一括は 100 件までとし、選択の key と一括の txId の重複は 400 にする。一括指定の値は既存の編集と同じ制約とし、『カテゴリなし』の予約の値は一括指定と編集の値としては 400 にする (qa-classify-bulk-decision-048)。予約の値と同じ名前のカテゴリの候補は作れない (qa-classify-bulk-decision-045)。勘定科目の対応表は、同じ大項目の 2 行目と、勘定科目の一覧に無い対応先を 400 にする。一括保存の本文は 256KB までとして超えたら 413 を返し、変更はフェンスを通し、保存した明細の値が変わった項目ごとに履歴 (一括保存) を 1 行ずつ残す (値が変わらない明細は履歴を書かない)。勘定科目の対応表の変更は、設定の変更履歴に残す (qa-classify-bulk-decision-049)。

## 章一覧と集約状態

| カテゴリ | 章 | 集約状態 | 確定マーカー | 資するゴール | 対応セル |
|---|---|---|---|---|---|
| データベース (database) | [database.md](./database.md) | 確定 | `confirmed` | G1 G3 G5 | database.web database.mobile database.tablet database.desktop-windows database.desktop-linux database.desktop-macos |
| 認証(ログイン) (auth) | [auth.md](./auth.md) | 確定 | `confirmed` | G5 | auth.web auth.mobile auth.tablet auth.desktop-windows auth.desktop-linux auth.desktop-macos |
| UI-UX (ui-ux) | [ui-ux.md](./ui-ux.md) | 確定 | `confirmed` | G1 G3 G4 | ui-ux.web ui-ux.mobile ui-ux.tablet ui-ux.desktop-windows ui-ux.desktop-linux ui-ux.desktop-macos |
| セキュリティ (security) | [security.md](./security.md) | 確定 | `confirmed` | G5 | security.web security.mobile security.tablet security.desktop-windows security.desktop-linux security.desktop-macos |
| インフラ (infrastructure) | [infrastructure.md](./infrastructure.md) | 確定 | `confirmed` | G1 G4 | infrastructure.web infrastructure.mobile infrastructure.tablet infrastructure.desktop-windows infrastructure.desktop-linux infrastructure.desktop-macos |
| バックエンド (backend) | [backend.md](./backend.md) | 確定 | `confirmed` | G1 G2 G3 | backend.web backend.mobile backend.tablet backend.desktop-windows backend.desktop-linux backend.desktop-macos |
| フロントエンド (frontend) | [frontend.md](./frontend.md) | 確定 | `confirmed` | G1 G3 G4 | frontend.web frontend.mobile frontend.tablet frontend.desktop-windows frontend.desktop-linux frontend.desktop-macos |
| 保守運用管理 (maintenance-ops) | [maintenance-ops.md](./maintenance-ops.md) | 確定 | `confirmed` | G1 G2 G3 G4 G5 | maintenance-ops.web maintenance-ops.mobile maintenance-ops.tablet maintenance-ops.desktop-windows maintenance-ops.desktop-linux maintenance-ops.desktop-macos |

## 集約状態サマリ

- **未着手**: —
- **収集中**: —
- **確定**: database, auth, ui-ux, security, infrastructure, backend, frontend, maintenance-ops
- **対象外**: —

## 全体ドキュメント出典 (未割当参照)

- (全ての取得済みドキュメントは各章へ割り当て済み)
