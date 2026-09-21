---
graph_node_id: "spec-classify-screen"
artifact_kind: "specification"
artifact_subtypes: ["frontend", "api"]
title: "明細仕分け画面 再現仕様 (13-classify.png)"
project_id: "kanjo"
domain: "classify"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["classify", "frontend", "api", "rules", "bulk-save"]
file_path: "specs/spec-classify-screen.md"
template_id: "specification"
template_version: "1.0.0"
source_image: "design/FINAL-UI/images/13-classify.png"
route: "/classify"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "976c5b04bf7ef1a291c764e5880123f7f5f4698e74c9ff11a07053f83dd8b5aa"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/00-requirements-definition.md", "source_version": "0.1.14", "source_digest": "976c5b04bf7ef1a291c764e5880123f7f5f4698e74c9ff11a07053f83dd8b5aa", "imported_at": "2026-09-19T14:03:38Z"}
created_at: "2026-09-19T14:03:38Z"
updated_at: "2026-09-19T14:03:38Z"
depends_on: []
related_nodes: ["arch-classify-ui-ux", "arch-classify-frontend", "arch-classify-backend", "arch-classify-database", "arch-classify-auth", "arch-classify-security", "arch-classify-infrastructure", "arch-classify-maintenance-ops"]
resource_scope: ["packages/core/src", "packages/api/src", "packages/web/src", "migrations", "docs/data-schema.md", "docs/ui-decisions.md", "design/FINAL-UI/images/13-classify.png"]
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
classification_reason: "13-classify.png の読み取りと利用者決定 (qa-classify-decision-001〜006、ui-ux-web-003、backend-web-003、database-web-001 ほか) から、画面構成・文言・分類ステータスの判定・API 契約・migration を確定した画面仕様であり、実装 (web / core / api / migrations) が参照する正本。agent 推定の値は本文で『agent 推定・利用者未確認』と注記した。"
classification_candidates: [{"artifact_kind": "specification", "confidence": 1.0, "candidate_path": "specs/spec-classify-screen.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-19T14:03:38Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---

# 明細仕分け画面 再現仕様 (13-classify.png)

この文書は `/classify`（明細仕分け、Focus Ledger）を `design/FINAL-UI/images/13-classify.png` どおりに作り直すための再現仕様である。後段の exact-13 実装計画は、この 1 本を画面・判定・API・migration の正本として参照する。

正本の優先順位は次のとおり。

1. `system-spec/` 配下（00-requirements-definition.md と 8 章）。本書と食い違ったら system-spec に従い、本書を直す。
2. 本書。
3. 画像 13-classify.png。画像の数値はモック（C6）で、画面に出す件数と金額は実データから core で算出する。画像の文言と system-spec の決定が食い違う欄は、§UI・状態遷移の「画像と決定の差分」表に置き換え先を示す。

注記の書き方: 利用者が確認していない agent の推定値には「(agent 推定・利用者未確認。根拠 qa-...)」を付ける。注記の無い値は、利用者決定か、既存コードまたは画像の観測値である。

## 目的と成功状態

### 目的

取り込んだ明細のうち自動では決まらなかったものを、利用者が「なぜその提案なのか」を確かめながら素早く確定できるようにする。同じ取引先が次から自動で決まるように、確定した内容をルールにできるようにする。まとめて保存して一部が失敗しても、何が失敗したかが分かり、失敗分だけやり直せるようにする。入力の途中で画面を離れても作業を失わないようにする（SH1）。

保守者（SH2）に対しては、分類ステータスの定義・信頼度の算出・ルールの適用規則を core の純関数 1 か所と docs・テストで固定する。ナビのバッジ・月次クローズ・仕分け画面の件数がずれないようにする。

### 成功状態（S1〜S6 を本画面の言葉で言い直したもの）

| ID | 成功状態 | 判定の場所 |
|---|---|---|
| S1 | `/classify` に 13-classify.png の構成要素がすべて描画される。色・余白・部品はトークンと共通部品を通し、直書き色の lint が 0 件。証憑欄は無く、『証憑は freee 側で管理します』の案内がある。期間内の明細が 0 件なら空状態になる。 | `packages/web/src/pages/classify/classify.dom.test.tsx`、lint |
| S2 | 同じ期間で 未整理 + 手動変更 + 完了 = 全件。要確認は未整理を超えない。ナビのバッジ・月次クローズの『仕分け』・画面の件数が同じ関数から出る。信頼度は全由来で 0〜100 の整数で、提案が無いときだけ null。外部送信は 0 件。 | `packages/core/src/classify-status.test.ts` |
| S3 | 一括保存の一部が失敗しても成功分は保存される。通知が成功件数と失敗件数を正しく示す。再試行は失敗分だけを送る。削除は元に戻せる。 | `packages/api/src/routes/classify-bulk.test.ts`、DOM テスト |
| S4 | ルール作成前のプレビューの件数・明細が、適用後に変わった明細と一致する。手動変更の明細は変わらない。分割ルールの行の和は元の金額に一致する。 | core 単体テスト、API 統合テスト |
| S5 | 保存フィルタと取引の履歴が D1 に残る。下書きは画面を再読込しても復元できる。migration は追加のみで、既存行の書き換えは 0 件。 | API 統合テスト、migration 検査、DOM テスト |
| S6 | 期間は usePeriod / localStorage から復元し、絞り込み・ページ・選択は URL に保つ。既存の仕分け・照合・月次クローズ・家計収支・総収支の数値テストは緑のまま。pnpm lint・typecheck・初期 JS 予算を CI で通す。 | CI |

## スコープ

### 対象（in）

- `/classify` の作り直し: 13-classify.png の全構成要素と、読込・空・失敗の各状態。`packages/web/src/pages/Classify.tsx`（1188 行の 1 ファイル）を `packages/web/src/pages/classify/` 配下へ分割する。
- core の分類ステータス判定 `classifyStatus` の新設（名前は I2 の仮称をそのまま採る）。
  - 未整理・手動変更・完了の 3 区分に排他で振り分ける。
  - 要確認を未整理の内訳として判定する。条件は、信頼度 80 未満・衝突・矛盾のいずれか。
  - 提案どおりに確定した明細の扱いを定める。
- 提案・信頼度・根拠の算出を `recommendationFor` の拡張に一本化する。
- ナビのバッジと月次クローズの『仕分け』を `classifyStatus` へ差し替える。
- API の変更。
  - `GET /api/transactions` を拡張する（期間・ステータス等の絞り込み、50 件ずつ、提案・信頼度・根拠・ステータス、KPI）。
  - 一括保存 API を新設する。
  - ルールのプレビュー API と適用 API を新設する（分割ルールを含む）。
  - 保存フィルタ API と取引の履歴 API を新設する。
  - `POST /api/rules` と `PUT /api/transactions/:txId/edit` を拡張する。
- migration `0046_classify_workbench.sql`（追加のみ）。
- 下書きの端末保存と復元、未保存のまま離れるときの確認、削除の『元に戻す』。
- docs への規則の明記と回帰テスト。
  - docs は `docs/data-schema.md` と `docs/ui-decisions.md`。
  - 明記する規則は、分類ステータス・信頼度・ルール適用。

### 対象外（out）

| 対象外 | 理由 |
|---|---|
| 領収書・証憑の添付と保管 | #42 で製品として廃止し、spec-v1.1 で freee 側の管理と定めた。今回も再導入しない（利用者決定 qa-classify-decision-001）。画面には案内文だけを置く。 |
| 外部 LLM による提案 | 取込データを外部へ送らない約束を守り、既存の決定論の規則を広げる（利用者決定 qa-classify-decision-003）。 |
| 共通シェル（サイドバー・ヘッダー・フッター・月次クローズの進捗表示）の見た目の作り直し | 既存の Layout をそのまま使う。変えるのはバッジと『仕分け』の件数の定義だけ。 |
| 取込処理・照合画面の変更 | 別画面の責務。照合側の明細を月次クローズの『仕分け』から除く現行の規則は保つ。 |
| スマートフォン等の専用アプリ | web のみ。狭い画面は既存 web のレスポンシブ規約の範囲で扱う。 |
| 画像ヘッダーの『取引ライン：正常』への文言変更 | 共通シェルの文言なので、既存の表示を保つ。 |
| サイドバーの『AI分析』『改善リクエスト』項目 | 共通シェルの既存項目で、本画面の範囲外。 |

## 用語と主体

| 用語 | 定義 |
|---|---|
| 明細 | 一覧の 1 行。母集団は現行 `GET /api/transactions` と同じ countableMfTxs。MF の明細・現金の行・分割の内訳行を含む。行の識別子は `rowKey` で、分割の内訳行は `parentTxId` と `lineId` を持つ。 |
| 分類ステータス | 明細を 3 区分に排他で振り分けた値。`unsorted`（未整理）/ `manual`（手動変更）/ `done`（完了）。 |
| 未整理 | 利用者・ルール・MF 中項目のどれもまだ区分を決めていない明細。提案の有無と信頼度は問わない。現行の `clsSrc === '既定'` と同じ集合になる。 |
| 手動変更 | 利用者が提案と異なる値で確定した明細。次も含む: 提案が無いまま利用者が決めた明細、この変更より前に手入力された明細。 |
| 完了 | 利用者が提案どおりに確定した明細と、ルール・MF 中項目が決めた明細。 |
| 要確認 | 区分ではなく、未整理の内訳。未整理の明細のうち、次のどれかに当たるもの: 提案の信頼度が 80 未満、提案どうしの衝突、区分と名義の矛盾。 |
| 提案（自動提案） | `recommendationFor` が返すカテゴリ・区分・所有者の組と、その由来。画面の表示は『自動提案』で、『AI』とは書かない（qa-classify-decision-003）。 |
| 由来（basis） | `vendor_memory`（過去の同取引先）/ `rule`（ルール）/ `mf_mid`（MF 中項目の対応表）/ `none`（提案なし）。 |
| 信頼度 | 0〜100 の整数。提案が無いときだけ null。 |
| 確定 | 利用者が区分・カテゴリ・所有者を保存すること。経路は編集パネル・クイック仕分け・一括保存。 |
| 提案一致フラグ | 確定した時点で、区分・カテゴリ・所有者のすべてが、その時点の提案と一致していたかを表す値。`tx_edits.matched_proposal` に保存する（列名は agent 推定・利用者未確認。根拠 qa-classify-database-web-003）。 |
| ルール | 取引先（任意）・キーワード・区分・カテゴリ・所有者・適用範囲・分割の型を持つ規則。 |
| 適用範囲（scope） | `all`（一致する明細すべて）/ `unconfirmed`（未確定の明細だけ）。 |
| 分割の型 | ルールが持つ分割の雛形。固定額の行と、残額の行 1 行で構成する。 |
| 保存したフィルタ | 名前付きで D1 に保存した絞り込み条件。 |
| 取引の履歴 | 明細ごとの変更記録（D1 の `tx_history`）。 |
| 下書き | 編集パネルの未保存の入力。端末の localStorage に明細単位で保存する。 |
| 主体: 利用者 | 個人事業主とその家族の家計を 1 人で管理する人（SH1）。セッションで識別し、すべての読み書きは利用者 id で区切る。 |
| 主体: 保守者 | 同一人物、および Claude Code などのコーディングエージェント（SH2）。 |

## ユースケースとユーザーフロー

### UC-1 未整理を根拠を見ながら確定する

1. 利用者はナビの『明細仕分け』を開く（バッジは未整理の件数）。
2. 期間は usePeriod の値（既定は直近 1 年、localStorage から復元）。分類ステータスの既定は『未整理』にチェックが入った状態。
3. 一覧の行を押すと、右の編集パネルにその明細が開く。行のチェックは一括選択にだけ使う（agent 推定・利用者未確認。根拠 qa-classify-ui-ux-web-002）。
4. 編集パネルで信頼度の根拠と取引の履歴を読み、クイック仕分け・カテゴリ・所有者・支払方法・メモを必要に応じて変える。
5. 保存前の案内として、編集パネルに『提案どおりに確定すると完了、提案と異なる値で確定すると手動変更になります』を出す。
6. 保存すると明細は完了または手動変更になり、KPI・一覧・バッジが更新される。

### UC-2 KPI から絞り込む

KPI カードを押すと、その分類ステータスだけに絞り込む（agent 推定・利用者未確認。根拠 qa-classify-ui-ux-web-002）。要確認カードを押すと、未整理のうち要確認の明細だけを出す。

### UC-3 まとめて確定する（一括保存）

1. 一覧で複数の行にチェックを入れる。画面下に一括操作バー『N 件選択中・選択をクリア・選択した N 件を保存』が出る。
2. 『選択した N 件を保存』を押すと、1 回の要求で保存する。
3. 全件成功したら通知『選択した N 件を保存しました。』を出す。
4. 一部が失敗したら、通知『選択した N 件のうち M 件を保存しました。K 件はエラーのため保存できませんでした。』と『失敗した K 件のみ再試行』を出す。
5. 再試行は失敗した明細だけを送る。成功分は取り消さない。

### UC-4 分割する

1. 編集パネルの『分割』を押すと、下段に『分割明細の編集』が開く。
2. 分割後の仕訳の行（カテゴリ・金額・所有者・メモ）を編集・追加・削除する。
3. 合計が元の金額と一致したときだけ『この内容で分割を適用』を押せる。
4. 保存には既存の `PUT /api/transactions/:txId/splits` を使う。

### UC-5 この条件をルールにする

1. 編集パネルの『この条件をルールにする』で、取引先・キーワード・適用範囲を選ぶ。
2. 『ルールを作成』を押すと、`POST /api/rules/preview` で作成前のプレビューを取得し、下段の『ルール適用プレビュー』に出す（この時点では何も保存しない）。
3. 分割明細の編集が開いているときは、その内容を分割の型としてルールに含められる。
4. 『このルールを適用』を押すと、ルールを保存して（`POST /api/rules`）、同じ判定で適用する（`POST /api/rules/:id/apply`）。手動変更の明細は上書きしない。

### UC-6 削除して元に戻す

1. 編集パネルの『削除』は ConfirmDialog で確認したうえで、既存の削除 API を呼ぶ（preflight → deletions）。
2. 通知『1件の明細を削除しました。』と『元に戻す』を出す。
3. 『元に戻す』は既存の `POST /api/data/undo/:operationId` を呼ぶ。

### UC-7 条件を保存して呼び出す

1. 左パネルの『＋ 現在の条件を保存』で名前を付けて保存する。
2. 『保存したフィルタ』から呼び出す。呼び出すと URL の絞り込みを置き換える。
3. 削除は保存したフィルタの行ごとに行う。
4. 『フィルタをクリア』は、分類ステータスを既定（未整理のみ）に戻し、ほかの絞り込みを外す。

### UC-8 下書きを失わない

1. 編集パネルへの入力は、入力が止まってから 1 秒後に localStorage へ自動保存し、『下書きを自動保存しました HH:MM』を出す。
2. 保存に成功したら下書きを消す。
3. 次に同じ明細を開くと『下書きを復元』を押せる。
4. 未保存のまま画面遷移・再読込・タブを閉じる操作をすると確認する。

## 機能要件

| ID | 要件 | ゴール |
|---|---|---|
| FR-01 | `/classify` は画面骨格（§UI・状態遷移 7.1）の全領域を描画する。 | G1 |
| FR-02 | 期間は usePeriod（1年 / 2年 / 3年 / 任意と期間送り）で選び、localStorage から復元する。現行の単月 select は廃止する。 | G1 |
| FR-03 | KPI 4 枚（未整理・要確認・手動変更・完了）の件数は、選択期間の明細について `classifyStatus` で数える。要確認カードには『未整理のうち』を添える。 | G1, G2 |
| FR-04 | 左の絞り込みパネルは次を持つ: 対象月（期間の表示）、分類ステータスのチェックと件数、カテゴリ、所有者、支払方法、手動変更のみ、キーワード検索、保存したフィルタ、『＋ 現在の条件を保存』、『フィルタをクリア』、折りたたみ。 | G1, G5 |
| FR-05 | 中央の取引一覧は次を持つ: 件数見出し『取引一覧（N件）』、表示件数 50 件、選択チェックと全選択、6 列（日付・取引先・内容・金額・提案カテゴリ・信頼度）、日付の並べ替え、ページ送り。サーバから 50 件ずつ受け取る。 | G1 |
| FR-06 | 未整理の行にも提案カテゴリと信頼度を出す。要確認に当たる行には『要確認』の文言を併記する。 | G2 |
| FR-07 | 右の編集パネルは §UI・状態遷移 7.6 の全欄を持つ。証憑欄は置かず、その位置に『証憑は freee 側で管理します』を出す。 | G1 |
| FR-08 | 確定したときは、提案一致フラグをサーバで計算して保存する。一致すれば完了、そうでなければ手動変更。 | G2 |
| FR-09 | 一括保存は 1 回の要求で最大 100 件を扱い、明細ごとに成否を返す。部分失敗でも成功分を確定する。 | G3 |
| FR-10 | 一括保存の結果を通知し、失敗分だけを再試行できる。 | G3 |
| FR-11 | 削除は既存の削除 API を使い、『元に戻す』で undo できる。 | G3 |
| FR-12 | ルールは取引先・キーワード・適用範囲・分割の型を持つ。作成前に、該当する明細・適用後の仕訳・件数をプレビューできる。プレビューと同じ判定で適用する。 | G4 |
| FR-13 | 編集パネルには、開いている明細に該当する既存のルールと、その対象件数を出す。 | G4 |
| FR-14 | 手動変更の明細は、ルールの作成・適用で変わらない。 | G4 |
| FR-15 | 保存したフィルタを D1 に保存・一覧・削除できる。 | G5 |
| FR-16 | すべての変更経路で、取引の履歴を 1 件ずつ残す。経路は 手動・一括保存・ルール・分割・削除・取消。編集パネルに新しい順で出す。 | G5 |
| FR-17 | 下書きを localStorage に明細単位で自動保存し、保存時刻を出す。保存に成功したら消す。『下書きを復元』で戻せる。未保存のまま離れるときは確認する。 | G5 |
| FR-18 | ナビのバッジと月次クローズの『仕分け』は、`classifyStatus` による未整理から数える。 | G2 |
| FR-19 | 変更系の API はすべて `canonicalMutationFence` の内側に置く。 | G3 |
| FR-20 | 一括保存・ルール作成・ルール適用・分割・削除と取消・保存フィルタの変更の後は、次の問い合わせを無効化して取り直す: 一覧・KPI・ナビのバッジ（`/review-queue`）・既存ルール・保存したフィルタ・開いている明細の履歴。 | G2, G5 |

## 非機能要件

| 区分 | 要件 |
|---|---|
| 性能 | 一覧はサーバ側で 50 件ずつ返す（C5）。KPI の件数は同じ要求で返し、画面で全件を持たない。ルールのプレビューは読取りだけで、表示期間（最大 3 年）の明細を 1 回の SQL で読む（agent 推定・利用者未確認。根拠 qa-classify-infrastructure-web-002）。 |
| コスト | Cloudflare 無料枠の範囲で動かす（D1 Free: 読取り 5M 行/日、書込み 100k 行/日、容量 5GB）。一括保存とルール適用の書込みは D1 batch にまとめ、1 回の batch は最大 50 文とする（agent 推定・利用者未確認。根拠 qa-classify-infrastructure-web-002）。R2・キュー・新しいバインディング・外部サービスは足さない。 |
| 初期 JS 予算 | 画面は lazy route に置き、初期 JS に含めない（agent 推定・利用者未確認。根拠 qa-classify-frontend-web-002）。CI の JS 予算は `build:bundle` の直後に測る。 |
| 決定論 | 提案・信頼度・ステータス・プレビューは、同じ Dataset・ルール・期間に対して常に同じ結果を返す。乱数と現在時刻に依存しない。例外は下書きの 30 日判定と、履歴の `changed_at`。 |
| 外部送信 | 取込データを外部へ送らない。外部 LLM を呼ばない。下書きはサーバへ送らない。 |
| アクセシビリティ | 信頼度と分類ステータスは色だけで区別しない。常に数値と文言を併記する。チェックボックス・ボタンには可視ラベルか `aria-label` を付ける。一括操作バーと通知は `role="status"`、エラーは `role="alert"` にする。 |
| レスポンシブ | 1024px 未満では 一覧 → 編集パネル → 絞り込み の順に縦積みし、絞り込みは折りたたんだ状態で始める（agent 推定・利用者未確認。根拠 qa-classify-ui-ux-web-002）。CI の headless Chrome は `pointer: none` なので、`@media (pointer: fine)` だけに頼る書き方をしない。 |
| デザイン | 色は `design-tokens.ts` 由来のトークンだけを使う。共通部品は PageHeader・KpiCard・PageState・Button・ConfirmDialog・PeriodPicker・Term。一括操作バーは画面専用の部品として `pages/classify/` に置く（C2）。 |
| 保守性 | 判定と集計は core に置き、api / web に重複実装しない（C1）。表示の整形は `pages/classify/view-model.ts` の純関数にする。 |

## UI・状態遷移

### 7.1 画面骨格

画像（1024x1536）を上から順に並べる。共通シェル（サイドバー・ヘッダー・フッター）は既存の Layout のまま。

```text
[共通ヘッダー] パンくず『整える / 明細仕分け』・最終更新・検索・ダウンロード・ヘルプ・アバター（既存）
[期間]       タブ 1年 / 2年 / 3年 / 任意 ・ 期間送り ‹ 2025年9月 - 2026年8月 ›          [明細仕分けの使い方]
[見出し]     明細仕分け
             未整理の明細を、根拠を見ながら確定しますか？
             説明文 2 行
[KPI]        未整理 | 要確認（未整理のうち） | 手動変更 | 完了
[本体 3 カラム]
  左: 絞り込み（«で折りたたみ）   中央: 取引一覧（N件）   右: 取引の編集パネル
[通知]       一括保存の結果 / 削除の結果（元に戻す）
[一括操作バー] N 件選択中 ・ 選択をクリア ・ 選択した N 件を保存 ・ ^
[下段 2 カラム] 左: 分割明細の編集    右: ルール適用プレビュー
[下書き]     下書きを自動保存しました HH:MM
[共通フッター]（既存）
```

ファイル構成（qa-classify-frontend-web-001）。

| ファイル | 責務 |
|---|---|
| `packages/web/src/pages/classify/ClassifyPage.tsx` | 画面の組み立て、問い合わせ、URL 状態 |
| `packages/web/src/pages/classify/view-model.ts` | 表示整形の純関数（件数文言、信頼度の文言、通知文、分割合計の文言など） |
| `packages/web/src/pages/classify/FilterPanel.tsx` | 左の絞り込み |
| `packages/web/src/pages/classify/TransactionTable.tsx` | 中央の一覧 |
| `packages/web/src/pages/classify/EditPanel.tsx` | 右の編集パネル |
| `packages/web/src/pages/classify/BulkActionBar.tsx` | 一括操作バー（画面専用） |
| `packages/web/src/pages/classify/ResultNotices.tsx` | 通知 2 種 |
| `packages/web/src/pages/classify/SplitEditorPanel.tsx` | 分割明細の編集。既存 `components/SplitEditor.tsx` の検証を再利用する。 |
| `packages/web/src/pages/classify/RulePreviewPanel.tsx` | ルール適用プレビュー |
| `packages/web/src/pages/classify/draft.ts` | 下書きの保存・読込・破棄 |
| `packages/web/src/pages/classify/classify.css` | 画面の CSS（トークンだけを使う） |
| `packages/web/src/pages/classify/classify.dom.test.tsx` | DOM テスト |

`routeMetadata.ts` の既存項目（id `classify`、label『明細仕分け』、navGroup『整える』、mobileLabel『仕分け』）は変えない。旧 `pages/Classify.tsx` は削除し、route は新しい `ClassifyPage` の lazy import に差し替える。

### 7.2 期間と見出しの文言（完全一致）

| 要素 | 文言 |
|---|---|
| パンくず | 整える / 明細仕分け |
| 期間タブ | 1年 / 2年 / 3年 / 任意（既定は usePeriod の保存値。初回は 1年） |
| 期間送り | ‹ {開始年}年{開始月}月 - {終了年}年{終了月}月 ›（画像の例: ‹ 2025年9月 - 2026年8月 ›） |
| 右上リンク | 明細仕分けの使い方（既存のヘルプ導線へ。遷移先は `docs/ui-decisions.md` に記す既存のヘルプ） |
| 見出し | 明細仕分け |
| 問い | 未整理の明細を、根拠を見ながら確定しますか？ |
| 説明文 1 行目 | 取引明細を確認し、適切な区分・カテゴリに仕分けて確定しましょう。 |
| 説明文 2 行目 | 自動提案を参考にしながら、必要に応じて手動で変更できます。（画像の『AIの提案』を『自動提案』に置き換える。qa-classify-decision-003） |

### 7.3 KPI 4 枚

KpiCard を 4 枚並べる。件数は `GET /api/transactions` の `kpi` をそのまま出し、画面で数え直さない。

| 順 | ラベル | 値の文言 | 補足の文言 | 押したとき |
|---|---|---|---|---|
| 1 | 未整理 | {n}件 | なし | `status=unsorted` だけに絞る |
| 2 | 要確認 | {n}件 | 未整理のうち | `status=review` だけに絞る |
| 3 | 手動変更 | {n}件 | なし | `status=manual` だけに絞る |
| 4 | 完了 | {n}件 | なし | `status=done` だけに絞る |

- 件数は 3 桁区切り（例: 1,024件）。
- 不変条件: 未整理 + 手動変更 + 完了 = 期間内の全件。要確認は未整理以下。
- 母集団: 選択期間に日付が入る一覧の行。分類ステータス以外の絞り込み（カテゴリ・所有者・支払方法・手動変更のみ・キーワード）を掛ける前の件数とする。
- 数える単位は一覧の行で、分割された明細は内訳行ごとに数える（agent 推定・利用者未確認。根拠 qa-classify-backend-web-003 からの導出。単位は system-spec に規定なし）。
- KPI を押して絞り込むのは agent 推定・利用者未確認（根拠 qa-classify-ui-ux-web-002）。

### 7.4 絞り込み（左パネル）

| 項目 | 文言・部品 | 値と URL パラメタ |
|---|---|---|
| パネル見出し | 絞り込み ・ « | 折りたたみの状態は URL に持たない。1024px 未満では閉じた状態で始める。 |
| 対象月 | 対象月 ／ 期間の表示（例: 2025年9月 - 2026年8月） | usePeriod と同じ値を読むだけで、ここでは変えない |
| 分類ステータス | 見出し「分類ステータス」。チェック 4 つ: 未整理 {n} ／ 要確認 {n} ／ 手動変更 {n} ／ 完了 {n} | `status` に `unsorted,review,manual,done` をカンマ区切りで持つ。既定は `unsorted` だけ（画像どおり）。件数は KPI と同じ値。 |
| カテゴリ | 既定表示: すべてのカテゴリ | `category`（大項目。候補は応答の `candidates`） |
| 所有者 | 既定表示: すべての所有者 | `owner`（既存の所有者ラベル） |
| 支払い方法 | 既定表示: すべての支払い方法。選択肢: 現金 / カード / 口座 / 不明 | `method`（`cash` / `card` / `account` / `unknown`） |
| 手動変更 | チェック: 手動変更された明細のみ | `manual=1`。意味は「分類ステータスが手動変更の明細」。 |
| キーワード検索 | placeholder: 取引先名・内容・メモで検索 | `q`（100 字以内）。取引先・内容・メモの部分一致で、大文字と小文字は区別しない。 |
| 保存したフィルタ | 見出し「保存したフィルタ」と、保存名の一覧（画像の例: 未整理の明細）。各行に削除ボタン（aria-label: 「{name}」を削除） | 押すと、保存した条件で URL を置き換える |
| 条件の保存 | ＋ 現在の条件を保存 | 押すと名前入力（1〜40 字）を開き、`POST /api/saved-filters` を呼ぶ |
| クリア | フィルタをクリア | `status=unsorted` だけを残して、ほかを外す |

ステータスの絞り込みの意味。

- 選ばれたステータスの和集合を出す。
- `review` は「未整理かつ要確認」の集合を表す。
- `unsorted` と `review` を両方選んだ場合は、未整理の全件になる。
- 何も選ばない状態は許さない。最後の 1 つは外せないようにする。

絞り込み・ページ・選択・並び・開いている明細は URL に保つ（qa-classify-frontend-web-001）。

- URL パラメタ: `status`、`category`、`owner`、`method`、`manual`、`q`、`sort`、`page`、`sel`、`tx`
- 期間は URL ではなく usePeriod が持つ。
- `sel` は選択中の rowKey のカンマ区切りで、最大 50 件（agent 推定・利用者未確認。根拠 qa-classify-frontend-web-002）。

### 7.5 取引一覧（中央）

| 要素 | 仕様 |
|---|---|
| 件数見出し | 取引一覧（{total}件）。`total` は絞り込み後の件数。 |
| 表示件数 | 表示件数 50件（固定表示。1 ページ 50 件、C5） |
| 列 | □（全選択）／ 日付 ↓ ／ 取引先 ／ 内容 ／ 金額 ／ 提案カテゴリ ／ 信頼度 |
| 日付 | YYYY/MM/DD。見出しを押すと昇順と降順を切り替える（`sort=date_desc` / `date_asc`）。 |
| 既定の並び | 日付の降順。同じ日付は取引 id の昇順（agent 推定・利用者未確認。根拠 qa-classify-ui-ux-web-002）。現行の「金額の絶対値の降順」は廃止する。 |
| 取引先 | `payee`（§ビジネスルール BR-12） |
| 内容 | `description`（MF の内容）。分割の内訳行は、元の内容の後ろに「（分割 {n}/{m}）」を添える。 |
| 金額 | {金額}円。3 桁区切り、右寄せ。支出も正の数で出す（画像どおり）。 |
| 提案カテゴリ | 提案の大項目（中項目があれば「大項目 / 中項目」）。提案が無ければ「提案なし」。確定済みの行は確定値を出す。 |
| 信頼度 | {n}%。null なら「—」。要確認の行は、要確認の色トークンで信頼度を出し、その隣に文言「要確認」を併記する。色だけでは区別しない。 |
| 行を押す | その明細を編集パネルに開く（URL の `tx`）。チェックは一括選択にだけ使う（agent 推定・利用者未確認。根拠 qa-classify-ui-ux-web-002）。 |
| 全選択 | 表示中のページの行だけを選ぶ。選択の上限は 50 件。 |
| ページ送り | 全{total}件 ‹ {page} › の形。前後のボタンは、端のページでは押せない。 |

### 7.6 取引の編集パネル（右）

上から次の順に並べる。

| 領域 | 文言・部品 | 仕様 |
|---|---|---|
| 見出し | 取引の編集 | |
| 未保存の印 | ● 未保存 | 入力が保存値と異なるときだけ出す |
| 閉じる | ×（aria-label: 編集を閉じる） | 未保存なら ConfirmDialog を出す |
| 基本情報 | {YYYY/MM/DD} の取引 ／ {取引先} ／ {金額}円 ／ {内容} | 読み取りだけ |
| 確定の案内 | 提案どおりに確定すると完了、提案と異なる値で確定すると手動変更になります。 | 保存前に常に出す（qa-classify-decision-006）。入力値が提案と一致するかを `view-model.ts` で判定し、「この内容で保存すると完了になります」または「この内容で保存すると手動変更になります」を 1 行添える。 |
| クイック仕分け | 見出し「クイック仕分け」。ボタン: 事業 / 個人 / リセット | 事業・個人は区分を入力に入れる（保存はしない）。リセットは入力を保存値へ戻す。 |
| カテゴリ | 見出し「カテゴリ」とセレクト | 大項目・中項目（既存の候補） |
| 所有者 | 見出し「所有者」とセレクト | 既存の所有者ラベル |
| 支払い方法 | 見出し「支払い方法」とセレクト（現金 / カード / 口座） | 未上書きのときは、機関名から導いた値を「（明細から判定）」付きで出す |
| 証憑の案内 | 証憑は freee 側で管理します | 画像の『領収書・証憑』欄の位置に置く。ファイル選択・アップロード部品は置かない。 |
| メモ | 見出し「メモ」と複数行入力、字数「{n}/200」 | 200 字を超える入力はさせない |
| 取引の履歴 | 見出し「取引の履歴」。各行: {YYYY/MM/DD HH:MM} {由来の文言} → {変更後の値}（信頼度 {n}%） | 新しい順。由来の文言は、自動提案 / 手動 / ルール / 一括保存 / 分割 / 削除 / 取消。画像の『自動提案（AI）』は『自動提案』にする。 |
| 信頼度の根拠 | 見出し「信頼度の根拠」と根拠の文 | `basisText`（BR-08） |
| 操作 | 編集 / 分割 / 削除 | 編集: 入力を保存する（確定）。分割: 下段の分割明細の編集を開く。削除: ConfirmDialog のあと、既存の削除 API を呼ぶ。 |
| ルール化 | 見出し「この条件をルールにする」。取引先（セレクト。候補は開いている明細の取引先）・キーワード（入力）・適用範囲（セレクト: 一致する明細すべて / 未確定の明細だけ）・『ルールを作成』 | 『ルールを作成』はプレビューを取得して、下段に出す（UC-5） |
| 既存ルール | 見出し「該当する既存のルール」。各行: {取引先 or キーワード} → {カテゴリ}（過去に{hits}件適用）。案内: ⓘ このルールを適用した場合、今後 {n}件の明細が対象となります。 | 既存 `GET /api/rules` の `hits` と、プレビュー API の件数を使う |

- 画像の『編集』ボタンは保存ボタンとして扱う。
- 押せる条件: 未保存の変更があること、または未整理の明細を提案どおりに確定する場合（入力が提案と同じでも押せる）。

### 7.7 通知

| 種類 | 文言（完全一致） | 操作 | 色 |
|---|---|---|---|
| 一括保存（全件成功） | 選択した{N}件を保存しました。 | × | 成功のトークン |
| 一括保存（部分失敗） | 選択した{N}件のうち{M}件を保存しました。{K}件はエラーのため保存できませんでした。 | 失敗した{K}件のみ再試行 ／ × | 成功のトークン（画像どおり） |
| 一括保存（全件失敗） | 選択した{N}件を保存できませんでした。 | 失敗した{N}件のみ再試行 ／ × | 危険のトークン |
| 削除 | {n}件の明細を削除しました。 | 元に戻す ／ × | 危険のトークン（画像どおり） |
| 取消の完了 | 削除を元に戻しました。 | × | 成功のトークン |

- 文言の組み立ては `view-model.ts` の純関数 `bulkResultMessage(n, m, k)` と `deleteMessage(n)` に置く。
- 全件失敗の文言は、部分失敗の文言の K=N の場合に当たる。画像に無いので、画像の部分失敗の文を基に整えた（agent 推定・利用者未確認。根拠 qa-classify-ui-ux-web-003 からの導出）。
- 明細ごとのエラー理由は、通知の下の折りたたみに「{日付} {取引先}: {理由の文言}」で並べる。

### 7.8 一括操作バー

| 要素 | 文言 | 仕様 |
|---|---|---|
| 件数 | {N} 件選択中 | 選択が 1 件以上のときだけ、バーを画面下に出す |
| クリア | 選択をクリア | `sel` を空にする |
| 保存 | 選択した{N}件を保存 | `POST /api/transactions/bulk`。実行中は押せない。 |
| 開閉 | ^（aria-label: 選択中の明細を表示） | 選択中の明細の一覧を開く |

各明細で送る値。

- 下書きがある明細は、下書きの値を送る。
- 下書きが無い明細は、その明細の現在の提案（区分・カテゴリ・所有者）を送る。
- 提案が無く、下書きも無い明細は、送らずに「提案が無いため保存できません」として失敗に数える。

この送る値の決め方は agent 推定・利用者未確認（根拠 qa-classify-backend-web-002。一括保存の中身は system-spec に規定なし）。

### 7.9 分割明細の編集（下段左）

| 要素 | 文言 |
|---|---|
| 見出し | 分割明細の編集 |
| 説明 | 1つの取引を複数の科目に分割して仕訳できます。 |
| 元の取引 | 見出し「元の取引」 ／ {YYYY/MM/DD} ／ {取引先} ／ {内容} ／ {金額}円 |
| 表見出し | 分割後の仕訳 |
| 列 | # ／ カテゴリ ／ 金額 ／ 所有者 ／ メモ ／ 操作（ごみ箱。aria-label: {n}行目を削除） |
| 追加 | ＋ 分割行を追加 |
| 一致表示（一致） | 金額の合計が元の取引金額と一致しています。({a}円 + {b}円 = {total}円) |
| 一致表示（不一致） | 金額の合計が元の取引金額と一致していません。(合計 {sum}円 ／ 元の金額 {total}円 ／ 差額 {diff}円) |
| ボタン | キャンセル ／ この内容で分割を適用 |

- 行数の下限と上限は、既存の `MIN_SPLIT_LINES` / `MAX_SPLIT_LINES` に従う。検証は既存の `validateSplits` を使う。
- 一致しないときは『この内容で分割を適用』を押せない。
- 保存は既存の `PUT /api/transactions/:txId/splits`（行の全体を差し替える）。
- 不一致の文言は画像に無い。一致の文言に対になるよう整えた（agent 推定・利用者未確認。根拠 qa-classify-ui-ux-web-003 からの導出）。

### 7.10 ルール適用プレビュー（下段右）

| 要素 | 文言 |
|---|---|
| 見出し | ルール適用プレビュー |
| 説明 | 同じ条件に合致する、今後の取引への適用予定です。 |
| 件数バッジ | 今後 {n} 件に適用 |
| 列 | 日付 ／ 取引先 / 内容 ／ 金額 ／ 適用後の仕訳 |
| 適用後の仕訳 | 分割しない場合は「{カテゴリ}」。分割する場合は「{カテゴリ1} {金額1}円 / {カテゴリ2} {金額2}円」。 |
| 行数の上限 | 最大 50 行。超えた分は出さず、「ほか {n} 件」とだけ示す（agent 推定・利用者未確認。根拠 qa-classify-ui-ux-web-002） |
| 案内 | 上記の {n} 件の取引に対して、同じ分割内容を自動で適用できます。（分割の型が無いルールでは「同じ仕分けを自動で適用できます。」） |
| ボタン | このルールを適用 ／ 下書きを復元 |
| 空 | 該当する明細はありません。（『このルールを適用』は押せる。ルールだけを保存する。） |

『下書きを復元』は、開いている明細の下書きが localStorage にあるときだけ押せる。押すと、下書きを編集パネルに戻す。

### 7.11 下書きの表示と離脱確認

- 表示: 下書きを自動保存しました {HH:MM}（端末の現地時刻）。
- 保存先: localStorage のキー `kanjo:classify:draft:{txId}`。分割の内訳行は親の txId に付ける。
- 保存の時機: 入力から 1 秒後。
- 読込時: 30 日を過ぎた下書きは捨てる。
- 保存先・時機・30 日の値は agent 推定・利用者未確認（根拠 qa-classify-frontend-web-002）。
- localStorage の読み書きはすべて try/catch で包む。失敗したら下書きの表示を出さず、画面は動き続ける。
- 離脱確認: 未保存の入力があるとき、react-router の `useBlocker` と `beforeunload` の両方で確認する（agent 推定・利用者未確認。根拠 qa-classify-frontend-web-002）。
  - 確認の文言: 保存していない変更があります。このまま移動しますか？
  - ボタン: 移動する ／ とどまる

### 7.12 画面の状態

| 状態 | 条件 | 表示 |
|---|---|---|
| 読込 | 一覧の初回取得中 | PageState の読込表示。KPI はスケルトン。期間タブは操作できる。 |
| 空（期間内 0 件） | 期間内の明細が 0 件 | PageState の空表示「この期間の明細はありません。」と、データ取込への導線。KPI は 0件。 |
| 絞り込み結果 0 件 | 期間内にはあるが、絞り込み後が 0 件 | 一覧の位置に「条件に合う明細はありません。」と『フィルタをクリア』 |
| 失敗 | 一覧の取得が失敗（5xx・ネットワーク） | PageState の失敗表示「明細を読み込めませんでした。」と『再読み込み』 |
| 編集パネル未選択 | `tx` が無い | 「明細を選ぶと、ここで編集できます。」 |
| 編集パネルの明細が見つからない | `tx` の行が 404 | 「この明細は見つかりませんでした。」。`tx` を URL から外す。 |

- 空状態・失敗状態の文言は画像に無い。既存画面（家計収支・サブスク）の文言の型に合わせた（agent 推定・利用者未確認。根拠 qa-classify-ui-ux-web-003 からの導出）。
- 空と失敗の状態があること自体は利用者決定。

### 7.13 状態遷移

分類ステータスの遷移（サーバの状態）。

| 現在 | 操作 | 遷移先 |
|---|---|---|
| 未整理 | 提案どおりに確定（編集・クイック仕分け・一括保存） | 完了 |
| 未整理 | 提案と異なる値で確定、または提案が無いまま確定 | 手動変更 |
| 未整理 | 該当するルールを作成（scope に合う） | 完了 |
| 未整理 | 分割を適用（利用者） | 各内訳行が手動変更 |
| 未整理 | 分割の型を持つルールを適用 | 各内訳行が完了 |
| 完了 / 手動変更 | 再度確定 | 確定時の提案一致フラグで、完了か手動変更に決まる |
| 完了 / 手動変更 | リセットして保存（手当てを消す） | ルール・MF 中項目の判定に戻る（完了か未整理） |
| 任意 | 削除 | 一覧から消える（件数からも除く） |
| 削除済み | 元に戻す | 削除前の状態 |

編集パネルの UI 状態: 閉 → 表示（保存値）→ 編集中（● 未保存、下書き保存）→ 保存中 → 表示（保存値、下書き消去）。保存が失敗したら、編集中のまま戻し、エラーを出す。

### 7.14 画像と決定の差分（画像の算術が閉じない欄を含む）

画像の数値はモック（C6）。次の欄は画像どおりに再現せず、右列に従う。

| 画像の欄 | 画像の値 | 閉じない理由・食い違う決定 | 実装での扱い |
|---|---|---|---|
| KPI 要確認 | 5件 | 一覧の 12 件のうち信頼度 80% 未満は 4 件（78・76・68・74）で、5 と合わない。衝突・矛盾の行が画像から読めない。 | 実データから `classifyStatus` で数える |
| KPI 合計 | 未整理 12 ／ 手動変更 3 ／ 完了 1,024 | 全件は 12 + 3 + 1,024 = 1,039 のはずだが、画像に全件の表示が無く検算できない。 | 不変条件（和 = 全件）をテストで固定する |
| 一覧の日付 | 2026/09/01〜09/10 | 表示期間 2025年9月 - 2026年8月 の外にある。 | 期間内の明細だけを出す |
| 一覧の日付の並び | 2026/09/01 のあとに 2025/09/30 | 年をまたいで降順が崩れて見える（画像のモック）。 | 日付の降順、同じ日付は取引 id の昇順 |
| 金額 | 一覧 5,440円 ／ 編集パネル 5,400円 | 同じ明細の金額が一致しない。 | 同じ行の `amount` を両方に出す |
| 取引先の表記 | 一覧 A商事(株) ／ 編集パネル A 商事（株） | 表記揺れ。 | 同じ `payee` を出す |
| 証憑欄 | receipt_20260910.jpg ／ ＋ 証憑を追加 ／ JPG, PNG, PDF（最大10MB） | #42 で廃止（qa-classify-decision-001） | 『証憑は freee 側で管理します』だけを出す |
| 説明文 | AIの提案を参考にしながら | 『AI』と書かない（qa-classify-decision-003） | 自動提案を参考にしながら |
| 履歴 | 自動提案（AI） | 同上 | 自動提案 |
| 支払い方法 | クレジットカード | 既存のラベルは カード（`PAYMENT_METHOD_LABEL`） | カード |
| 適用範囲 | 残りの一致する明細すべて | 選択肢は「一致する明細すべて / 未確定の明細だけ」（G4） | 一致する明細すべて ／ 未確定の明細だけ |
| 既存ルール | A商事 → 事務用品（過去に3件適用） と、今後 8件 | 既存ルールの件数と、下段プレビューの 8 件（ホテルの分割ルール）が別のルールを指しており、つながらない。 | 開いている明細に該当するルールごとに、実際の `hits` とプレビュー件数を出す |
| ルール適用プレビュー | 2026/09/14〜2026/11/05 の 8 件（「今後」） | 表示期間の外で、しかも未来の日付。 | 表示期間内の明細を対象にする（qa-classify-security-web-002 の agent 推定: プレビューは表示期間の明細だけを走査）。見出しの「今後 N 件」は ui-ux の決定文言なので保つ。 |
| プレビューの分割 | 12,000円 → 旅費交通費 8,000円 / 会議費 4,000円。10,800円 → 8,000 / 2,800。9,800円 → 8,000 / 1,800。 | 固定額 8,000 円の行と残額の行の型と算術が一致する。 | 分割の型の規則（BR-10）どおりに計算する。算術は閉じている。 |
| 分割明細 | 8,000円 + 4,000円 = 12,000円 | 算術が閉じている。 | そのまま再現できる |
| ヘッダー | 取引ライン：正常 | 既存の共通シェルは『防衛ライン：正常』 | 共通シェルは変えない（対象外） |
| サイドバーのバッジ | 明細仕分け 12 | 未整理の件数で、KPI の未整理と同じ値だが、母数（全期間）が画面の KPI（選択期間）と異なる（BR-06）。 | 別の母数から出るので、同じ値になるとは限らない |
| 月次クローズの進捗 | 3/4（仕分け ✓） | 未整理が 12 件あるのに ✓ | 月次クローズの判定（BR-07）に従う |

## ビジネスルールと検証

以下は core の純関数として `packages/core/src/classify-status.ts`（新設）と `packages/core/src/overview.ts`（`recommendationFor` の拡張）に置く。api と web は再実装しない。

| ID | 規則 |
|---|---|
| BR-01 | 3 区分の判定 `classifyStatus(resolved, edit)` は次の順に決める（qa-classify-backend-web-003）。 (a) `clsSrc === '既定'` なら `unsorted`。 (b) `clsSrc === 'ルール'` または `'中項目'` なら `done`。 (c) `clsSrc === '手動'` で、`edit.origin === 'manual'` なら、`edit.matched_proposal === 1` のときだけ `done`。それ以外（0 または null）は `manual`。null を手動変更にするのは、既存の手入力の明細を手動変更として扱う決定による（qa-classify-database-web-003 の agent 推定）。 (d) `clsSrc === '手動'` で `edit.origin === 'vendor_memory'` なら、`matched_proposal` の値にかかわらず `done`。取込時に既存の承認済みの取引先メモリが自動適用した決定であり、通常の手入力とは由来が異なるためである（Q-1 解決済み）。 各明細はちょうど 1 区分に入る。 |
| BR-02 | 未整理は `clsSrc === '既定'` と同じ集合にする。これにより、月次クローズの『仕分け』の意味（現行の clsSrc=既定）を変えない。 |
| BR-03 | 要確認 `needsReview` は、未整理の明細にだけ立てる。条件は次のどれか。 (a) 提案の信頼度が 80 未満（79 は要確認、80 は要確認でない）。 (b) 衝突がある（BR-05）。 (c) 矛盾がある（BR-05）。 提案が無い（信頼度 null）未整理の明細は要確認に数えない。要確認は「提案があって、その提案を疑うべき明細」だからである（agent 推定・利用者未確認。根拠 qa-classify-decision-002 からの導出）。 完了の明細（ルール・MF 中項目由来）の信頼度は表示にだけ使い、要確認には数えない。 |
| BR-04 | 信頼度（agent 推定・利用者未確認。根拠 qa-classify-backend-web-002）。 ・vendor_memory 由来: 既存の値 `Math.round(vendorConfidence(memory) * 100)` ・取引先とキーワードの両方が一致するルール: 95 ・キーワードだけのルール: 85 ・MF 中項目の対応表: 70 ・提案なし: null 値は常に 0〜100 の整数に丸めて収める。 |
| BR-05 | 衝突と矛盾（agent 推定・利用者未確認。根拠 qa-classify-backend-web-002）。 衝突: 2 つ以上の由来が、異なるカテゴリを提案すること。衝突時は、提案（優先順の先頭）の信頼度を「関与した由来の信頼度の最小値 − 20」に置き換え、下限は 0 とする。 矛盾: 提案の区分と所有者が合わないこと。区分=個人 かつ 所有者=事業、または 区分=事業 かつ 所有者が事業以外。 由来の優先順は既存の BR-006 のとおり、vendor_memory → ルール → MF 中項目 → なし。 |
| BR-06 | ナビのバッジ: 全期間（既存の `/review-queue`、BR-002）で、保留を除いた未整理の件数。判定関数は `classifyStatus`。画面の KPI は選択期間で数えるので、バッジと同じ値になるとは限らない。 |
| BR-07 | 月次クローズの『仕分け』: バッジと同じ判定の未整理から、次を除いた件数。現行の `counts.classification` と同じ値になり、現行の意味を変えない。 ・照合側で数える明細 ・現金の行 ・`isMfCountable` の外 ・`splitProjection` のある明細 |
| BR-08 | 根拠の文 `basisText` は由来ごとに組み立てる（既存の `basisLabel` を広げる）。 ・vendor_memory: 過去に同じ取引先を「{カテゴリ}」として仕分けた事例が{hit}件あります。（全{total}件中） ・ルール: ルール「{keyword}」（取引先「{payee}」）に一致しています。 ・MF 中項目: MF の中項目「{mid}」から「{カテゴリ}」を提案しています。 ・提案なし: 提案に使える過去の事例・ルール・中項目がありません。 ・衝突時は、末尾に「別の根拠が「{カテゴリ}」を提案しているため、信頼度を下げています。」を足す。 ・矛盾時は、末尾に「区分と所有者が一致していません。」を足す。 文言は画像の根拠文の型に合わせた（agent 推定・利用者未確認。根拠 qa-classify-backend-web-002）。 |
| BR-09 | 提案一致フラグの計算はサーバで行う。確定の要求を受けたとき、その時点の提案と、保存後の値を比べる。比べる値は、区分（cls）・カテゴリ（大項目と中項目）・所有者の 3 つ。すべてが一致すれば 1、1 つでも異なるか提案が無ければ 0 を保存する（qa-classify-decision-006）。 クライアントが送った一致の値は信用しない。 メモ・支払方法・機関名だけの保存は確定ではないので、フラグを変えない。 |
| BR-10 | 分割の型: 固定額の行を 1 行以上と、残額の行を 1 行。 適用後の行は、固定額の行の金額をそのまま使い、残額の行の金額は「元の金額 − 固定額の合計」とする。 残額が 0 以下になる明細は、プレビューで「分割できません（金額が固定額の合計以下）」とし、適用の対象から外す。 行の和は常に元の金額に一致する。 |
| BR-11 | ルールの対象の判定 `ruleTargets(rule, rows)`（プレビューと適用が共有する 1 つの関数）。一致の条件は次の 2 つ。 ・キーワードが既存の `ruleMatches`（`c`・`big`・`mid` を大文字化した文字列の部分一致）で一致すること。 ・`payee` があれば、`normalizeVendorKey(content) === payee` であること。 次の明細は対象から外す。 ・手動変更の明細（BR-01 の `manual`） ・`scope === 'unconfirmed'` の場合は、未整理以外の明細 ・分割の型を持つルールの場合は、すでに分割済みの明細 ・削除済みの明細 完了の明細のうち、利用者が確定したもの（`origin=manual` かつ `matched_proposal=1`）も対象から外す。利用者の確定をルールで変えないためである（agent 推定・利用者未確認。根拠 qa-classify-backend-web-003「手動変更した明細はルールで上書きしない」からの保守的な導出）。 |
| BR-12 | 取引先 `payee` の表示値は `normalizeVendorKey(content)` の結果とする。キーを作れない明細は、内容をそのまま出す。ルールの `payee` も同じ正規化キーで持つ（agent 推定・利用者未確認。根拠 qa-classify-backend-web-002。MF の明細に取引先の独立した列が無いため）。 |
| BR-13 | 支払方法は `tx_edits.payment_method` があればそれを使い、無ければ既存の `paymentMethodOf`（機関名から導く）を使う（利用者決定 qa-classify-database-web-001）。上書きできる値は `cash` / `card` / `account` で、`unknown` は上書きの値にしない。 |
| BR-14 | 入力の検証（zod。agent 推定・利用者未確認。根拠 qa-classify-security-web-002）。 ・メモ: 200 字以内 ・フィルタ名: 1〜40 字 ・キーワード（検索）: 100 字以内 ・ルールのキーワード: 既存どおり 1〜100 字 ・保存するフィルタの条件 JSON: 2000 字以内 ・一括保存: 1〜100 件 ・保存フィルタ: 利用者あたり 20 件まで（agent 推定・利用者未確認。根拠 qa-classify-database-web-002） 範囲を外れたら 400。 |
| BR-15 | 履歴 `tx_history` は、変わった項目ごとに 1 行を書く。 ・項目: `cls` / `category` / `owner` / `payment_method` / `note` / `split` / `deleted` ・行ごとに持つ値: 変更前の値、変更後の値、由来 `source`（`auto` / `manual` / `rule` / `bulk` / `split` / `delete` / `undo`） ・同じ要求で書いた行は、同じ `op_id` を持つ。 ・値が変わらない保存では、行を書かない。 ・`auto` は、取込時に vendor_memory が materialize したとき、および提案どおりの確定（BR-09 で一致）のときに使う。 `source` の値の集合は agent 推定・利用者未確認（根拠 qa-classify-database-web-002）。`auto` を提案どおりの確定に使う点は、画像の履歴『自動提案 → 事務用品（信頼度 92%）』からの agent 推定（利用者未確認。根拠 qa-classify-ui-ux-web-003）。 |

## API契約

共通の前提。

- すべて `/api/*` の配下で、次の順に通る: authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence（`packages/api/src/index.ts`）。
- 利用者 id は `c.get('userId')` から取り、本文や URL からは受け取らない。
- ルートは既存の `packages/api/src/routes/classify.ts` に置く。一括保存・保存フィルタ・履歴は、行数が大きくなるので `routes/classify-bulk.ts`・`routes/saved-filters.ts` に分けて、`index.ts` で `/api` にマウントしてよい。

| 区分 | method | path | 状態 |
|---|---|---|---|
| 読取り | GET | /api/transactions | 拡張 |
| 変更 | PUT | /api/transactions/:txId/edit | 拡張 |
| 変更 | POST | /api/transactions/bulk | 新設 |
| 読取り | GET | /api/transactions/:txId/history | 新設 |
| 変更 | POST | /api/rules | 拡張 |
| 読取り（副作用なし） | POST | /api/rules/preview | 新設 |
| 変更 | POST | /api/rules/apply | 新設（ルール作成とプレビュー結果の適用を一括） |
| 変更 | POST | /api/rules/:id/apply | 新設 |
| 読取り | GET | /api/saved-filters | 新設 |
| 変更 | POST | /api/saved-filters | 新設 |
| 変更 | DELETE | /api/saved-filters/:id | 新設 |
| 変更 | PUT | /api/transactions/:txId/splits | 既存を再利用（契約は変えない。履歴の書込みだけを足す） |
| 変更 | POST | /api/data/deletions/preflight、/api/data/deletions | 既存を再利用（granularity `transaction`。履歴の書込みだけを足す） |
| 変更 | POST | /api/data/undo/:operationId | 既存を再利用（履歴の書込みだけを足す） |

新設の変更系は、`canonical-mutation-fence.ts` の `CANONICAL_MUTATION_ROUTES` に登録する（agent 推定・利用者未確認。根拠 qa-classify-security-web-002）。

- `POST /api/transactions/bulk`: tx_edits・tx_splits・tx_history
- `POST /api/rules/apply`、`POST /api/rules/:id/apply`: rules・tx_edits・tx_splits・tx_history
- `POST /api/saved-filters`、`DELETE /api/saved-filters/:id`: saved_filters
- `PUT /api/transactions/:txId/edit` は既存の登録に tx_history を足す。
- `POST /api/rules` は、既存の登録があればそれに従う。無ければ rules を登録する。
- `POST /api/rules/preview` は読取りだけなので登録しない。

### API: 明細一覧の取得（GET /api/transactions、拡張）

#### 識別と目的

- `GET /api/transactions`。仕分け画面の一覧・KPI・絞り込み候補を 1 回で返す。
- 変更点は次のとおり。
  - 単月の `month` に加えて、期間 `from` / `to` を受ける。
  - 分類ステータスの絞り込み、並び、ページを足す。
  - 各行に、提案・信頼度・根拠・ステータス・要確認を足す。
  - KPI を返す。
- 既存の呼出し元（`month` を使う画面）は壊さない。

#### 認証・認可

- セッション必須。未認証は 401。
- 利用者 id で区切り、他の利用者の明細は母集団に入らない。
- 読取りなのでフェンスの対象外。

#### Request

| query | 型 | 必須 | 説明 |
|---|---|---|---|
| from | `YYYY-MM` | from/to か month のどちらか | 期間の開始月（その月を含む） |
| to | `YYYY-MM` | 同上 | 期間の終了月（その月を含む）。from 以上で、36 か月以内。 |
| month | `YYYY-MM` | 同上 | 既存の単月指定。from=to=month と同じ意味。 |
| status | `unsorted,review,manual,done` のカンマ区切り | 任意 | 省略時はすべて |
| category | string（60 字以内） | 任意 | 大項目の完全一致 |
| owner | string | 任意 | 既存の owner の値 |
| method | `cash` / `card` / `account` / `unknown` | 任意 | 支払方法（BR-13） |
| manual | `1` | 任意 | 手動変更のみ（status に `manual` を足すのと同じ） |
| q | string（100 字以内） | 任意 | 取引先・内容・メモの部分一致 |
| sort | `date_desc` / `date_asc` | 任意 | 既定は `date_desc` |
| page | 1 以上の整数 | 任意 | 既定 1 |
| limit | `50` | 任意 | 50 だけを受ける（C5） |

既存の `cls` パラメタは受け続ける（互換）。新しい画面は使わない。

#### Response

200 `application/json`。

| フィールド | 型 | 説明 |
|---|---|---|
| rows | 配列 | 絞り込み・並び・ページ後の最大 50 行 |
| rows[].（既存の項目） | | id, rowKey, rowKind, parentTxId, lineId, capabilities, date, description, amount, institution, paymentMethod, csvBig, csvMid, big, mid, catSrc, cls, src, owner, ownerSrc, edited, conflict, origin, scopeMismatch, edit。値の意味は変えない。 |
| rows[].payee | string | 取引先の表示値（BR-12） |
| rows[].paymentMethodSource | `edit` / `derived` | 支払方法が上書き値か、機関名から導いた値か |
| rows[].suggestion | object または null | 提案。`{ cls, big, mid, owner, label }`。提案なしは null。 |
| rows[].confidence | 0〜100 の整数 または null | 信頼度（BR-04・BR-05） |
| rows[].basis | `vendor_memory` / `rule` / `mf_mid` / `none` | 由来 |
| rows[].basisText | string | 根拠の文（BR-08） |
| rows[].status | `unsorted` / `manual` / `done` | 分類ステータス（BR-01） |
| rows[].needsReview | boolean | 要確認（BR-03）。status が unsorted 以外なら常に false。 |
| rows[].reviewReasons | 配列（`low_confidence` / `conflict` / `contradiction`） | 要確認の理由 |
| rows[].note | string または null | メモ |
| total | integer | 絞り込み後の件数 |
| page / limit | integer | 返したページと 50 |
| kpi | object | `{ all, unsorted, review, manual, done }`。期間内で、ステータス以外の絞り込みを掛ける前の件数。`unsorted + manual + done = all`。 |
| summary / candidates / institutions | | 既存と同じ |

#### Validation・ビジネスルール

- query は zod で検証する。
  - from が to より後、期間が 36 か月を超える、limit が 50 以外、q が 100 字を超える、status に未知の値がある: いずれも 400。
- status・needsReview・confidence は core の `classifyStatus` と `recommendationFor` から出す。route で計算し直さない。

#### Error contract

| HTTP | code | 条件 | クライアントの扱い |
|---|---|---|---|
| 400 | `invalid_query` | query の検証に失敗 | 絞り込みを既定に戻し、再取得する |
| 401 | `unauthorized` | 未認証 | 既存のログイン画面へ |
| 403 | `password_change_required` | mustChangePasswordFence | 既存の変更画面へ |
| 503 | `schema_not_ready` | runtimeSchemaGuard（migration 未適用） | 失敗状態を出す |
| 500 | `internal` | その他 | 失敗状態と『再読み込み』 |

エラーの本文は既存の `{ error: code, message }` の形に揃える。

#### 実行セマンティクス

- 読取りだけで、副作用は無い。
- 同じ入力には同じ出力を返す（決定論）。
- 並びが安定するように、同じ日付は取引 id の昇順で並べる。

#### キャッシュ・ページング

- オフセット方式で、`page` と `limit=50`。
- TanStack Query のキーは `['classify', 'transactions', period, filters, sort, page]`。
- FR-20 の操作の後に無効化する。
- HTTP キャッシュは使わない（既存の `Cache-Control: no-store` に従う）。

#### 可観測性と監査

- 既存の要求ログに、次を出す: 経路・所要時間・行数（total）。
- q や明細の内容はログに出さない。

#### セキュリティ確認

- 利用者で区切る（全 SQL に `user_id` 条件）。
- `q` は SQL にパラメタで渡し、文字列を連結しない。
- 応答は React の既定エスケープで描画する。

#### Contract tests

`packages/api/src/routes/classify-bulk.test.ts` の一覧の節で確かめる。

- 期間指定で、期間外の行が出ない。
- `kpi.unsorted + kpi.manual + kpi.done = kpi.all`。
- `kpi.review` は `kpi.unsorted` 以下。
- `status=review` で返る行は、すべて `needsReview=true` かつ `status=unsorted`。
- 51 件の fixture で、page=2 が 1 件を返す。
- 並びは日付の降順、同じ日付は id の昇順。
- confidence は 0〜100 の整数か null。null は basis=none のときだけ。
- 未認証は 401。
- 他の利用者の行が出ない。

### API: 明細の編集・確定（PUT /api/transactions/:txId/edit、拡張）

#### 識別と目的

- `PUT /api/transactions/:txId/edit`。編集パネルの保存（確定）とクイック仕分けの保存。
- 既存の本文に、`paymentMethod` を足す。
- サーバで提案一致フラグを計算して保存し、履歴を書く。

#### 認証・認可

- セッション必須。
- 他の利用者の txId、または存在しない txId は 404（agent 推定・利用者未確認。根拠 qa-classify-auth-web-002）。
- フェンスに登録済み（tx_history を足す）。

#### Request

| body | 型 | 説明 |
|---|---|---|
| cls | `business` 等の既存の値 | 既存 |
| big / mid | string（60 字以内） | 既存 |
| owner | string | 既存 |
| inst | string（100 字以内） | 既存 |
| note | string（200 字以内） | 既存 |
| reset | boolean | 既存。手当てを消す。 |
| paymentMethod | `cash` / `card` / `account` / null | 新設。null は上書きを消す。 |

提案一致フラグは本文で受け取らない（BR-09）。

#### Response

200。

| フィールド | 型 | 説明 |
|---|---|---|
| ok | true | |
| row | object | 保存後の行。GET の rows[] と同じ形。 |
| status | `unsorted` / `manual` / `done` | 保存後の分類ステータス |
| historyOpId | string または null | 書いた履歴の op_id。変化が無ければ null。 |

#### Validation・ビジネスルール

- zod で検証する。
- 確定かどうかは次で決める。
  - cls・big・mid・owner のどれかを含む保存は確定とし、BR-09 で `matched_proposal` を書く。
  - `reset=true` のときは tx_edits の行を消す。
- 履歴は BR-15 で書く。

#### Error contract

| HTTP | code | 条件 | クライアントの扱い |
|---|---|---|---|
| 400 | `invalid_body` | 検証失敗（メモが 200 字を超える等） | 項目の下にエラーを出し、編集中のまま戻す |
| 401 | `unauthorized` | 未認証 | ログインへ |
| 403 | `mutation_fenced` | canonicalMutationFence の拒否 | 「保存できませんでした。画面を再読み込みしてください。」 |
| 404 | `not_found` | txId が無い、または他の利用者のもの | 編集パネルを閉じ、一覧を取り直す |
| 409 | `split_parent` | 分割済みの親に区分を保存しようとした | 「分割済みの明細は内訳行ごとに編集してください。」 |
| 500 | `internal` | その他 | 下書きを残したままエラーを出す |

#### 実行セマンティクス

- tx_edits の upsert と tx_history の書込みを、1 回の D1 batch で行う（全部成功か、全部失敗か）。
- 同じ本文を繰り返しても、2 回目は値が変わらないので履歴を書かない（冪等）。

#### キャッシュ・ページング

N/A: 単一行の変更で、ページングは無い。成功後は FR-20 の問い合わせを無効化する。

#### 可観測性と監査

- 監査は tx_history が担う。
- 要求ログには経路・所要時間・結果コードだけを出し、メモの本文は出さない。

#### セキュリティ確認

- txId の所有を `user_id` 条件で確かめる。
- メモはテキストとして保存し、描画は React の既定エスケープに任せる。

#### Contract tests

- 提案どおりの確定で status=done、`matched_proposal=1`。
- カテゴリだけ変えた確定で status=manual。
- 提案なしの確定で status=manual。
- メモだけの保存では status もフラグも変わらない。
- paymentMethod の保存と、null での解除。
- 他の利用者の txId は 404。
- 201 字のメモは 400。
- 保存 1 回で、変わった項目の数だけ履歴が書かれる。

### API: 一括保存（POST /api/transactions/bulk、新設）

#### 識別と目的

- `POST /api/transactions/bulk`。一括操作バーの『選択した N 件を保存』と『失敗した K 件のみ再試行』（G3）。
- 1 回の要求で複数の明細を確定し、明細ごとに成否を返す。

#### 認証・認可

- セッション必須。フェンスに登録する。
- 他の利用者の txId は、要求全体を止めずに、その明細の `not_found` 失敗として返す（agent 推定・利用者未確認。根拠 qa-classify-auth-web-002）。

#### Request

```json
{
  "items": [
    { "txId": "{txId}", "cls": "business", "big": "{大項目}", "mid": "{中項目}", "owner": "{owner}", "paymentMethod": "card", "note": "{メモ}" }
  ]
}
```

| フィールド | 型 | 制約 |
|---|---|---|
| items | 配列 | 1〜100 件（agent 推定・利用者未確認。根拠 qa-classify-backend-web-002）。同じ txId の重複は 400。 |
| items[].txId | string | 必須 |
| items[].cls / big / mid / owner | 既存の edit と同じ | cls・big・owner のどれかは必須（確定だから） |
| items[].paymentMethod | `cash` / `card` / `account` / null | 任意 |
| items[].note | string（200 字以内） | 任意 |

分割の内訳行は、既存の splits API で扱う。一括保存の items には親の txId も内訳行も入れない。入れた場合は、その明細を `split_line_not_supported` の失敗にする。

#### Response

200（部分失敗でも 200。agent 推定・利用者未確認。根拠 qa-classify-backend-web-002）。

| フィールド | 型 | 説明 |
|---|---|---|
| results | 配列 | 要求の items と同じ順・同じ件数 |
| results[].txId | string | |
| results[].ok | boolean | |
| results[].status | `manual` / `done` | ok のときだけ。保存後の分類ステータス。 |
| results[].error | object | ok=false のときだけ。`{ code, message }`。code は `invalid_item` / `not_found` / `split_line_not_supported` / `no_suggestion` / `write_failed`。 |
| opId | string | 成功分の履歴に共通する op_id |
| saved | integer | ok=true の件数 |
| failed | integer | ok=false の件数 |

#### Validation・ビジネスルール

- 要求全体の検証は次の 2 つ: items が 1〜100 件であること、txId が重複していないこと。違反は 400 で、何も保存しない。
- 各明細の検証（zod の item schema と所有の確認）は明細ごとに行う。失敗した明細だけを results で失敗にする。
- 成功した明細は BR-09 で提案一致フラグを書き、BR-15 で履歴（source=`bulk`）を書く。
- 成功分は、後続の明細が失敗しても取り消さない。

#### Error contract

| HTTP | code | 条件 | クライアントの扱い |
|---|---|---|---|
| 200 | （明細ごとの error.code） | 部分失敗・全件失敗 | 通知（§7.7）と『失敗した K 件のみ再試行』 |
| 400 | `invalid_body` | items が 0 件か 101 件以上、txId が重複、JSON が壊れている | 「一度に保存できるのは100件までです。」等を通知 |
| 401 | `unauthorized` | 未認証 | ログインへ |
| 403 | `mutation_fenced` | フェンスの拒否 | 再読み込みを促す |
| 503 | `schema_not_ready` | migration 未適用 | 失敗状態 |
| 500 | `internal` | 検証の前に落ちた | 全件を失敗として再試行を出す |

#### 実行セマンティクス

- 検証を通った明細の書込み（tx_edits の upsert と tx_history）を D1 batch にまとめる。1 回の batch は最大 50 文（agent 推定・利用者未確認。根拠 qa-classify-infrastructure-web-002）。
- batch は明細の境界で区切り、1 つの明細の文が 2 つの batch にまたがらないようにする。
- ある batch が失敗したら、その batch に入っていた明細を `write_failed` にする。それより前の batch の成功は保つ。
- 冪等: 同じ items の再送は、値が変わらない明細では履歴を書かず、ok=true を返す。

#### キャッシュ・ページング

N/A: 変更系で、ページングは無い。成功が 1 件以上あれば、FR-20 の問い合わせを無効化する。

#### 可観測性と監査

- 要求ログに、件数（受付・成功・失敗）と失敗コードの内訳を出す。明細の内容は出さない。
- 監査は tx_history（source=`bulk`、共通の op_id）が担う。

#### セキュリティ確認

- 件数の上限で、D1 の書込み量を抑える。
- 利用者で区切る。
- 本文の大きさは Hono の既定の上限に従う。

#### Contract tests

`packages/api/src/routes/classify-bulk.test.ts`。

- 3 件中 1 件が検証エラーの要求: 2 件が保存され、results が 3 件で 1 件が ok=false、HTTP は 200。
- 再試行は失敗の 1 件だけを送り、成功する。
- 101 件は 400 で、何も保存しない。
- 未認証は 401。
- フェンス違反は拒否される。
- 他の利用者の txId は `not_found` の明細失敗になる。
- 成功した明細ごとに、履歴が source=`bulk` で書かれる。
- 旧実装にこの route が無いことで落ちるのを確かめてから、テストを確定する。

### API: 取引の履歴（GET /api/transactions/:txId/history、新設）

#### 識別と目的

- `GET /api/transactions/:txId/history`。編集パネルの『取引の履歴』（G5）。

#### 認証・認可

- セッション必須。
- 他の利用者の txId、または存在しない txId は 404（agent 推定・利用者未確認。根拠 qa-classify-auth-web-002）。

#### Request

| 位置 | 名前 | 型 | 説明 |
|---|---|---|---|
| path | txId | string | 明細の id。分割の内訳行は親の txId。 |
| query | limit | 1〜50 の整数 | 既定 20 |

#### Response

200。

| フィールド | 型 | 説明 |
|---|---|---|
| items | 配列 | 新しい順（`changed_at` の降順、同じ時刻は id の降順） |
| items[].changedAt | RFC3339 文字列 | |
| items[].field | `cls` / `category` / `owner` / `payment_method` / `note` / `split` / `deleted` | |
| items[].before / after | string または null | 表示用に整形済みの値（カテゴリはラベル） |
| items[].source | `auto` / `manual` / `rule` / `bulk` / `split` / `delete` / `undo` | |
| items[].sourceLabel | string | 自動提案 / 手動 / ルール / 一括保存 / 分割 / 削除 / 取消 |
| items[].confidence | integer または null | その時点の提案の信頼度（`auto` のときだけ） |
| items[].opId | string | |

#### Validation・ビジネスルール

- limit の範囲外は 400。
- この migration より前の変更は履歴に無いので、空の配列を返す。画面は「まだ履歴はありません。」と出す。

#### Error contract

| HTTP | code | 条件 | クライアントの扱い |
|---|---|---|---|
| 400 | `invalid_query` | limit の範囲外 | 既定で再取得 |
| 401 | `unauthorized` | 未認証 | ログインへ |
| 404 | `not_found` | txId が無い、または他の利用者のもの | 履歴欄に「履歴を読み込めませんでした。」 |
| 503 | `schema_not_ready` | migration 未適用 | 同上 |
| 500 | `internal` | その他 | 同上 |

#### 実行セマンティクス

読取りだけ。索引 `(user_id, tx_id, changed_at)` を使う 1 回の SQL で読む。

#### キャッシュ・ページング

- 先頭の `limit` 件だけを返す。続きのページは持たない（編集パネルの表示には十分なため）。
- Query キーは `['classify', 'history', txId]`。

#### 可観測性と監査

要求ログは経路・所要時間だけにする。履歴そのものが監査の記録である。

#### セキュリティ確認

- 利用者で区切る。
- before / after はテキストとして描画する。

#### Contract tests

- 編集・一括・ルール・分割・削除・取消の各経路の後に、履歴が 1 件ずつ増える（各経路で source が正しい）。
- 新しい順に並ぶ。
- 他の利用者の txId は 404。

### API: ルールの作成（POST /api/rules、拡張）

#### 識別と目的

- `POST /api/rules`。『このルールを適用』の前段で、ルールを保存する。
- 既存の本文に、`payee`・`scope`・`splitTemplate` を足す。

#### 認証・認可

- セッション必須。フェンスの対象（rules）。
- 利用者で区切る。

#### Request

| body | 型 | 説明 |
|---|---|---|
| keyword | string（1〜100 字） | 既存 |
| cls / big / mid / owner | 既存 | 既存。`hasAttr`（どれかが必須）も既存どおり。 |
| payee | string（100 字以内）または null | 新設。正規化キー（BR-12） |
| scope | `all` / `unconfirmed` | 新設。既定 `all` |
| splitTemplate | object または null | 新設。`{ lines: [{ kind: "fixed", amount, cls, big, mid, owner, memo }, ..., { kind: "remainder", cls, big, mid, owner, memo }] }`。残額の行はちょうど 1 行。 |

#### Response

201。

| フィールド | 型 | 説明 |
|---|---|---|
| rule | object | 保存したルール（id, keyword, payee, scope, splitTemplate, cls, big, mid, owner, sortOrder） |

#### Validation・ビジネスルール

splitTemplate は次をすべて満たす必要がある。満たさなければ 400。

- 残額の行がちょうど 1 行ある。
- 固定額の行が 1 行以上ある。
- 固定額が正の整数である。
- 行数が `MAX_SPLIT_LINES` 以内である。

#### Error contract

| HTTP | code | 条件 | クライアントの扱い |
|---|---|---|---|
| 400 | `invalid_body` | 検証失敗 | ルール化の欄にエラーを出す |
| 401 | `unauthorized` | 未認証 | ログインへ |
| 403 | `mutation_fenced` | フェンスの拒否 | 再読み込みを促す |
| 409 | `duplicate_rule` | 同じ keyword・payee・scope のルールがすでにある（既存の重複判定に合わせる） | 既存ルールの適用に切り替えるよう案内する |
| 500 | `internal` | その他 | エラーの通知 |

#### 実行セマンティクス

- rules に 1 行を挿入する。既存のルールと同じく、保存した時点から明細の判定（resolveTx）に効く。
- scope ごとの効き方は次のとおり。
  - `scope=all` のルールは、既存のルールと同じ優先順で効く。
  - `scope=unconfirmed` のルールは、利用者・MF 中項目のどちらも区分を決めていない明細にだけ効く。
- scope の効き方は agent 推定・利用者未確認（根拠 qa-classify-backend-web-003「適用範囲 (一致する明細すべて / 未確定の明細だけ)」からの導出）。
- 手動の手当て（tx_edits）は常にルールより優先する（既存）。
- 履歴は、`POST /api/rules/:id/apply` で書く（作成だけでは書かない）。

#### キャッシュ・ページング

N/A: 単一行の作成。成功後は既存ルール・一覧・KPI・バッジを無効化する。

#### 可観測性と監査

要求ログは経路・結果だけ。rules の `created_at` が記録になる。

#### セキュリティ確認

- keyword・payee はパラメタで渡す。
- splitTemplate の JSON は、zod を通してから文字列化して保存する（2000 字以内）。

#### Contract tests

- payee・scope・splitTemplate を保存して読み戻せる。
- 残額の行が 0 行または 2 行の splitTemplate は 400。
- 既存の keyword だけのルールの作成が、これまでどおり通る。

### API: ルールのプレビュー（POST /api/rules/preview、新設）

#### 識別と目的

- `POST /api/rules/preview`。ルールを作成・適用する前に、次を返す: 該当する明細、適用後の仕訳、件数。
- 下段の『ルール適用プレビュー』と、編集パネルの「今後 {n}件」の案内に使う（G4）。
- 何も保存しない。

#### 認証・認可

- セッション必須。利用者で区切る。
- 読取りなのでフェンスに登録しない。

#### Request

```json
{
  "rule": { "keyword": "{keyword}", "payee": "{payee}", "scope": "all", "cls": "business", "big": "{大項目}", "mid": null, "owner": "{owner}", "splitTemplate": null },
  "ruleId": null,
  "from": "2025-09",
  "to": "2026-08"
}
```

| フィールド | 型 | 説明 |
|---|---|---|
| rule | object または null | 下書きのルール（POST /api/rules と同じ検証） |
| ruleId | string または null | 既存ルールの id。rule と ruleId はどちらか一方だけ。 |
| from / to | `YYYY-MM` | 表示期間。走査はこの期間に限る（agent 推定・利用者未確認。根拠 qa-classify-security-web-002）。 |

#### Response

200。

| フィールド | 型 | 説明 |
|---|---|---|
| count | integer | 適用の対象になる明細の件数 |
| rows | 配列（最大 50） | 日付の昇順。`{ txId, date, payee, description, amount, after: [{ label, amount }] }` |
| omitted | integer | 50 行を超えて省いた件数 |
| skipped | 配列 | 分割できない明細（BR-10）。`{ txId, reason: "remainder_not_positive" }`。count に含めない。 |
| fingerprint | string | 対象の txId と適用後の値を並べた文字列の SHA-256（16 進）。適用のときに照合する。 |

#### Validation・ビジネスルール

- 対象は BR-11 の `ruleTargets` で決め、適用後の仕訳は BR-10 で決める。
- 適用 API と同じ core 関数を使う（O4）。

#### Error contract

| HTTP | code | 条件 | クライアントの扱い |
|---|---|---|---|
| 400 | `invalid_body` | rule と ruleId が両方ある、または両方無い、期間が不正、ルールの検証に失敗 | ルール化の欄にエラーを出す |
| 401 | `unauthorized` | 未認証 | ログインへ |
| 404 | `not_found` | ruleId が無い、または他の利用者のもの | 既存ルールの一覧を取り直す |
| 500 | `internal` | その他 | プレビュー欄に「プレビューを作れませんでした。」 |

#### 実行セマンティクス

- 読取りだけ。表示期間の明細を 1 回の SQL で読み、core で判定する。
- 同じ入力には同じ fingerprint を返す（決定論）。

#### キャッシュ・ページング

- 先頭の 50 行と件数を返す（agent 推定・利用者未確認。根拠 qa-classify-ui-ux-web-002）。
- Query キーは `['classify', 'rule-preview', rule, ruleId, period]`。

#### 可観測性と監査

要求ログに、所要時間と count を出す。キーワードの本文は出さない。

#### セキュリティ確認

- 走査を表示期間（最大 36 か月）に限り、CPU 時間の上限を守る。
- 利用者で区切る。

#### Contract tests

- プレビューが列挙した txId の集合が、同じ条件で適用したあとに変わった txId の集合と一致する（O4）。
- 手動変更の明細が rows に入らない。
- 分割の型のあるプレビューで、各行の after の和が元の金額に一致する。
- 残額が 0 以下の明細が skipped に入る。

### API: ルールの作成と適用（POST /api/rules/apply、新設）

編集中のルール、表示期間、プレビューが返した fingerprint を受け取る。サーバは保存前に対象を再計算し、指紋がずれたら 409 `preview_stale` でルールも履歴も書かない。一致時はルール作成、手当て／分割、履歴、無効化キーを 1 回の D1 batch で保存する。対象 0 件でもルールは保存し `applied: 0` を返す。書込文数が上限を超えるときは、一部を書く前に 413 で止める。

### API: 保存済みルールの適用（POST /api/rules/:id/apply、新設）

#### 識別と目的

- `POST /api/rules/:id/apply`。『このルールを適用』。保存済みのルールを、プレビューと同じ判定で表示期間の対象に適用する。
- 分割の型があれば、対象の明細に分割を書く。
- どちらの場合も、対象の明細に履歴を書く。

#### 認証・認可

- セッション必須。フェンスに登録する（rules・tx_edits・tx_splits・tx_history）。
- 他の利用者のルールは 404。

#### Request

| 位置 | 名前 | 型 | 説明 |
|---|---|---|---|
| path | id | string | ルールの id |
| body | from / to | `YYYY-MM` | プレビューと同じ表示期間 |
| body | fingerprint | string | プレビューが返した値 |

#### Response

200。

| フィールド | 型 | 説明 |
|---|---|---|
| applied | integer | 実際に変わった明細の件数 |
| txIds | string の配列 | 変わった明細 |
| skipped | 配列 | プレビューと同じ形 |
| opId | string | 書いた履歴の op_id |

#### Validation・ビジネスルール

- サーバで `ruleTargets` を計算し直し、fingerprint を照合する。一致しなければ 409 で、何も書かない。
- 照合の方式は agent 推定・利用者未確認（根拠 qa-classify-backend-web-002。プレビューと適用の一致を決定論で守るため）。
- 分割の型があれば、各対象の明細に次を書く。
  - BR-10 の行を tx_splits に書く。
  - 親の tx_edits に、`origin='manual'`・`matched_proposal=1` を書く。内訳行を完了にするためである（BR-01。agent 推定・利用者未確認。根拠 qa-classify-database-web-003）。
- 分割の型が無いルールは、作成した時点で判定に効いている。apply では tx_edits を書かずに、履歴（source=`rule`）だけを書く。
- 手動変更の明細は対象外（BR-11）。

#### Error contract

| HTTP | code | 条件 | クライアントの扱い |
|---|---|---|---|
| 400 | `invalid_body` | 期間・fingerprint の形が不正 | エラーを出す |
| 401 | `unauthorized` | 未認証 | ログインへ |
| 403 | `mutation_fenced` | フェンスの拒否 | 再読み込みを促す |
| 404 | `not_found` | ルールが無い、または他の利用者のもの | 既存ルールを取り直す |
| 409 | `preview_stale` | 対象が変わった（fingerprint の不一致） | 「対象の明細が変わりました。プレビューを更新します。」と出し、プレビューを取り直す |
| 500 | `internal` | その他 | エラーの通知。成功した batch は保たれる。 |

#### 実行セマンティクス

- D1 batch（1 回あたり最大 50 文）で、明細の境界に沿って書く。
- 途中の batch が失敗したら 500 を返す。その時点までに書いた明細は保つ。
- 再実行すると、書いた明細は `ruleTargets` から外れる（分割済みになるため）ので、残りだけを書く。
- 冪等: 同じ要求の再送で、二重に分割しない。

#### キャッシュ・ページング

N/A: 変更系で、ページングは無い。成功後は FR-20 の問い合わせを無効化する。

#### 可観測性と監査

- 要求ログに、applied・skipped の件数と所要時間を出す。
- 監査は tx_history（source=`rule`、共通の op_id）が担う。

#### セキュリティ確認

- 利用者で区切る。
- 書込みの件数は、表示期間の対象に限る。

#### Contract tests

- プレビューの count と applied が一致する。
- fingerprint の不一致で 409、書込みは 0 件。
- 手動変更の明細が変わらない。
- 分割の各行の和が元の金額に一致する。
- 再実行で二重に分割しない。
- 変わった明細ごとに、履歴が source=`rule` で書かれる。

### API: 保存したフィルタの一覧（GET /api/saved-filters、新設）

#### 識別と目的

- `GET /api/saved-filters`。左パネルの『保存したフィルタ』（G5）。

#### 認証・認可

- セッション必須。
- 自分の行だけを返す。

#### Request

パラメタは無い。

#### Response

200。

| フィールド | 型 | 説明 |
|---|---|---|
| items | 配列 | 作成日時の昇順 |
| items[].id | string | |
| items[].name | string | 1〜40 字 |
| items[].query | object | `{ status, category, owner, method, manual, q, sort }`（期間は含めない） |
| items[].createdAt / updatedAt | RFC3339 文字列 | |

#### Validation・ビジネスルール

- 保存済みの `query_json` を zod で読み直す。
- 読めない行は items から外し、ログに件数だけを出す。

#### Error contract

| HTTP | code | 条件 | クライアントの扱い |
|---|---|---|---|
| 401 | `unauthorized` | 未認証 | ログインへ |
| 503 | `schema_not_ready` | migration 未適用 | 保存したフィルタの欄に「読み込めませんでした。」 |
| 500 | `internal` | その他 | 同上 |

#### 実行セマンティクス

読取りだけ。

#### キャッシュ・ページング

- 上限が 20 件なので、ページングは無い。
- Query キーは `['classify', 'saved-filters']`。

#### 可観測性と監査

要求ログは経路・所要時間だけにする。

#### セキュリティ確認

- 利用者で区切る。
- 名前はテキストとして描画する。

#### Contract tests

- 作成したフィルタが一覧に出る。
- 他の利用者のフィルタは出ない。

### API: 保存したフィルタの作成（POST /api/saved-filters、新設）

#### 識別と目的

- `POST /api/saved-filters`。『＋ 現在の条件を保存』。

#### 認証・認可

- セッション必須。フェンスに登録する（saved_filters）。

#### Request

| body | 型 | 制約 |
|---|---|---|
| name | string | 1〜40 字。前後の空白を除いてから数える。 |
| query | object | GET の items[].query と同じ形。JSON にして 2000 字以内。 |

#### Response

201。

| フィールド | 型 | 説明 |
|---|---|---|
| item | object | GET の items[] と同じ形 |

#### Validation・ビジネスルール

- 同じ名前は `(user_id, name)` の一意制約で拒む。
- 利用者あたり 20 件まで（agent 推定・利用者未確認。根拠 qa-classify-database-web-002）。

#### Error contract

| HTTP | code | 条件 | クライアントの扱い |
|---|---|---|---|
| 400 | `invalid_body` | 名前が 0 字か 41 字以上、条件が 2000 字を超える | 名前入力の下にエラーを出す |
| 401 | `unauthorized` | 未認証 | ログインへ |
| 403 | `mutation_fenced` | フェンスの拒否 | 再読み込みを促す |
| 409 | `duplicate_name` | 同じ名前がある | 「同じ名前のフィルタがあります。」 |
| 409 | `limit_reached` | 20 件ある | 「保存できるフィルタは20件までです。」 |
| 500 | `internal` | その他 | エラーの通知 |

#### 実行セマンティクス

- 1 行を挿入する。
- 件数の確認と挿入は、1 回の batch の中で行う（件数が 20 件未満のときだけ挿入する条件付きの INSERT）。

#### キャッシュ・ページング

N/A: 単一行の作成。成功後に保存したフィルタの一覧を無効化する。

#### 可観測性と監査

要求ログは経路・結果だけにする。名前は出さない。

#### セキュリティ確認

- 条件は zod で形を確かめてから保存する。未知のキーは落とす。

#### Contract tests

- 作成・重複名 409・21 件目 409・41 字 400 を確かめる。
- 未認証は 401。

### API: 保存したフィルタの削除（DELETE /api/saved-filters/:id、新設）

#### 識別と目的

- `DELETE /api/saved-filters/:id`。保存したフィルタの行の削除ボタン。

#### 認証・認可

- セッション必須。フェンスに登録する（saved_filters）。
- 他の利用者の id は 404。

#### Request

| 位置 | 名前 | 型 |
|---|---|---|
| path | id | string |

#### Response

200。

| フィールド | 型 | 説明 |
|---|---|---|
| ok | true | |
| id | string | 削除した id |

#### Validation・ビジネスルール

- 削除の前に、画面で ConfirmDialog を出す。
- 物理削除にする。保存したフィルタは明細の正本ではないので、undo は持たない。

#### Error contract

| HTTP | code | 条件 | クライアントの扱い |
|---|---|---|---|
| 401 | `unauthorized` | 未認証 | ログインへ |
| 403 | `mutation_fenced` | フェンスの拒否 | 再読み込みを促す |
| 404 | `not_found` | id が無い、または他の利用者のもの | 一覧を取り直す |
| 500 | `internal` | その他 | エラーの通知 |

#### 実行セマンティクス

- `user_id` 条件付きで 1 行を削除する。
- 同じ id を 2 回目に消そうとしたら 404 を返す。画面では成功と同じく、一覧を取り直す。

#### キャッシュ・ページング

N/A: 単一行の削除。成功後に一覧を無効化する。

#### 可観測性と監査

要求ログは経路・結果だけにする。

#### セキュリティ確認

- 利用者で区切る。

#### Contract tests

- 削除後に一覧から消える。
- 他の利用者の id は 404 で、行が残る。

## データモデル

### migration `migrations/0046_classify_workbench.sql`

- 追加のみの 1 本（利用者決定 qa-classify-database-web-001）。
- ファイル名と列の細目は agent 推定・利用者未確認（根拠 qa-classify-database-web-002・003）。
- 番号は実装時に `origin/main` を fetch し直して確かめる。0046 が埋まっていたら次の番号にする。
- 既存の行を書き換える文（UPDATE・DELETE・表の作り直し）は入れない。

```sql
-- 0046_classify_workbench.sql : 明細仕分けの作業状態 (追加のみ)
CREATE TABLE saved_filters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  query_json TEXT NOT NULL CHECK (length(query_json) BETWEEN 2 AND 2000),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, name)
);

CREATE TABLE tx_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tx_id TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  field TEXT NOT NULL CHECK (field IN ('cls', 'category', 'owner', 'payment_method', 'note', 'split', 'deleted')),
  before_value TEXT,
  after_value TEXT,
  source TEXT NOT NULL CHECK (source IN ('auto', 'manual', 'rule', 'bulk', 'split', 'delete', 'undo')),
  confidence INTEGER CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 100),
  op_id TEXT NOT NULL
);
CREATE INDEX idx_tx_history_user_tx_changed ON tx_history (user_id, tx_id, changed_at);

ALTER TABLE rules ADD COLUMN payee TEXT;
ALTER TABLE rules ADD COLUMN scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'unconfirmed'));
ALTER TABLE rules ADD COLUMN split_template_json TEXT;

ALTER TABLE tx_edits ADD COLUMN payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('cash', 'card', 'account'));
ALTER TABLE tx_edits ADD COLUMN matched_proposal INTEGER CHECK (matched_proposal IS NULL OR matched_proposal IN (0, 1));
```

補足。

- `tx_history.confidence` は、履歴の表示「（信頼度 92%）」のために置いた列で、agent 推定・利用者未確認（根拠 qa-classify-ui-ux-web-003 の履歴の表示）。
- `rules.scope` の `DEFAULT 'all'` により、既存のルールは今までどおり「一致する明細すべて」として働く。既存行を書き換えない。
- `tx_edits.matched_proposal` の列名は agent 推定・利用者未確認（根拠 qa-classify-database-web-003）。既存行は NULL のままで、BR-01 (c) により手動変更として扱う。
- `saved_filters` は利用者の UI 設定、`tx_history` は監査・作業記録である。どちらも会計データの JSON バックアップ／復元と取込データの full reset の対象外とし、明細を削除しても保持する。削除と取消は `tx_history` へ新たな履歴を追記する。

### 反映先

| 場所 | 変更 |
|---|---|
| `packages/api/src/db/schema.ts` | `savedFilters`・`txHistory` の表と、`rules`・`txEdits` の新しい列を足す |
| runtimeSchemaGuard の必須表・必須列 | `saved_filters`・`tx_history` と、新しい 5 列を足す。未適用なら 503 `schema_not_ready`。 |
| `docs/data-schema.md` | 2 表と 5 列、分類ステータスの規則（BR-01〜BR-03）、信頼度（BR-04・BR-05）を記す |
| `packages/core/src/types.ts` 等 | `TxEdit` に `paymentMethod?`・`matchedProposal?` を、`Rule` に `payee?`・`scope`・`splitTemplate?` を足す |

### core の型（新設・拡張）

```ts
export type ClassifyStatus = 'unsorted' | 'manual' | 'done';
export type ReviewReason = 'low_confidence' | 'conflict' | 'contradiction';
export interface StatusResult {
  status: ClassifyStatus;
  needsReview: boolean;          // status が unsorted のときだけ true になり得る
  reviewReasons: ReviewReason[];
}
export interface ClassifyCounts { all: number; unsorted: number; review: number; manual: number; done: number; }
export interface SplitTemplateLine { kind: 'fixed' | 'remainder'; amount?: number; cls: Cls; big?: string; mid?: string; owner?: string; memo?: string; }
```

- `Recommendation` に次を足す: `suggestion`（cls・big・mid・owner）、`basisText`、`conflict`、`contradiction`。
- 既存の `basisLabel` は、`/review-queue` との互換のために残す。
- `confidence` は vendor_memory 以外でも数値を返すようになる。null は提案なしのときだけ。

### 下書き（D1 に置かない）

localStorage に次の形で保存する。

- キー: `kanjo:classify:draft:{txId}`
- 値: `{ v: 1, savedAt: "{RFC3339}", fields: { cls, big, mid, owner, paymentMethod, note }, split: null または { lines } }`

サーバへは送らない（利用者決定 qa-classify-decision-004）。

## 認証・認可

- 新しい認証方式は作らない（qa-classify-auth-web-001）。
  - セッションは既存の `kanjo_session` Cookie と `session_generation`。
  - 利用者 id は `c.get('userId')` から取る。
  - テナントは既存の `TENANT_ID='default'`。
- 利用者 id を、本文・query・path から受け取らない。
- すべての SQL に `user_id` 条件を付け、他の利用者の行を読まず、書かない。
- 他の利用者の資源を指したときの扱い（agent 推定・利用者未確認。根拠 qa-classify-auth-web-002）。
  - 他の利用者の id（txId・ルール id・保存フィルタ id）を指したら 404 を返す。存在を明かさないためである。
  - 一括保存では、要求全体を止めずに、明細単位の `not_found` にする。
- 未認証は 401。
- パスワード変更が必要な利用者は、mustChangePasswordFence で止める。
- 画面側の扱い。
  - 401 を受けたら、既存の認証切れ処理（ログイン画面へ）に任せる。
  - 下書きは端末に残る。同じ端末で次にログインした同じ利用者が復元できる。
  - localStorage は利用者で区切らないので、共用端末では『下書きを復元』に他人の下書きが出うる。単一利用者の前提（SH1）なので、ここでは区切りを足さない。この前提は未決事項 Q-4 に残す。

## エラー・例外・回復

| 事象 | 検知 | 利用者に見えるもの | 回復 |
|---|---|---|---|
| 一覧の取得失敗 | GET が 5xx・ネットワークエラー | 失敗状態「明細を読み込めませんでした。」と『再読み込み』 | 再取得。期間と絞り込みは URL と usePeriod に残る。 |
| 一括保存の部分失敗 | results に ok=false | 部分失敗の通知と『失敗した K 件のみ再試行』 | 失敗の txId だけで再送する。成功分は保たれる。 |
| 一括保存の要求全体の拒否 | 400・403・500 | エラーの通知 | 選択は残す。上限超過なら選択を 100 件以下にするよう案内する。 |
| 編集の保存失敗 | PUT が 4xx・5xx | 編集パネルのエラー。● 未保存のまま。 | 下書きは消さない。入力を直して再保存する。 |
| プレビューが古い | apply が 409 `preview_stale` | 「対象の明細が変わりました。プレビューを更新します。」 | プレビューを取り直す。ルールは保存済みなので、ruleId で再プレビューする。 |
| ルール作成は成功、適用は失敗 | apply が 5xx | 「ルールは保存しましたが、適用できませんでした。」と『再試行』 | ruleId で apply を再実行する。書いた明細は対象から外れるので、二重には書かない。 |
| 分割の合計が合わない | クライアントの検証 | 不一致の文言。適用ボタンを押せない。 | 行を直す |
| 削除の失敗 | preflight・deletions が 4xx・5xx | 「明細を削除できませんでした。」 | 既存の削除の手順どおり。fingerprint の不一致は preflight からやり直す。 |
| 取消の失敗 | undo が 4xx・5xx | 「元に戻せませんでした。」 | 既存の undo の規則に従う（期限・対象の変化） |
| migration 未適用 | 503 `schema_not_ready` | 失敗状態 | Migrate を適用する（運用。既存の手順） |
| localStorage が使えない | try/catch | 下書きの表示を出さない | 下書き無しで動き続ける。保存は通常どおり。 |
| 下書きが壊れている・形式が古い・30 日を過ぎた | 読込時の検証 | 何も出さない | その下書きを捨てる |
| 未保存のまま離れる | useBlocker・beforeunload | 離脱の確認 | とどまるか、捨てて移動する |
| 他のタブで同じ明細を保存した | 保存後に取り直した値が、入力前の値と違う | 「この明細はほかの画面で更新されています。」 | 最新の値を読み込み、下書きは残す |

回復の原則: 成功分は取り消さない。失敗分だけをやり直せるようにする。利用者の入力は、保存に成功するまで端末から消さない。

## イベント・非同期処理

N/A: サーバ側に非同期処理は無い。キュー・Cron・Durable Objects・外部 Webhook は足さない（qa-classify-infrastructure-web-001: 構成は変えない）。すべての変更は要求の中で同期的に D1 へ書く。

画面の中の非同期の動きは次に限る。いずれも同じタブの中で完結する。

| 動き | 契機 | 内容 |
|---|---|---|
| 下書きの自動保存 | 編集パネルの入力が止まって 1 秒後 | localStorage に書き、保存時刻の表示を更新する |
| 問い合わせの無効化 | FR-20 の各操作の成功 | 一覧・KPI・`/review-queue`（バッジ）・既存ルール・保存したフィルタ・開いている明細の履歴を取り直す |
| 取消の通知 | 削除の成功 | 『元に戻す』を持つ通知を出す。通知は × で閉じるまで残る。取消の期限は既存の undo の規則に従う。 |
| 離脱確認 | 画面遷移・再読込・タブを閉じる | 未保存の入力があるときだけ確認する |

## 可観測性

- 要求ログは既存の方式に従う。
  - 新しい route も、経路・所要時間・HTTP 状態を出す。
  - 一括保存は受付・成功・失敗の件数と、失敗コードの内訳を出す。
  - プレビューは count と所要時間、適用は applied と skipped の件数を出す。
- 明細の内容・メモ・キーワード・フィルタ名はログに出さない（取込データを外に出さない約束と、ログの肥大を防ぐため）。
- 監査の記録は tx_history が担う。どの変更経路も、変わった項目ごとに 1 行を書く（FR-16）。
- 画面の観測は次のとおり。
  - 失敗状態と通知は `role="alert"` / `role="status"` で読み上げられる。
  - 外部の計測サービスは足さない。
- 保守者が件数のずれを調べるときは、次を突き合わせる。いずれも `classifyStatus` から出るので、ずれたら判定関数の外に重複実装がある。
  - 画面の KPI（選択期間）
  - `/review-queue` のバッジ（全期間）
  - 月次クローズの『仕分け』

## 互換性・移行・リリース

- DB: `0046_classify_workbench.sql` は追加のみ。
  - 既存の rules は `scope='all'` で、今までどおり働く。
  - 既存の tx_edits は `matched_proposal=NULL` で、手動変更として数える。
  - 行の書き換えは 0 件で、migration 検査で確かめる（O5）。
- API: `GET /api/transactions` は既存の項目の意味を変えない。
  - `month` と `cls` は受け続ける。
  - 並びの既定は「金額の絶対値の降順」から「日付の降順」に変わる。ほかの画面がこの並びに依存していないことを、実装時に `rg "api/transactions"` で確かめる。
- `recommendationFor` の互換。
  - `confidence` が、ルール・MF 中項目の由来でも数値になる。
  - `/review-queue` の画面（概要の要確認キュー）で、信頼度の表示が「—」から数値に変わる。意図した変更として docs に記す。
- 件数の互換。
  - 月次クローズの『仕分け』の値は、現行の `counts.classification` と同じになる（BR-07）。既存の月次クローズのテストを緑のまま保つ。
  - バッジの値も、現行と同じ未整理（`clsSrc='既定'`、保留後）になる。
- 画面: `/classify` の URL は変えない。
  - 旧 URL の `month` は、開いたときに usePeriod の任意期間（その 1 か月）へ読み替え、URL から消す。
  - 旧 URL の `cls`・`category`・`payee`・`hcat`・`big` は、読める範囲で新しいパラメタへ読み替え、読めないものは捨てる。
- リリース順: Migrate（0046）→ Deploy。
  - 既存の Deploy / Migrate の手順とゲートに従う。
  - 未適用のまま新しい Worker が動いても、runtimeSchemaGuard が 503 を返し、既存の画面は壊れない。
- 巻き戻し。
  - Worker を前の版に戻しても、追加の表と列は読まれないだけで害は無い。
  - 表と列は消さない（追加のみの方針）。

## テストと受入条件

### テストの置き場所（agent 推定・利用者未確認。根拠 qa-classify-maintenance-ops-web-002）

| ファイル | 固定する内容 |
|---|---|
| `packages/core/src/classify-status.test.ts` | 3 区分の排他と和、要確認 ⊆ 未整理、信頼度 79 は要確認・80 は要確認でない、衝突と矛盾、提案どおりの確定は完了・異なる確定は手動変更・提案なしの確定は手動変更・`matched_proposal=NULL` の既存手入力は手動変更、vendor_memory の materialize は `matched_proposal=NULL` でも完了かつ要確認でない、バッジと月次クローズが同じ関数から出ること、信頼度が 0〜100 の整数か提案なしのときだけ null であること、`ruleTargets` のプレビューと適用の一致、手動変更がルールで変わらないこと、分割の型の和が元の金額に一致すること |
| `packages/api/src/routes/classify-bulk.test.ts` | 各 API の Contract tests（§API契約）、401、フェンス違反、上限超過 400、他の利用者 404、履歴の件数、migration が既存行を書き換えないこと |
| `packages/web/src/pages/classify/classify.dom.test.tsx` | 全構成要素の描画、文言の完全一致、状態（読込・空・失敗）、通知 2 種、再試行が失敗分だけを送ること、下書きの自動保存・復元・消去・離脱確認、証憑欄が無く案内があること |
| `packages/web/src/pages/classify/view-model.test.ts` | 通知文・件数文・信頼度の文言・分割合計の文言の純関数 |

テストを確定する前に、それが旧実装で落ちることを確かめる。

- 例 1: 旧実装では「未整理 + 手動変更 + 完了 = 全件」が 4 区分の和になって閉じない。
- 例 2: 旧実装では、ルール由来の信頼度が null になる。
- 検査の対象が 0 件で緑になるテストにしない。fixture の件数を固定し、判定の対象になった件数も確かめる。

### 受入条件

| ID | 受入条件 | 確かめ方 |
|---|---|---|
| AT-01 | `/classify` に次がすべて描画される: 見出し『明細仕分け』、問い、説明文 2 行、期間タブ 4 つと期間送り、『明細仕分けの使い方』。 | DOM |
| AT-02 | KPI 4 枚（未整理・要確認・手動変更・完了）が件数付きで出る。要確認に『未整理のうち』がある。 | DOM |
| AT-03 | 絞り込みパネルに次の全項目がある: 対象月、分類ステータスのチェック 4 つと件数、カテゴリ、所有者、支払い方法、手動変更のみ、キーワード検索（placeholder 完全一致）、保存したフィルタ、『＋ 現在の条件を保存』、『フィルタをクリア』、折りたたみ。 | DOM |
| AT-04 | 一覧に 6 列と選択チェック・全選択がある。件数見出し『取引一覧（N件）』、『表示件数 50件』、ページ送りがある。51 件目は 2 ページ目に出る。 | DOM・API |
| AT-05 | 未整理の行にも提案カテゴリと信頼度が出る。要確認の行には『要確認』の文言が併記される。 | DOM |
| AT-06 | 編集パネルに §7.6 の全欄がある。証憑欄（ファイル選択）が無く、『証憑は freee 側で管理します』がある。 | DOM |
| AT-07 | 一括操作バーに『N 件選択中』『選択をクリア』『選択した N 件を保存』がある。 | DOM |
| AT-08 | 3 件中 1 件が失敗すると、通知『選択した3件のうち2件を保存しました。1件はエラーのため保存できませんでした。』と『失敗した1件のみ再試行』が出る。再試行の要求は失敗の 1 件だけを含む。 | DOM・API |
| AT-09 | 削除すると『1件の明細を削除しました。』と『元に戻す』が出る。『元に戻す』で明細が一覧に戻る。 | DOM・API |
| AT-10 | 分割明細の編集が §7.9 の文言で出る。一致の文言『金額の合計が元の取引金額と一致しています。(8,000円 + 4,000円 = 12,000円)』は、fixture の 12,000 円の明細で完全一致する。不一致のときは適用ボタンを押せない。 | DOM |
| AT-11 | ルール適用プレビューが、§7.10 の文言・件数・表で出る。適用後、プレビューの明細の集合と、変わった明細の集合が一致する。 | DOM・API・core |
| AT-12 | 同じ期間で 未整理 + 手動変更 + 完了 = 全件、要確認 ≦ 未整理。バッジと月次クローズの『仕分け』は同じ `classifyStatus` から判定する。ただしバッジは全期間、クローズは対象月が母集団であり、同件数は要件としない。有効な保留は両方から除く。 | core |
| AT-13 | 提案どおりの確定で完了、提案と異なる確定で手動変更になる。後から提案が変わっても、区分は変わらない。 | core・API |
| AT-14 | 手動変更の明細は、ルールの作成・適用で変わらない。分割ルールの行の和は元の金額に一致する。 | core・API |
| AT-15 | 保存フィルタの作成・一覧・削除ができる。各変更経路で履歴が 1 件ずつ残る（手動・一括・ルール・分割・削除・取消）。 | API |
| AT-16 | 下書きが 1 秒後に自動保存され、『下書きを自動保存しました HH:MM』が出る。再読込後に『下書きを復元』で戻る。保存成功で消える。未保存で離れると確認が出る。 | DOM |
| AT-17 | 読込・空（期間内 0 件）・失敗の各状態が出る。 | DOM |
| AT-18 | 信頼度と分類ステータスが、色だけでなく数値と文言で区別される。画面に『AI』の文字列が無い。 | DOM |
| AT-19 | 直書き色の lint が 0 件。pnpm lint・typecheck・初期 JS 予算を CI で通す。既存の仕分け・照合・月次クローズ・家計収支・総収支の数値テストは緑。 | CI |
| AT-20 | migration 0046 が既存行を 1 行も書き換えない。 | migration 検査 |
| AT-21 | 外部への送信が 0 件である（fetch の宛先が同じオリジンの `/api` だけ）。 | DOM（fetch の監視） |

受入は、実行済みの最新のテスト証跡だけで判定する。未実施、一部適合、または既知の逸脱が 1 件でも残る項目は PASS にしない。

## 決定事項と未決事項

| ID | 事項 | 現状 | 決め手 |
|---|---|---|---|
| Q-1（解決済み） | vendor_memory が取込時に自動で materialize した手当て（`tx_edits.origin='vendor_memory'`、`clsSrc='手動'`、`matched_proposal=NULL`）を、完了とするか手動変更とするか。 | **`done`（完了）にする。** `matched_proposal=NULL` でも `needsReview=false`。 | 利用者の手入力ではなく、承認済みの取引先メモリを取込時に自動適用した結果である。ルール・MF 中項目と同じ自動決定として扱い、core の実テストで固定する。 |
| Q-2 | 画像の KPI（要確認 5 と、一覧で 80% 未満の 4 件）、日付（期間外の 2026/09）、金額（5,440円 と 5,400円）の不一致。 | C6（画像の数値はモック）に従い、実データで出す（§7.14）。画像どおりの数値の fixture は作らない。 | 解消済みの扱い。画像の修正は求めない。 |
| Q-3 | 画像の『ルール適用プレビュー』が「今後」の未来日付の明細を示している点。 | 決定文言『今後 N 件に適用』は保つ。対象は、表示期間内の既存の明細にする（qa-classify-security-web-002 の agent 推定）。未来に取り込まれる明細には、保存したルールが判定の時点で効く。 | 利用者に、見出しの語と対象の範囲の整合を確認してよい。実装はこのままで進められる。 |
| Q-4 | localStorage の下書きを、利用者で区切らない点。 | 単一利用者の前提（SH1）で、区切らない。 | 共用端末を想定するなら、キーに利用者 id を含める変更を別途決める。 |
| Q-5 | 本書の agent 推定・利用者未確認の値。 | 値は次のとおり。 ・信頼度の数値、衝突の −20、矛盾の定義 ・一括保存の上限 100 と 200 応答 ・endpoint の形 ・列名 `matched_proposal`、`tx_history.confidence` ・下書きのキー・1 秒・30 日 ・選択の上限 50 ・既定の並び ・KPI を押したときの絞り込み ・1024px 未満の並び ・プレビューの 50 行 ・batch の 50 文 ・保存フィルタの 20 件 ・scope の効き方 ・fingerprint の照合 ・一括保存で送る値 ・空・失敗の文言 | 実装はこの値で進める。利用者が別の値を選んだら、system-spec を直してから本書を直す。 |
