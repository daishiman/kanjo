---
graph_node_id: "spec-total-cashflow-screen"
artifact_kind: "specification"
artifact_subtypes: ["api"]
title: "総収支画面 仕様"
project_id: "kanjo"
domain: "analysis"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["total-cashflow-screen"]
file_path: "specs/spec-total-cashflow-screen.md"
template_id: "specification"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "fb279c1721e0f5401985f101fd3a947fce86c605e7417d1dcb5de135eddc4f36"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/00-requirements-definition.md", "source_version": "0.1.14", "source_digest": "fb279c1721e0f5401985f101fd3a947fce86c605e7417d1dcb5de135eddc4f36", "imported_at": "2026-09-15T14:50:54Z"}
created_at: "2026-09-15T14:50:54Z"
updated_at: "2026-09-15T14:50:54Z"
depends_on: []
related_nodes: ["arch-total-cashflow-screen-ui-ux", "arch-total-cashflow-screen-frontend", "arch-total-cashflow-screen-backend", "arch-total-cashflow-screen-database", "arch-total-cashflow-screen-auth", "arch-total-cashflow-screen-security", "arch-total-cashflow-screen-infrastructure", "arch-total-cashflow-screen-maintenance-ops"]
resource_scope: ["packages/core/src/total-cashflow.ts", "packages/api/src/routes/total-cashflow.ts", "packages/api/src/db/schema.ts", "packages/web/src/pages/analysis/TotalCashflow.tsx", "packages/web/src/components/Layout.tsx", "migrations"]
purpose: null
goal: null
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "system-spec の要件定義書 (U1-U9) を総収支画面サイクルの実装計画の入口として参照する単一の specification。API 変更 (GET /api/total-cashflow の応答拡張、判定・除外の書込み、POST /total-cashflow/operations/{id}/undo 新設、除外理由の区分とメモ) があるため api-contract overlay を合成する。"
classification_candidates: [{"artifact_kind": "specification", "confidence": 1.0, "candidate_path": "specs/spec-total-cashflow-screen.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-15T14:50:54Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---

# 総収支画面 仕様

本書は `system-spec/00-requirements-definition.md` (承認 `appr-total-cashflow-reask-003`) を dev-graph の specification として参照する入口である。規範本文は system-spec 側が正本で、ここでは実装計画が必要とする節だけを要約し、領域別の制約は architecture ノード (arch-total-cashflow-screen-ui-ux, arch-total-cashflow-screen-frontend, arch-total-cashflow-screen-backend, arch-total-cashflow-screen-database, arch-total-cashflow-screen-auth, arch-total-cashflow-screen-security, arch-total-cashflow-screen-infrastructure, arch-total-cashflow-screen-maintenance-ops) に分ける。章の相互参照は `system-spec/index.md`、完成度評価は `system-spec/completeness-findings.json` (verdict PASS)。消し込みの不変条件そのものは既存の feat-total-cashflow / spec-total-cashflow-system 側の記述を正とし、本書は変更しない。

## 目的と成功状態

家計と事業を合わせた本当の収支を、重複と除外の判断ごと 1 画面で確かめて月次クローズの『照合→総収支』を終えられるようにする。利用者が総収支を開いた時点で、期間の総収入・総支出・純収支と前期比、月ごとの推移が総合/事業/家計で読め、その数字に効いている重複候補・freee 除外・要確認を同じ画面の判定作業で片付け、誤った判断はその画面を開いてから行った操作を新しい順に遡って元に戻せる状態にする (U1)。

ゴール (U3) の要旨:
- G1: /analysis/total-cashflow を 05-total-cashflow.png どおりの構成にし、共通シェル・トークン・Button の上に組む。既存の 9 列月次表は『月次の内訳を表示』で開閉できる検算根拠として残す。
- G2: 重複・除外の判定作業を 3 ペイン (左: 件数付きナビ / 中央: フィルタ・検索・チェック選択付き明細表 / 右: MF 明細と freee 対応候補の並列詳細・一致度・判定ボタン・直前の操作と元に戻す) にし、複数選択と下部の選択バーで一括判定できるようにする。
- G3: 総合/事業/家計ごとの期間合計と前期 (前年の同じ期間) 比較、月次系列、判定作業の 3 区分と件数、一致度、自動一致の候補を packages/core の純関数と API に置き、既存の消し込み不変条件を保つ。除外した freee 取引が唯一の候補だった要確認の MF 明細は、要確認から出して公私仕分けで数える。
- G4: 判定と除外の操作を D1 に記録し元に戻せるようにする。除外は理由区分 (振替/内部移動/帳簿のみ/二重登録/その他) とメモに分け、既存の自由記述理由は失わずに移行する。再読込後は取り消せない (操作履歴は残る)。判定・除外・操作履歴はバックアップに含め、復元しても戻る。
- G5: 一致度・区分・自動一致の候補の扱いを docs に明記しテストで固定する。共通ヘッダー/フッターの文言を画像に揃え、サイドバーは現在地と照合の件数バッジを確認する。

成功状態 (U5):
- S1 (G1): /analysis/total-cashflow で 05-total-cashflow.png の構成要素がすべて描画され、色・余白・部品はトークンと共通 Button/PageShell 経由で、直書き色の lint が 0 件である。
- S2 (G1, G3): 総合/事業/家計それぞれで総収入・総支出・純収支と前期比 (額・率) が core の値と一致し、総合の値が事業と家計の和に一致する。
- S3 (G2): 判定作業で単票・複数選択の『同じ取引/別の取引/集計から除外』が行え、判定後の総額が feat-total-cashflow の不変条件を満たす。
- S4 (G4): 画面を開いてから行った操作を元に戻すと総収入・総支出・判定件数が操作前と一致し、同じ取消を 2 回送っても 1 回分しか戻らない。再読込後は取消の導線が出ない。既存の除外理由は migration 後もメモとして読め、バックアップから復元しても判定・除外・操作履歴が戻る。
- S5 (G5): 一致度・区分・自動一致の規則が docs に明記され、境界値付きテストで固定される。サイドバーの支出分析 > 総収支 が現在地になり照合の件数バッジが要確認件数と一致する。
- S6 (G1-G5): 既存の pnpm test / typecheck / lint と packages/web の check 系スクリプトが全て緑のままである。

## スコープ

- In:
  - 総収支タブ (05-total-cashflow.png) の画面構成の作り直し: 見出し・セグメント・期間表示・KPI・チャート・3 ペイン判定作業・freee 除外一覧・自動一致の候補・進捗通知・下部選択バー、既存 9 列月次表の開閉化
  - packages/core の総収支集計の拡張 (セグメント別期間合計・前期比較・月次系列・判定作業 3 区分・一致度・自動一致の候補)
  - packages/api の総収支 API 拡張 (集計の返却、一括判定、除外の理由区分とメモ、操作履歴の取得と取消)
  - D1 migration: freee 除外の理由区分とメモ列、判定・除外の操作履歴テーブル、既存理由の移行、判定・除外・操作履歴の 3 表をバックアップと復元の対象に加えること
  - 一致度・区分・自動一致の規則の docs 記載とテスト
  - 共通ヘッダー/フッター文言の画像への揃え (防衛ライン・毎朝バックアップ等)
  - サイドバーの支出分析 > 総収支 の現在地と照合バッジの表示確認 (確認のみ)
- Out:
  - サイドバーの総収支以外の項目・並び・月次クローズ進捗の形の変更 (利用者指示により今回は確認のみ)
  - 照合・マトリクス・推移・診断の各タブの中身 (それぞれの画面サイクルで扱う)
  - 日付と金額の一致による自動寄せの廃止 (利用者決定により自動寄せを維持する)
  - freee / Money Forward の取込経路の追加と明細分割の仕様変更
  - 期間選択の保存先の変更 (既存どおり localStorage で全画面共有)
  - mobile / tablet / desktop 向け専用アプリ (対象は web のみ。狭幅は既存のレスポンシブ表示で扱う)

## 用語と主体

| Term/Actor | Definition/Responsibility |
|---|---|
| 総収支画面 | /analysis/total-cashflow の総収支タブ (packages/web/src/pages/analysis/TotalCashflow.tsx) |
| セグメント | 総合 / 事業 / 家計。総合 = 事業 + 家計 |
| 前年同期 | 前期比の比較先。previousYearPeriod(range) が選択期間の開始月と終了月をそれぞれ 12 か月前へずらした期間。ハブの『前期間』(直前の同じ長さ) とは別の定義 |
| 判定作業の 3 区分 | 重複候補 / 要確認 / freee除外。3 区分の和は review 件数 + excluded 件数 |
| 一致度 | 金額・日付差・口座・摘要の配点合計 (0〜100 の整数)。確率ではない |
| 自動一致の候補 | matched のうち by=auto の組 (日付と金額の一致で自動に寄せた組)。旧称『完全一致候補』 |
| 判定 | same (同じ取引) / different (別の取引)。duplicate_verdicts に保存 |
| freee 除外 | 対応する freee 取引を集計から外すこと。freee_deal_exclusions に理由区分 (reason_code) とメモ (memo) 付きで保存 |
| 操作履歴 | total_cashflow_operations。判定・除外・戻す・取消を 1 操作 1 行で記録する |
| 取消 (元に戻す) | 画面が保持する操作 id の列の先頭を送り、最新の未取消操作と一致したときだけ操作前の値へ戻す |
| SH1 利用者 | 単独の個人事業主。月次クローズで総収支を開き、前期と比べて掴み、重複・除外を片付け、誤りを戻したい |
| SH2 保守者 | 同一人物とコーディングエージェント。集計と判定規則が core の純関数・docs・テストで固定され、画面側に計算を二重実装しないこと |

## ユースケースとユーザーフロー

1. 月次クローズで /analysis/total-cashflow を開くと、問いの見出し『家計と事業を合わせた、本当の収支はいくらですか?』の直下に KPI 3 枚と前年同期比が出る。セグメントを切り替えると KPI とチャートが事業/家計/総合に切り替わる (API は再取得しない)。
2. 判定作業の左ナビで 重複候補 / freee除外 / 要確認 を件数付きで選び、中央の明細表をソース/判定フィルタと検索で絞り、行を選ぶと右に MF 明細と freee 対応候補の並列詳細と一致度の内訳が出る。
3. 右ペインまたは下部の選択バーから『同じ取引 / 別の取引 / 集計から除外』を単票・一括で行う。完了すると『N件中M件の判定が完了しました』と『元に戻す』が同じ場所に出る。
4. freee から除外した明細一覧で理由区分バッジとメモを確かめ、一括で理由を設定する、または『集計へ戻す』。
5. 自動一致の候補一覧で一致度と判定状態を確かめ、『選択した取引を同じ取引にする』で same を記録する (総額は変わらない)。
6. 誤った判断は『元に戻す』を押すたびに、その画面を開いてから行った未取消の操作を新しい順に 1 つずつ戻す。再読込や画面の移動の後は導線を出さない。
7. 検算したいときは『月次の内訳を表示』で既存の 9 列月次表を開く。

## 機能要件

- `FR-001` (O1, I1, I2, I3, I7): 総収支タブが見出しと説明・データの見方リンク・5 タブ・総合/事業/家計のセグメント・選択中期間と前年同期の表示・KPI 3 枚 (期間合計と前期比の額・率。前期データが無ければ『比較データなし』)・月次の収入/支出の棒と純収支の折れ線 (チャート系列色・凡例・金額軸 万円)・判定作業・freee 除外一覧・自動一致の候補・進捗通知・下部選択バーを描画し、9 列月次表は開閉で表示する。 判定: DOM テストで各ブロックの描画と開閉。
- `FR-002` (O2, I8): core に総収支のセグメント別集計・前期比較・判定作業の区分・一致度関数を追加し、GET /api/total-cashflow が 1 回で返す。 判定: core テストで総合=事業+家計が期間合計・月次系列の双方で成り立ち、前期比が境界値 (前期 0・前期データ無し) 付きで検証される。
- `FR-003` (O3, I4, I7): 3 ペインの判定作業で区分切替・フィルタ・検索・選択・右詳細・単票と一括の同じ/別/除外ができる。 判定: DOM テストと、API 統合テストで判定後の総額が不変条件どおりになる。
- `FR-004` (O4, I5, I9): freee 除外を理由区分とメモに分けて一括設定でき、既存 reason は memo と『その他』へ移る。 判定: migration 適用後に既存除外の理由がメモとして読める統合テスト。
- `FR-005` (O4, I8, I9): 判定・除外・戻すを操作履歴に残し、取消 API で画面を開いてから行った操作を新しい順に取り消せる。同じ取消の再送や古い表示からの取消で意図しない操作を戻さない。 判定: 取消 API の統合テストで操作前後の総額が一致し、同じ id の再送・古い id で戻らず、再取込後も判定が再適用される。
- `FR-006` (O4, I9): duplicate_verdicts・freee_deal_exclusions・total_cashflow_operations の 3 表をバックアップと復元の対象に加える。 判定: 復元テストで 3 表が復元時点へ戻り、key の無い旧バックアップでは既存の行が残る。
- `FR-007` (I6): 自動一致の候補一覧にソースフィルタ・全選択・一致度・『選択した取引を同じ取引にする』を置き、確定は same の記録だけで総額を変えない。 判定: 統合テストで same 記録の前後で matched と総額が不変。
- `FR-008` (O5, I10, I11): 一致度・3 区分・自動一致の規則を docs に書き境界値テストで固定し、共通ヘッダー/フッターの文言を画像に揃え、サイドバーの現在地と照合バッジを DOM テストで確認する。 判定: 規則を変えるとテストが落ち、pnpm test / typecheck / lint と check 系が緑。

## 非機能要件

- Performance: 画面は GET /api/total-cashflow の 1 回の取得で全ブロックを描く。1 リクエストで loadDataset と freee 系 3 テーブル (+操作履歴の直近 1 件) を読み、d1-limits.ts の制限内に収める。取消照合は total_cashflow_operations の (user_id, created_at DESC) 索引で引き、全件走査しない。
- Availability/Reliability: Worker・binding・cron・デプロイ経路を変えない。migration は追加のみで、本番の migration gate (feat-deploy-migration-gate) と runtime schema guard を通す (C5)。判定/除外の更新と履歴 1 行は同じ D1 batch に入れ、片方だけ残らないようにする。
- Accessibility/Usability: docs/design-system.md に従い、トークンとチャート系列色・共通 Button・PageShell を使う。WCAG 2.2 AA (文字 4.5:1、部品 3:1) を維持し、判定状態は 未判定/同じ/別/除外 の文字バッジ、前期比は符号と矢印と色で示し色だけに頼らない (C2)。狭幅では 3 ペインを 左ナビ→明細表→詳細 の順に縦積みし、詳細は選択時に開く。
- Security/Privacy: 認証ゲート配下で userId に絞り、外部サービスへ送らない。reasonCode は 5 値の許可リスト、memo は 0〜200 字、一括は最大 200 件。メモと摘要は React の文字列描画だけで表示する。表示値にサンプル以外の実データを docs やテストへ持ち込まない (C6)。
- Maintainability/Operability: 集計は core に置き api/web へ重複実装しない (C1)。規則の数値は名前付き定数にし、docs とテストを同じ変更で更新する。

## UI・状態遷移

- 画面/CLI/API状態: 共通シェルの PageShell 上に、問いの見出し → 5 タブ → セグメントと期間表示 → KPI 3 枚 → チャート → 判定作業 3 ペイン → freee 除外一覧 → 自動一致の候補 → (折りたたみ) 月次の内訳。情報の優先順位は 1 位 KPI 3 枚と前年同期比、2 位 判定作業の左ナビの件数 (件数 0 の区分も 0 と出す)、3 位 チャート、4 位 freee 除外一覧と自動一致の一覧 (qa-ui-ux-web-tc-inference-004)。
- 遷移条件: セグメント・区分・フィルタ・検索・選択は画面の状態で持ち、URL に載せず API を再取得しない。下部選択バーは 1 件以上選択したときだけ出し、0 件で消す。『元に戻す』は、その画面を開いてから成功した書込みの operationId の列が残る間だけ出し、押すたびに列の先頭を送り、成功したら先頭を外す。再読込や画面の移動で列は消える (qa-total-cashflow-decision-013/017)。
- Loading/Empty/Error: 前年同期が 1 か月でも欠ければ 0% と書かず『比較データなし』。送信中はボタンを無効にする。取消が 409 のときは列を空にし『別の画面で新しい操作があったため取り消せません』と再読込を促す。部分成功は件数で通知し、失敗した項目は選択状態のまま残す。自動一致の候補の説明文は『日付と金額が一致して自動で寄せた取引です。摘要や口座の違いは一致度に出ます』。

## ビジネスルールと検証

- `BR-001` 一致度 (0〜100 の整数): 金額 40 (同額・同じ向きのときだけ候補になるので候補は常に 40) + 日付 30/20/10/5/0 (dayGap の絶対値 0/1/2/3/4 以上) + 口座 15/8/0 (一致/片側の情報なし/accountsConflict) + 摘要 15/8/0 (normalizeInstitution と同じ正規化の後に MF content と freee partner が一致/一方が他方を含む/それ以外)。
- `BR-002` 判定作業の 3 区分: 『重複候補』は review のうち候補がちょうど 1 件で理由が『発生日が一致しません』または『取込月と表示日の月が一致しません』のもの。『要確認』は残りの review (候補 0 件・2 件以上・『口座不一致』・『対応する freee 取引が他の明細へ寄せられています』)。『freee除外』は excluded。3 区分の和は review 件数 + excluded 件数に一致する。
- `BR-003` 自動一致の候補: matched のうち by=auto の組。自動で寄せる条件は発生日一致かつ金額一致だけなので一致度は 78〜100 の値になり、100 に丸めずそのまま出す (qa-total-cashflow-decision-012)。各組の判定状態は same 記録があれば『同じ』、無ければ『未判定』。『同じ取引にする』は same を記録するだけで matched の集合と総額は変わらない (qa-total-cashflow-decision-002/008)。
- `BR-004` セグメント: 総合 = 事業 + 家計 (months の bizIncome+householdIncome=totalIncome 等) を期間合計と月次系列の双方で満たす。
- `BR-005` 除外後の数え方: freee 取引を除外すると、その freee 取引は総額から外れ、対応していた MF 明細は公私仕分け (resolveTx) の結果で事業か家計に数える。除外の前後で事業と家計の内訳が入れ替わることがある (qa-total-cashflow-decision-014)。要確認に残る明細のうち、除外を考えずに引いた候補がちょうど 1 件で、その freee 取引が除外されているものは、理由にかかわらず review から出して resolveTx で数える。もともと候補の無い明細と、除外を考えない候補が 2 件以上ある明細は review に残る。除外を集計へ戻すと明細は review へ戻る (qa-total-cashflow-decision-015)。
- `BR-006` 前年同期比: previousYearPeriod(range) は開始月と終了月をそれぞれ 12 か月前へずらす (例 2026-04〜2026-06 → 2025-04〜2025-06)。analysis-hub の previousPeriod は変えず名前も分ける。前年同期間の全ての月がデータ範囲にあるときだけ前年値を出し、1 か月でも欠ければ null。差額 = 当期 − 前年値、率 = 差額 / |前年値| で前年値が 0 のとき率は null。ラベルは『前年同期』(qa-total-cashflow-decision-006)。
- `BR-007` 判定進捗『N件中M件』: 表示中区分の対象件数 N と、その中で verdict または除外を記録済みの件数 M。
- `BR-008` 取消: 指定された id が、同じ user_id で kind が undo でなく undone_at が空の書込み操作のうち最新 (created_at の降順、同時刻は id の降順) の 1 操作と一致するときだけ、記録した操作前の値へ戻す (一括は 1 操作に複数件)。一致しなければ何も変えず 409。取消した操作は undone_at を持ち、取消そのものも kind=undo の履歴 1 件 (undoes_id に対象) として残るが、undo の行は次の取消の対象にならない。取消のやり直しは無い (qa-total-cashflow-decision-013)。サーバは古さの上限を持たない (qa-total-cashflow-decision-017)。取消後の総収入・総支出・判定件数は操作前と一致する。
- `BR-009` 消し込みの不変条件 (C3): freee 正本による消し込み、未判断候補の 4 区分外への隔離、same の総額不変、different の独立残余加算、判断の再取込後の再適用を変えない。肯定条件は発生日一致かつ金額一致だけで支払先は使わず、口座は否定条件にだけ使う。集計値は保存せず利用者の判断だけを保存する (dec-aggregation-strategy-001)。

## API契約

既存 GET /api/total-cashflow の応答へ加算し、既存の書込み route の body と応答を広げ、取消 route を 1 本新設する (qa-frontend-web-tc-inference-004・qa-backend-web-tc-inference-006/007・qa-database-web-tc-inference-006)。endpoint の形・操作 id の列・409 の条件・応答の名前はアシスタント推定で、利用者の明示選択ではない (承認 note は 409 と id の契約を下位の推定にだけ置くとしている)。以下に api-contract overlay を合成する。

### API: GET /api/total-cashflow

#### 識別と目的

- Operation ID: N/A: 章は operation ID を定めない。ルートの method と path で識別する。
- Method/Path: `GET /api/total-cashflow`
- Purpose: 総収支画面の全ブロック (KPI・チャート・判定作業・自動一致の候補・直前操作) を 1 回の取得で描けるようにする。
- Version/Lifecycle: 既存 route への加算。既存 months / review / matched / freeeOnly は互換のため残す。

#### 認証・認可

- Authentication: 利用者アカウントのセッション。/api/* の authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence の後にマウントされた既存 route。
- Required scopes/roles: N/A: 役割による区別を持たない。認証済み利用者本人だけが呼べる。
- Resource ownership check: freee_deals・duplicate_verdicts・freee_deal_exclusions・total_cashflow_operations の読取りをすべて c.get('userId') で絞る。

#### Request

- Headers: N/A: 固有のヘッダーは無い。
- Path parameters: N/A: path パラメータは無い。
- Query parameters: 期間は既存 loadScoped(c) の解釈に従う。セグメント・区分・フィルタ・検索は API へ送らない。
- Body schema: N/A: GET のため body を持たない。
- Example: N/A: 逐語の例は章に無く、実装 task の契約テストで固定する。

#### Response

| Status | Meaning | Schema |
|---|---|---|
| 200 | 期間の総収支集計と判定作業 | 既存 months / review / matched / freeeOnly に加え、summary (total/business/household ごとの income・expense・net と previousYear {income, expense, net} \| null・delta・rate \| null、period と previousYearPeriod のラベル)、series (セグメントごとの月次 income/expense/net)、workbench (duplicates・review・exclusions の件数と明細。明細は mf・candidates[score 付き]・verdict)、autoMatches (by=auto の組と score・判定状態)、lastOperation (kind が undo でない未取消の最新操作の id・kind・item_count・created_at \| null) |

- Headers: 既存の secureHeaders と requestId を全体に掛ける構成を維持する。
- Example: N/A: 逐語の例は章に無い。

#### Validation・ビジネスルール

- BR-001〜BR-007 と BR-009 を packages/core/src/total-cashflow.ts の純関数で適用し、route は D1 の読取りと受け渡しだけを持つ。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
|---|---|---|---|---|
| 401 | 既存 authGuard の応答 | 未認証 | no | 既存どおりログインへ送る |
| 403 | password_change_required | 一時パスワード未変更 (mustChangePasswordFence) | no | パスワード変更へ進む |

- 総収支固有の読取りエラーコードは章で定めない。

#### 実行セマンティクス

- Idempotency key/replay: N/A: 読取り専用で副作用が無い。
- Concurrency/optimistic lock: N/A: 書込みを伴わない。
- Transaction boundary: N/A: 書込みが無い。
- Timeout/retry/rate limit: 1 リクエストの D1 読取りを d1-limits.ts の制限内に収める。レート制限の変更は無い。

#### キャッシュ・ページング

- Cache/ETag: web は queryKey ['total-cashflow', 期間 key] 1 本を正本にし、判定・除外・戻す・取消の成功後に ['total-cashflow'] と ['analysis-hub'] を invalidate する。HTTP キャッシュヘッダーは章で定めない。
- Cursor/limit/filter/sort: N/A: 期間単位の固定形の集計応答でページングを持たない。

#### 可観測性と監査

- Request/correlation ID: 既存の requestId を使う。
- Metrics/logs/audit/redaction: N/A: 読取りに新しい監視・監査を足さない。

#### セキュリティ確認

- Input/output validation: 期間クエリは既存の解釈に従う。出力は利用者本人の明細・freee 取引・判定だけ。
- Sensitive data exposure: 外部サービスへ送らない。検索語はクエリ文字列に載せない。
- Abuse/authorization tests: 未認証で 200 を返さない。他利用者の判定・除外・操作履歴が応答に混ざらない。

#### Contract tests

- Positive: 認証付きで 200 と summary / series / workbench / autoMatches / lastOperation を返し、既存フィールドも残る。
- Boundary: 前年値 0 で rate null、前年同期の月が 1 か月欠けると previousYear null、日付差 3 日と 4 日、候補 1 件と 2 件、唯一の候補を除外した月ずれ明細が review から出る、自動一致の組で摘要だけが違う。
- Negative/auth/error/idempotency: 未認証で 401。

### API: POST /total-cashflow/verdicts

#### 識別と目的

- Operation ID: N/A: 章は operation ID を定めない。
- Method/Path: `POST /total-cashflow/verdicts` (/api 配下)
- Purpose: 単票・一括の『同じ取引 / 別の取引』と、自動一致の候補の『同じ取引にする』を記録する。
- Version/Lifecycle: 既存 route。応答に operationId を足し、操作履歴に記録する。

#### 認証・認可

- Authentication: 既存ゲート列の後。
- Required scopes/roles: N/A: 役割による区別を持たない。
- Resource ownership check: userId で絞って upsert する。

#### Request

- Headers: N/A: 固有のヘッダーは無い。
- Path parameters: N/A: path パラメータは無い。
- Query parameters: N/A: クエリは使わない。
- Body schema: 最大 200 件の {txId, verdict same|different, freeeKey?}。zod で検証する。
- Example: N/A: 逐語の例は章に無い。

#### Response

| Status | Meaning | Schema |
|---|---|---|
| 200 | 判定を記録した | 既存応答に operationId を加える |

- Headers: 既存構成を維持する。
- Example: N/A: 逐語の例は章に無い。

#### Validation・ビジネスルール

- verdict は same|different の許可値。件数は最大 200 で、超過は 400 で全体を拒否する。same の記録で matched と総額は変わらない (BR-003)。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
|---|---|---|---|---|
| 400 | zod 検証エラー | 許可値外・件数超過 | no | 入力を直す |
| 401 | 既存 authGuard の応答 | 未認証 | no | ログインへ |
| 409 | canonical_write_busy | 取込・復元などと重なり lease を取れない (canonical-mutation-fence) | yes | 再試行を促す |

#### 実行セマンティクス

- Idempotency key/replay: 判定は upsert で同値の再送は同じ状態になる。操作履歴は送信ごとに 1 行増える。
- Concurrency/optimistic lock: canonical-mutation-fence に consumers (duplicate_verdicts と total_cashflow_operations) 付きで登録し、取込・復元と重ねない。
- Transaction boundary: 判定の更新・操作履歴 1 行・invalidateJsonSnapshotQuery を同じ D1 batch で行う。items_json は D1_MAX_BOUND_PARAMS に合わせて分割する。
- Timeout/retry/rate limit: レート制限の変更は無い。

#### キャッシュ・ページング

- Cache/ETag: 成功後に web が ['total-cashflow'] と ['analysis-hub'] を invalidate する。
- Cursor/limit/filter/sort: N/A: 書込み route でページングを持たない。

#### 可観測性と監査

- Request/correlation ID: 既存の requestId を使う。
- Metrics/logs/audit/redaction: 操作履歴が利用者本人の判断記録になる。before/after には判定の値だけを入れ、摘要などの自由文を複製しない。

#### セキュリティ確認

- Input/output validation: zod の許可値と件数上限。
- Sensitive data exposure: 外部送信なし。
- Abuse/authorization tests: 他利用者の txId を指定しても他人の判定が変わらない。

#### Contract tests

- Positive: 200 と operationId、判定後の総額が不変条件どおり。
- Boundary: 200 件と 201 件。
- Negative/auth/error/idempotency: 未認証 401、許可値外 400。

### API: POST と DELETE /total-cashflow/freee-exclusions

#### 識別と目的

- Operation ID: N/A: 章は operation ID を定めない。
- Method/Path: `POST /total-cashflow/freee-exclusions` (除外・一括で理由を設定)、`DELETE /total-cashflow/freee-exclusions` (集計へ戻す)
- Purpose: 対応する freee 取引を理由区分とメモ付きで集計から外す、または戻す (qa-total-cashflow-decision-003/009)。
- Version/Lifecycle: 既存 route の body を広げる。旧 {reason} は memo と other として受ける。DELETE も操作履歴に残す。

#### 認証・認可

- Authentication: 既存ゲート列の後。
- Required scopes/roles: N/A: 役割による区別を持たない。
- Resource ownership check: freee_deal_exclusions の主キー (user_id, freee_key) で本人の行だけを読み書きする。

#### Request

- Headers: N/A: 固有のヘッダーは無い。
- Path parameters: N/A: path パラメータは無い。
- Query parameters: N/A: クエリは使わない。
- Body schema: POST は {items:[{freeeKey, reasonCode, memo?}]} または {freeeKeys[], reasonCode, memo?}。reasonCode は transfer/internal/book_only/duplicate/other (表示語 振替/内部移動/帳簿のみ/二重登録/その他)。DELETE の body は既存どおり。
- Example: N/A: 逐語の例は章に無い。

#### Response

| Status | Meaning | Schema |
|---|---|---|
| 200 | 除外または戻すを記録した | 既存応答に operationId を加える |

- Headers: 既存構成を維持する。
- Example: N/A: 逐語の例は章に無い。

#### Validation・ビジネスルール

- reasonCode は 5 値の許可リスト (DB の CHECK と zod の enum を同じ定数から作る)、memo は 0〜200 字、件数は最大 200。書込時は memo を正本とし、後方互換の reason 列にも同じ値を入れる。除外後の数え方は BR-005。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
|---|---|---|---|---|
| 400 | zod 検証エラー | 許可リスト外・memo 長超過・件数超過 | no | 入力を直す |
| 401 | 既存 authGuard の応答 | 未認証 | no | ログインへ |
| 409 | canonical_write_busy | 取込・復元などと重なり lease を取れない | yes | 再試行を促す |

#### 実行セマンティクス

- Idempotency key/replay: 除外は主キーで upsert。操作履歴は送信ごとに 1 行増える。
- Concurrency/optimistic lock: canonical-mutation-fence に consumers (freee_deal_exclusions と total_cashflow_operations) 付きで登録する。
- Transaction boundary: 除外の更新・操作履歴 1 行 (items_json に freeeKey・before 行の有無と reason_code/memo・after)・invalidateJsonSnapshotQuery を同じ D1 batch で行う。
- Timeout/retry/rate limit: レート制限の変更は無い。

#### キャッシュ・ページング

- Cache/ETag: 成功後に web が ['total-cashflow'] と ['analysis-hub'] を invalidate する。
- Cursor/limit/filter/sort: N/A: 書込み route でページングを持たない。

#### 可観測性と監査

- Request/correlation ID: 既存の requestId を使う。
- Metrics/logs/audit/redaction: 操作履歴の自由文は取消に要る memo だけを持つ。

#### セキュリティ確認

- Input/output validation: 許可リスト・長さ上限・件数上限。メモは React の文字列描画だけで表示し HTML として解釈しない。
- Sensitive data exposure: 外部送信なし。
- Abuse/authorization tests: 他利用者の freeeKey の除外を変えられない。

#### Contract tests

- Positive: 理由区分とメモの一括設定、旧 {reason} が memo+other で受理される。
- Boundary: memo 200 字と 201 字、200 件と 201 件、唯一の候補を除外した明細が review から出る、除外の前後で事業/家計の内訳が入れ替わる。
- Negative/auth/error/idempotency: 許可リスト外 400、未認証 401。

### API: POST /total-cashflow/operations/{id}/undo

#### 識別と目的

- Operation ID: N/A: 章は operation ID を定めない。
- Method/Path: `POST /total-cashflow/operations/{id}/undo` (/api 配下)
- Purpose: その画面を開いてから行った操作を新しい順に 1 つずつ取り消す (qa-total-cashflow-decision-004/013/017)。
- Version/Lifecycle: 本サイクルで新設。

#### 認証・認可

- Authentication: 既存ゲート列の後。
- Required scopes/roles: N/A: 役割による区別を持たない。
- Resource ownership check: 操作履歴を user_id と id の両方で引く。他人の操作 id は存在の有無を返さず 404。

#### Request

- Headers: N/A: 固有のヘッダーは無い。
- Path parameters: id: 取り消したい操作の id (画面が保持する operationId の列の先頭)。
- Query parameters: N/A: クエリは使わない。
- Body schema: N/A: 章は body を定めない。
- Example: N/A: 逐語の例は章に無い。

#### Response

| Status | Meaning | Schema |
|---|---|---|
| 200 | 取り消した | 取消後の lastOperation |
| 404 | 他人の id または存在しない id | エラー |
| 409 | 最新の未取消操作と一致しない id (再送・古い表示)、または照合と batch のすき間に割り込みがあり undone_at の更新件数が 0 | エラー |

- Headers: 既存構成を維持する。
- Example: N/A: 逐語の例は章に無い。

#### Validation・ビジネスルール

- BR-008。照合の後に、対象の値の復元 → kind=undo (undoes_id=対象 id) の行の追加 → 対象行の undone_at の更新 の順の文を 1 つの D1 batch で行う。3 種の文は全て『対象行が存在し undone_at IS NULL で、かつ対象より新しい kind が undo でない未取消行が同じ user_id に無い (NOT EXISTS)』条件付き。値の復元は、操作前に行が無かったものは DELETE … WHERE EXISTS、有ったものは INSERT … SELECT … WHERE EXISTS … ON CONFLICT DO UPDATE。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
|---|---|---|---|---|
| 401 | 既存 authGuard の応答 | 未認証 | no | ログインへ |
| 404 | N/A: 章はコード名を定めない | 他人の id・存在しない id | no | 列を空にして再読込を促す扱いは未決 (未決事項参照) |
| 409 | N/A: 章はコード名を定めない | 最新の未取消操作と不一致・更新件数 0 | no | 列を空にし『別の画面で新しい操作があったため取り消せません』と再読込を促す |
| 409 | canonical_write_busy | fence の lease を取れない | yes | 画面側の扱いは未決 (未決事項参照) |

#### 実行セマンティクス

- Idempotency key/replay: 同じ id の 2 回目は条件付き文が 0 行になり 409。1 回分しか戻らない。
- Concurrency/optimistic lock: 最新の未取消操作との一致による条件付き要求。canonical-mutation-fence に consumers (3 表) 付きで登録する。
- Transaction boundary: 復元・undo 行・undone_at 更新・invalidateJsonSnapshotQuery を同じ D1 batch で行う。
- Timeout/retry/rate limit: サーバは古さの上限を持たない。取り消せる範囲は画面が持つ id の列で決まる。

#### キャッシュ・ページング

- Cache/ETag: 成功後に web が ['total-cashflow'] と ['analysis-hub'] を invalidate し、列の先頭を外す。
- Cursor/limit/filter/sort: N/A: 単一操作の取消でページングを持たない。

#### 可観測性と監査

- Request/correlation ID: 既存の requestId を使う。
- Metrics/logs/audit/redaction: 取消も kind=undo の履歴 1 行として残る。取消できない誤操作が起きた場合は操作履歴から前後の値を確認する。

#### セキュリティ確認

- Input/output validation: id は user_id と組で引く。
- Sensitive data exposure: 他人の id に対し存在の有無を漏らさない (404)。
- Abuse/authorization tests: 他利用者の操作 id で 404、何も変わらない。

#### Contract tests

- Positive: 取消後の総収入・総支出・判定件数が操作前と一致し、続けて 2 回取り消すと 1 つ前の操作へ遡る。
- Boundary: 照合後に新しい操作が割り込むと全ての文が 0 行で 409。
- Negative/auth/error/idempotency: 同じ id を 2 回送ると 2 回目は 409、古い id は 409、他人の id は 404、未認証 401。

## データモデル

- Entity/Value: freee_deal_exclusions (拡張)、total_cashflow_operations (新設)、duplicate_verdicts (既存)。一致度・区分・前期比・進捗は派生値で保存しない。
- Fields/Types/Nullability: freee_deal_exclusions に reason_code TEXT NOT NULL DEFAULT 'other' (CHECK で transfer/internal/book_only/duplicate/other) と memo TEXT を追加し、既存行は memo = reason、reason_code = 'other' に移す。reason 列は後方互換のため残す。total_cashflow_operations は id TEXT PRIMARY KEY、user_id TEXT NOT NULL、kind TEXT NOT NULL CHECK (verdict/exclude/restore/undo)、items_json TEXT NOT NULL、item_count INTEGER NOT NULL、undoes_id TEXT NULL、undone_at TEXT NULL、created_at TEXT NOT NULL。
- Relations/Constraints/Indexes: freee_deal_exclusions の主キー (user_id, freee_key)。total_cashflow_operations に索引 (user_id, created_at DESC)。
- Ownership/Retention/Migration: migration 0041 (番号は取込時点の main の最新 +1 で確定する) の追加のみ。操作履歴の保持は無期限で利用者の判断記録のみ。3 表をバックアップと復元の対象に加え、復元は 3 表を user_id 単位で入れ替える。

## 認証・認可

- Authentication: 既存セッション (PR #47、PBKDF2 は PR #52 で 100,000 回) と authGuard・mustChangePasswordFence を変えない。認証方式・セッション・レート制限の変更は無い。
- Authorization: 総収支専用の認証経路や新しい権限区分・共有機能を作らない。route 内では認証済み user_id だけを条件に読み書きする。
- Tenant/data boundary: 取消は user_id と id の組でしか引けず、他人の id は 404。

## エラー・例外・回復

- Error taxonomy: 入力検証 400 (件数超過は全体を拒否)、認証系は既存ゲートの 401/403、取消の不一致 409、他人・不存在の id 404、fence の lease 取得失敗 409 canonical_write_busy。前年同期の欠けはエラーではなく null と『比較データなし』。
- Retry/Timeout/Fallback: 部分成功は件数で通知し、失敗した項目は選択状態のまま残す。取消の 409 は列を空にして再読込を促す。
- Idempotency/Concurrency: 書込み 1 操作 = 更新と履歴 1 行を同じ D1 batch。取消は NOT EXISTS 条件付き文で、同じ id の再送・別タブの新しい操作・照合と batch のすき間の割り込みで意図しない操作を戻さない。復元と書込みは canonical-mutation-fence と invalidateJsonSnapshotQuery で重ねない。

## イベント・非同期処理

- Producer/Consumer: N/A: 非同期処理・キュー・イベントを追加しない。既存の毎日のバックアップ cron (0 18 * * *) は変えず、対象の列挙に 3 表を足すだけ。
- Delivery/Ordering/Deduplication/DLQ: N/A: 同上。キャッシュ無効化は書込み成功時に web 内で同期的に行う。

## 可観測性

- Logs/Metrics/Traces/Audit: 操作履歴 (total_cashflow_operations) が判定・除外・取消の監査記録を兼ねる。既存 requestId を使う。新しい監視や cron は足さない。
- Alert/SLO dashboard: N/A: 新しい監視対象を作らない。

## 互換性・移行・リリース

- Compatibility/versioning: GET /api/total-cashflow の既存フィールドを残す。旧 {reason} の除外 body を memo+other として受ける。reason 列を残し memo と同じ値を書くので旧 Worker が読んでも壊れない。
- Migration/backfill: 追加のみの migration で reason → memo・reason_code=other を移す。3 表をバックアップと復元へ加える箇所は 0040 の前例に揃える: JSON_SNAPSHOT_MUTATION_CONSUMERS、復元 write-set の DELETE と insertJsonRows、スナップショット SQL の行と件数、canonical-mutation-fence の consumers、routes/imports.ts の復元 payload の zod 検証と受け渡しと件数 (key は duplicateVerdicts・freeeDealExclusions・totalCashflowOperations)、書込み route からの invalidateJsonSnapshotQuery、schema-guard の EXPECTED_D1_MIGRATION。旧バックアップに key が無ければ null として既存の行を残し、key があれば空配列でもその集合で置き換え、形が不正なら復元全体を拒む。
- Rollout/rollback: migration を本番 Worker の配備より先に適用する既存のゲート (feat-deploy-migration-gate) を通す。問題があれば直前のビルドへ戻す。migration は追加のみなので既存データを失わない。

## テストと受入条件

- [ ] `AC-001`: S1 (G1): 画像の構成要素がすべて描画され、トークン・共通 Button/PageShell 経由で直書き色 lint 0 件。
- [ ] `AC-002`: S2 (G1, G3): 総合/事業/家計の KPI と前期比 (額・率) が core と一致し、総合 = 事業 + 家計。
- [ ] `AC-003`: S3 (G2): 単票・複数選択の同じ/別/除外ができ、判定後の総額が feat-total-cashflow の不変条件を満たす。
- [ ] `AC-004`: S4 (G4): 取消で総収入・総支出・判定件数が操作前と一致し、同じ取消を 2 回送っても 1 回分、再読込後は導線なし、既存の除外理由は migration 後メモとして読め、バックアップ復元で判定・除外・操作履歴が戻る。
- [ ] `AC-005`: S5 (G5): 規則が docs と境界値テストで固定され、サイドバーの支出分析 > 総収支 が現在地で照合バッジが要確認件数と一致する。
- [ ] `AC-006`: S6 (G1-G5): 既存の pnpm test / typecheck / lint と packages/web の check 系が緑。
- Contract/integration/e2e/security/performance: 消し込みの不変条件は packages/core/test/total-cashflow-contract.test.ts、判定の保存は packages/api/test/total-cashflow-verdict.integration.test.ts、画面は packages/web/test/total-cashflow-table.dom.test.tsx を緑のまま拡張する。境界値は日付差 3 日と 4 日、候補 1 件と 2 件、前年同期の月が 1 か月欠ける場合、続けて 2 回取り消す場合、同じ操作 id を 2 回送る場合、古い id を送る場合、唯一の候補を除外した月ずれ明細、除外前後の事業/家計の入れ替わり、自動一致の組で摘要だけが違う場合。check:financial-routes / check:mobile-layout の対象に /analysis/total-cashflow が含まれるかを確認し、無ければ追加する。文言変更 (防衛ライン・毎朝バックアップ) はその文言を期待値に持つテストを同じ変更で更新する。

## 未決事項

- 取消の 409 canonical_write_busy と 404 の画面の扱い: qa-frontend-web-tc-inference-004 は取消の 409 を一律に列を空にすると定めるが、fence の lease 取得失敗 (再試行すれば通る) と、別タブの復元後の古い id による 404 を区別していない (completeness-findings low)。次の elicit で置き換える候補。
- 変更箇所の数え漏れ: packages/api/src/import-lifecycle-pure.test.ts の consumers 列挙と route 列挙の期待値、routeSources への routes/total-cashflow.ts の追加、packages/api/src/db/schema.ts の列と表の追加が、db-inf-006 / be-inf-007 の変更箇所に挙がっていない (findings low)。
- 00-requirements-definition.md の承認 note が置換済みの qa-database-web-tc-inference-005 を指したまま (現行の根拠は qa-database-web-tc-inference-006) (findings low)。
- S4『同じ取消を 2 回送っても 1 回分しか戻らない』と『意図しない操作を戻さない』句が利用者に文として示されたかが承認 note に無い (findings low)。
- 除外を考えない候補が 2 件以上あり全部除外済みの明細は review に残る (be-inf-006) 点が decision-015 の含意とずれる余地、lastOperation の用途が未記載 (findings low)。
- 表記: 適用文と doctrine に『前期比』が残り『前年同期比』と混在する。security の適用文が 3 表バックアップの保護に触れていない (findings low)。
- qa-total-cashflow-decision-004 (D1 に残し再読込後も直前の操作を表示) と 017 (取消は画面を開いている間) の食い違いで、D1 に操作履歴を残す決め手が薄れている (findings low。018 で操作履歴をバックアップに含める選択がされている)。
- 確定 8 章に『未記入』注記が残る、OWASP ASVS の出典メモの転送記述 (findings low、判定に影響しない)。

## 確定意思決定

- `qa-total-cashflow-decision-001`: 既存 9 列月次表を『月次の内訳を表示』の開閉で残し既定は閉じる (他案: 画像どおり削除 / 常時表示のまま上に足す)。
- `qa-total-cashflow-decision-002`: 日付と金額の一致による自動寄せは維持し、一覧は確認用で『同じ取引にする』は same 判定の記録だけ (他案: 自動寄せをやめ判定まで要確認として隔離)。
- `qa-total-cashflow-decision-003`: 除外理由を理由区分 reason_code (振替/内部移動/帳簿のみ/二重登録/その他) とメモ memo に分け、既存の自由記述は memo と『その他』へ移行する (他案: 自由記述 1 列のまま画面で先頭語をバッジ風に見せる)。
- `qa-total-cashflow-decision-004`: 判定・除外・戻すを D1 の操作履歴に残す (他案: 画面のメモリ上だけで直前 1 件を保持)。
- `qa-total-cashflow-decision-006`: 前期比の比較対象は前年の同じ期間 (他案: 同じ長さの直前期間)。
- `qa-total-cashflow-decision-007`: 一致度は規則で算出して % と内訳を表示 (他案: 数値は出さない)。
- `qa-total-cashflow-decision-008`: 『同じ取引にする』は判定の記録だけ (他案: 確認するまで保留)。
- `qa-total-cashflow-decision-009`: 『集計から除外』は対応する freee 取引側 (他案: MF 明細の側に新しい除外を作る)。
- `qa-total-cashflow-decision-010`: 共通ヘッダー/フッターの文言を画像に揃える (他案: 現状のまま)。
- `qa-total-cashflow-decision-011`: サイドバーは表示の確認だけ (他案: 画像に合わせて直す)。
- `qa-total-cashflow-decision-012`: 自動一致の組の一致度は規則どおり計算して 78〜100% をそのまま表示 (他案: 常に 100%)。
- `qa-total-cashflow-decision-013`: 『元に戻す』は押すたびに 1 つ前の操作へ遡り、やり直しは無い (他案: 直前の 1 回だけ)。
- `qa-total-cashflow-decision-014`: 除外後の MF 明細は MF の公私仕分けに従う (他案: 除外した freee の事業/家計を引き継ぐ)。
- `qa-total-cashflow-decision-015`: 除外した freee が唯一の候補だった明細は要確認から出して集計へ (他案: 要確認に残す)。
- `qa-total-cashflow-decision-016`: 『完全一致候補』を『自動一致の候補』へ改名し上位概念にも反映 (他案: 画像の文言を残す)。
- `qa-total-cashflow-decision-017`: 取り消せるのはその画面を開いている間 (他案: 上限なし / 当日の操作だけ)。
- `qa-total-cashflow-decision-018`: 判定・除外・操作履歴の 3 表をバックアップに加える (他案: 判定と除外だけ加える / 加えない)。
