---
graph_node_id: "spec-subscriptions-merge"
artifact_kind: "specification"
artifact_subtypes: ["frontend", "api", "data"]
title: "サブスク統合 仕様 — 登録済みの行の統合・取り消し・操作の順次処理 (09-subscriptions.png)"
project_id: "kanjo"
domain: "analysis"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: []
tags: ["subscriptions", "analysis"]
file_path: "specs/spec-subscriptions-merge.md"
template_id: "specification"
template_version: "1.0.0"
source_image: "design/FINAL-UI/images/09-subscriptions.png"
route: "/subscriptions"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "docs/evidence/subscriptions-merge/spec-evaluation-waiver.json", "evaluated_digest": "8a9ed18c1ea8d587e843aac443afc2bbb69be109dca2089b686192e178dfdee4"}
source_lineage: {"origin_kind": "system-spec-harness", "source_plugin": "system-spec-harness", "source_path": "system-spec/00-requirements-definition.md", "source_version": "0.1.14", "source_digest": "8a9ed18c1ea8d587e843aac443afc2bbb69be109dca2089b686192e178dfdee4", "imported_at": "2026-09-30T15:18:20Z"}
created_at: "2026-09-30T15:18:20Z"
updated_at: "2026-09-30T15:18:20Z"
depends_on: []
related_nodes: ["arch-subscriptions-merge-ui-ux", "arch-subscriptions-merge-frontend", "arch-subscriptions-merge-backend", "arch-subscriptions-merge-database", "arch-subscriptions-merge-auth", "arch-subscriptions-merge-security", "arch-subscriptions-merge-infrastructure", "arch-subscriptions-merge-maintenance-ops"]
resource_scope: ["packages/core/src/subs.ts", "packages/core/src/subs-screen.ts", "packages/core/src/dataset.ts", "packages/core/src/expense-projection.ts", "packages/core/src/index.ts", "packages/core/test/subs-contract.test.ts", "packages/core/test/subs-screen-contract.test.ts", "packages/api/src/routes/subs.ts", "packages/api/src/subscription-writes.ts", "packages/api/src/store.ts", "packages/api/src/index.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/import-active.ts", "packages/api/src/import-lifecycle.ts", "packages/api/src/routes/imports.ts", "packages/api/src/schema-guard.ts", "packages/api/src/db/schema.ts", "packages/api/src/index.test.ts", "packages/api/src/deletion-schema.test.ts", "packages/api/src/subs-screen.integration.test.ts", "packages/api/src/subs-merge-operations.integration.test.ts", "packages/web/src/pages/Subscriptions.tsx", "packages/web/src/pages/subscriptions", "packages/web/src/subscriptions-screen.dom.test.tsx", "migrations/0058_subscription_merge_operations.sql", "docs/subscriptions-screen.md", "docs/data-schema.md", "design/FINAL-UI/images/09-subscriptions.png", "packages/core/src/subscription-operation.ts", "packages/api/src/subscription-restore-barrier.ts", "packages/core/src/types.ts", "packages/web/src/components/AccessibleTabs.tsx", "packages/web/src/mobile-financial-visualization-render.test.ts", "packages/web/scripts/check-financial-visuals.mjs", "packages/api/src/import-lifecycle.test.ts", "docs/evidence/subscriptions-merge/elegant-review.md"]
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
classification_reason: "09-subscriptions.png と system-spec (サブスク統合サイクル・第 3 周の決定と具体値) から、統合の意味・書込みの順次処理と取り消し・保持・API・保存・受入を定めた機能仕様であり、実装 (web / core / api / migration) が参照する正本。"
classification_candidates: [{"artifact_kind": "specification", "confidence": 1.0, "candidate_path": "specs/spec-subscriptions-merge.md"}]
tracker_binding: "none"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "not_applicable", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-30T15:18:20Z"}
serves_goals: ["G1", "G2", "G3", "G4"]
---
# 目的と成功状態

サブスク画面で統合を行っても一覧から行が消えない問題を正し、統合・登録・変更・見直し判断を続けて、または複数の利用者が同時に行っても、操作が失われず止まらないようにする仕様。上位概念は `system-spec/00-requirements-definition.md` (承認 appr-foundation-subsmerge-002、2026-09-30T12:05:58Z) で、章ごとの制約は `architecture/subscriptions-merge-*.md` の 8 文書が持つ。本書の行番号・関数名・定数は、2026-09-30 に commit a63d35c の現物を開いて確かめた値である。

**system-spec の評価との関係**: 完成度評価 (`system-spec/completeness-findings.json`、第 3 周) は、過去の質問文の中立性 (C06) を理由に FAIL を返した。qa の質問文は凍結されていて追記では消えないため、利用者が 2026-09-30T14:07:45Z に例外として承認し、本書の取り込みへ進んだ。評価の後に変えたのは、出典 vitest の版 (5.0.3) と、2 件の qa への訂正 (利用者を削除する経路は無い) だけである。例外承認の記録 (FAIL の理由・承認日時・評価時と取込み時の章 digest) は `docs/evidence/subscriptions-merge/spec-evaluation-waiver.json` にある。

**前サイクルとの関係**: 前サイクルの `specs/spec-subscriptions-screen.md` は画像 09 の再現を目的とし、一覧の行チェックは「置くだけで一括操作は置かない」(同 §5.2)、統合は未登録の候補を既存ベンダーの別名へ足す操作 (§6.3、`POST /api/sub-vendors/:id/aliases`)、楽観更新はしない (§11)、統合の履歴は持たない、と定めた。本書はその画面構成・文言・fixture・保存 (migration 0043) を正本のまま引き継ぎ、変えるのは 3 点に限る。(1) 統合の意味: 登録済みの行も統合元にでき、統合元は一覧から消える。(2) 書込みの管理: 操作の記録・冪等キー・revision・画面の待ち行列・取り消し。(3) 名寄せの経路: 他画面の subs 集計もサブスク画面と同じ照合一覧から導く。前サイクルの §5.2・§6.3・§10 (選択バー) と本書が食い違う箇所は本書を優先する。

根拠の表記 (各項目の末尾に付ける):

- 〔決定 ID〕: 利用者が代替案を見て選んだ決定。qa-subsmerge-decision-001 (行チェックと詳細の両方から統合)、-002 (名寄せを全画面で共通化し、金額の母集団は各画面のまま)、-003・-004・-005 (操作ログで順次処理し、同時の 2 件目は 409 で画面が自動再試行、上限を超えたときだけ失敗を示す。DO・Queues・有料機能を足さない)、qa-subsmerge-undo-scope-001 (取り消しはテナントの全利用者)、qa-subsmerge-actor-record-001 (操作表に actor_user_id を外部キーなしで持つ)、qa-subsmerge-retention-001 (取り消し 30 日・記録 400 日・掃除は書込みのついで)。
- 〔観測 ID〕: system-spec に記録された観測事実 (qa-subsmerge-章名-web-evidence-001・-002)。
- 〔-003 由来〕: 利用者の決定の下で agent が置いた具体値 (qa-subsmerge-章名-web-003、system-spec の各章の「確定」行)。利用者は個々の値を選んでいない。
- 〔本書で置いた値〕: system-spec に無く、本書が現物との突き合わせから置いた値。agent 推定で、利用者は選んでいない。
- 〔現物 2026-09-30〕: 本書の作成時に現物で確かめた事実。

利用者価値 (U1): 名寄せを一度決めたら、一覧・KPI・月次推移・年換算の比較・詳細パネルと他画面のサブスク集計が 1 つの正本から同じ結果を示し、固定費を正しい単位で見直せる。操作が待機中・処理中・完了・失敗のどれで、誰が行ったかを利用者が把握できる。

成功状態 (U5・U4、目標 O1〜O4):

- O1: aquavoice 型 (登録済みの行を別の登録済みの行へ統合) で統合元の行が一覧から消え、統合先の推定月額を統合後の明細から再計算し、各月の実支払額を保存し、他画面のサブスク集計が同じ名寄せを示す。
- O2: 5 件連続・2 件同時の操作で 500 が 0 件。取り合いは明示的な 409 か 503 になり画面が自動で収束させ、最終の集計が最後に完了した操作と一致する。「サーバー側で処理に失敗しました」は 5xx と通信の失敗のときだけ出る。
- O3: 行チェック・全選択・選択バー・統合先・操作状態・操作者・取り消しの DOM テストが全件緑。
- O4: テナントに無い id は 404、取り消しで統合前の一覧に戻る、古い revision からの更新は未適用の 409、取り消しと記録の期限が守られる。
- `pnpm verify:full` と CI が緑。

## スコープ

- In (U7):
  - 統合の意味の是正: 登録済みの行を別の行へ統合でき、統合元の別名・見直し判断・対象科目を統合先へ吸収し、統合元の行を一覧から消す〔決定 qa-subsmerge-decision-001〕。
  - 一覧の行チェックと全選択、詳細パネルの取引名チェック、選択バーで統合先 (代表) を選ぶ複数件統合〔決定 qa-subsmerge-decision-001〕。
  - 統合の取り消しと操作履歴。取り消しはテナントの全利用者ができ、操作者を記録して辿れるようにする〔決定 qa-subsmerge-undo-scope-001・actor-record-001〕。
  - 名寄せを全画面で 1 つの照合一覧から導く。金額の母集団は各画面の定義を保つ〔決定 qa-subsmerge-decision-002〕。
  - サブスクの書込みの並行制御: 操作の記録・Idempotency-Key・revision による未適用の 409・書込みと subs 範囲の置き換えの原子化・画面の待ち行列・自動再試行・操作状態〔決定 qa-subsmerge-decision-003〜005〕。
  - 操作の記録の保持: 取り消しは 30 日、記録は 400 日。掃除は新しい書込みのついでに行う〔決定 qa-subsmerge-retention-001〕。
  - 上記に伴う API・D1 migration (0058)・テスト・文書 (`docs/subscriptions-screen.md`・`docs/data-schema.md`)。
- Out (U7):
  - 他画面 (概要・総収支・推移など) の画面デザインの作り直し。名寄せの共通化による集計の一致だけを行う。
  - freee / マネーフォワードの取込方式の変更。
  - 他画面の合計へのカード・銀行の未照合明細の算入〔決定 qa-subsmerge-decision-002〕。
  - AI による自動統合。候補と検出理由は出すが、統合の確定は利用者の操作だけで行う。
  - Web 以外の専用アプリ〔qa-subsmerge-target-platforms-002〕。
  - Durable Objects・Queues・新しい有料サービス・新しい夜間 job〔決定 qa-subsmerge-decision-005・retention-001〕。
  - 楽観更新。前サイクル §11 のまま、書込みの成功後に取り直す〔本書で置いた値〕。
  - 取り消しの権限を role や操作者で分けること〔決定 qa-subsmerge-undo-scope-001〕。

## 用語と主体

| Term/Actor | Definition/Responsibility |
|---|---|
| 利用者 | admin と member。全員が同じ共有テナントの業務データを扱い、個人事業と家計の収支を管理する。月次の見直しで同じサービスが別名で複数行に並ぶのを 1 つにまとめる (U6)。 |
| 運用者 | admin。利用者と同じ人物のこともある。止まった操作を画面の操作状態・操作履歴・Workers のログから辿り、再試行で収束させる (U6)。 |
| テナント | 業務データの所有者の単位。ログインした利用者は全員が同じ共有テナント id を `c.get('userId')` として受け取り (`packages/api/src/auth.ts:257-258`・`:276-277`、値は `:36` の `TENANT_ID = 'default'`)、業務データの user_id 列にはこの id が入る〔観測 qa-subsmerge-auth-web-evidence-002〕。 |
| 操作者 (actor) | 操作した利用者。認証後のミドルウェアがセッション cookie から設定する `c.get('actor')` (`auth.ts:38-43` の SessionActor: id・email・role・mustChangePassword) の id を `actor_user_id` に記録する〔決定 qa-subsmerge-actor-record-001〕。利用者を削除する API は無く、停止は `status='suspended'` で行う (`routes/admin-users.ts:110`)〔観測 qa-subsmerge-maintenance-ops-web-evidence-002〕。 |
| 統合先 (代表) | 統合後に 1 行として残る登録済みベンダー (`sub_vendors` の行で `merged_into_id` が NULL)。 |
| 統合元 | 統合先へ吸収される登録済みベンダー、または未登録の取引名。登録済みの統合元は行を消さず `merged_into_id` で統合先を指す〔-003 由来: qa-subsmerge-database-web-003〕。 |
| 名寄せ | 取引がどのサブスク (登録ベンダー) に属するかの判定。金額の母集団 (どの明細を数えるか) とは別の概念〔決定 qa-subsmerge-decision-002〕。 |
| 照合一覧 | core の `resolveVendorMerges(vendors)` が返す、統合を解決済みのベンダー一覧。`merged_into_id` の連鎖を推移的にたどり、統合元の name と aliases を最終的な統合先の照合対象へ展開し、統合元を単独の照合対象から外したもの〔-003 由来: qa-subsmerge-backend-web-003〕。 |
| 操作 | サブスクの書込み 1 回。`subscription_operations` の 1 行として記録する。kind は merge / unmerge / vendor_create / vendor_update / vendor_delete / review / review_decision / exclusion〔-003 由来: qa-subsmerge-database-web-003〕。 |
| revision | 共有テナントに 1 本だけ持つサブスク定義の版番号 (`subscription_revisions.revision`)。成功した操作ごとに 1 進む。別の利用者の同時の操作も同じ revision で検出する〔-003 由来: qa-subsmerge-database-web-003〕。 |
| baseRevision | 画面が最後に読んだ revision。書込みの本文で送り、現在値と違えば未適用の 409 subscription_revision_conflict。 |
| Idempotency-Key | 操作ごとに画面が 1 つ発行する要求ヘッダ。自動・手動の再試行でも同じ値を送り、同じ操作を二重に適用させない (出典 ietf-idempotency-key-header、draft-07)。一意の範囲は (テナント, 操作者, key)〔-003 由来: qa-subsmerge-security-web-003〕。 |
| canonical mutation lease | `import_writer_claims` のテナント単位の書込み権。取れなければ未適用の 409 canonical_write_busy〔観測 qa-subsmerge-infrastructure-web-evidence-001〕。 |
| subs 範囲 | `monthly_agg` のうち scope が `subs:` で始まる行と `subs_other` の行。他画面のサブスク集計の正本。 |
| 操作状態 | 画面が操作ごとに示す 待機中・処理中・完了・失敗 の 4 状態と操作者の email〔-003 由来: qa-subsmerge-ui-ux-web-003〕。 |
| 取り消しの期限 | created_at から 30 日。過ぎた操作は 410 undo_expired で、payload_json と before_json は掃除で NULL になる〔決定 qa-subsmerge-retention-001〕。 |

## ユースケースとユーザーフロー

「現行」「現物 2026-09-30」と付いた是正前の観測は開発着手前の記録。現行契約は機能要件と「確定した実装契約」に従う。

1. UC-1 一覧からの複数件統合: 利用者が一覧の行チェックで 2 行を選ぶ → 選択バーに「2件の取引を選択中」とチップが出る → 統合先の既定 (選択中の登録済み行のうち推定月額が最大の行) を確かめて「選択した2件を統合」を押す → 操作状態に自分の email と「待機中」→「処理中」→「完了」が出る → 取り直した一覧から統合元の行が消え、KPI・月次推移・年換算の比較・詳細パネルが統合先の 1 行で示される〔決定 qa-subsmerge-decision-001、既定は -003 由来: qa-subsmerge-ui-ux-web-003〕。
2. UC-2 詳細パネルからの統合: 利用者が行を開き、概要タブの「マッチした生の取引名」のチェックで取引名を選ぶ → 同じ選択バーに取引名のチップとして加わる → 統合先を選んで統合する。一覧の行と取引名を 1 回の統合に混ぜてよい。
3. UC-3 aquavoice 型: `/subscriptions?vendor=aquavoice` で登録済みの行を開き、統合先に別の登録済みの行を選んで統合する → 統合元の行が一覧から消え、URL の `?vendor=` が統合先へ置き換わる〔-003 由来: qa-subsmerge-frontend-web-003〕。現行は統合先の選択欄が未登録の行にしか出ず (`DetailOverview.tsx:168`)、登録済みの行では何も変わらない〔観測 qa-subsmerge-frontend-web-evidence-001〕。
4. UC-4 連続操作: 利用者が統合を 5 回続けて押す → 2 件目以降は「待機中」として積まれ、1 件ずつ送られる → 全件が「完了」になる。
5. UC-5 別の利用者との同時操作: 利用者 A と B がほぼ同時に統合を押す → 片方は lease を取れず 409 canonical_write_busy (未適用) になり、画面が同じ key で 1・2・4 秒後に自動で再送する (「別の操作を処理中です。自動で再試行します (n/3)」)。先の操作で revision が進んでいれば 409 subscription_revision_conflict (未適用) になり、画面は一覧を取り直す。統合先と統合元がまだ在り統合されていなければ、新しい baseRevision と新しい key で自動で送り直す (「他の利用者の操作が先に反映されました。最新の状態で送り直しています (n/3)」)。前提が崩れていれば送らず、理由を示す〔決定 qa-subsmerge-decision-004、文言は -003 由来: qa-subsmerge-ui-ux-web-003〕。
6. UC-6 取り消し: 操作状態の完了した統合の行にある「元に戻す」を押す → 取り消しの操作が待ち行列に積まれ、完了すると統合前の一覧に戻り、元の行は「(email) が元に戻しました」と示される。別の利用者が行った統合も取り消せる〔決定 qa-subsmerge-undo-scope-001〕。
7. UC-7 サーバー失敗: 5xx か通信の失敗で終わった操作は、適用されたか分からないので自動では送らず、「失敗」と「再試行」ボタンを示す → 再試行は同じ Idempotency-Key で送り、適用済みなら最初の結果が返り二重には反映されない。
8. UC-8 追跡: 運用者が 画面の操作状態 → `GET /api/subscription-operations?limit=20` → Workers の observability を操作 id で検索 の 3 段で、止まった操作と理由を辿る〔-003 由来: qa-subsmerge-maintenance-ops-web-003〕。
9. UC-9 期限切れ: 30 日を過ぎた統合は「元に戻す」が出ず、API は 410 undo_expired で「統合から 30 日を過ぎたため元に戻せません」を示す〔決定 qa-subsmerge-retention-001〕。

## 機能要件

- `FR-001`: 一覧の先頭列に行チェックを置き、ヘッダに全選択を置く。全選択は一部だけ選ばれているとき mixed (indeterminate) を示す〔-003 由来: qa-subsmerge-ui-ux-web-003〕。現行の列は `packages/web/src/pages/subscriptions/SubscriptionTable.tsx:89-97` の 8 列で、行チェックの列は無い〔現物 2026-09-30〕。前サイクルの DOM テスト `subscriptions-screen.dom.test.tsx:459-460` (一覧のチェックは 0 件) と :910-911 (統合のボタンは 1 つ・「名称を統合」は無い) の期待は、本書の FR-001・FR-004 で置き換える。
- `FR-002`: 一覧の選択は vendorKey の重複を持たない挿入順の `string[]` として `Subscriptions.tsx` に持ち、詳細パネルの取引名の選択と合わせて 1 つの選択バーへ渡す〔-003 由来: qa-subsmerge-frontend-web-003〕。現行の `Subscriptions.tsx:110` は生の取引名 (RawSelection) の配列だけを持つ〔現物 2026-09-30〕。
- `FR-003`: 選択バーは画面の下端に固定し (画像 09 と現行 `SelectionBar.tsx` の位置)、「N件の取引を選択中」、チップ (× で個別に外す)、統合先 (代表) の選択欄、「選択したN件を統合」「選択を解除」と、右端に「選択を解除」と同じ動作の × を並べる〔位置と右端の × は画像 09 に合わせて本書で置いた値。-003 の「一覧の直上」は画像の読み違いで、利用者の決定 qa-subsmerge-decision-001 は「画像どおり」〕。統合先の既定は選択中の登録済み行のうち推定月額が最大の行とし、core の純関数 `defaultMergeTarget` で決める〔-003 由来: qa-subsmerge-ui-ux-web-003・frontend-web-003〕。登録済みの行が選ばれていなければ既定は空 (null) にする。未登録の行は統合先 (登録済みのベンダー) になれないため〔本書で置いた値〕。未登録の行だけが選ばれているときは、統合先の選択欄で既存の登録済みベンダーから選ぶか、既存の「新しい統合先を登録」(`DetailOverview.tsx:280`) で先に登録する。登録の名前の初期値は最初に選んだ行の名前にする〔本書で置いた値〕。統合済みのベンダー (mergedIntoId が在る) は統合先の選択欄に出さない。
- `FR-004`: 登録済みの行も統合元にできる〔決定 qa-subsmerge-decision-001〕。詳細パネルに画像 09 の「名称を統合」を登録済み・未登録を問わず出し、押すとその行を選択に加えて選択バーへフォーカスを移す。統合の送信は選択バーの 1 か所だけにする〔画像 09、本書で置いた値〕。現行にこのボタンは無く (前サイクルの DOM テスト `subscriptions-screen.dom.test.tsx:911` が「無い」ことを確かめている)、`DetailOverview.tsx:168` の `row.status === 'unregistered'` のときだけ :169-200 に統合先の選択欄が出る〔現物 2026-09-30〕。統合先の選択欄は選択バーへ移して 1 か所にする〔本書で置いた値〕。
- `FR-005`: 統合で、登録済みの統合元は `merged_into_id` に統合先の id を持ち、行は消さない。未登録の取引名 (rawNames) は統合先の aliases へ足す。統合元の name と aliases は照合一覧で統合先の照合対象へ展開され、統合元は単独の照合対象から外れる。照合専用の `exactNames` に統合元の正規名も保持し、科目で絞った後、根の名前と統合元の正規名の完全一致を別名の部分一致より先に判定する。保存 aliases とは分ける〔-003 由来: qa-subsmerge-backend-web-003・database-web-003、core の現行実装へ同期〕。
- `FR-006`: 統合元の見直し判断 (`sub_vendor_review_decisions`) は統合先へ吸収する。統合先に判断が無いときは統合元の判断を統合先の vendor_key へ付け替え、統合先に判断があるときは統合先の判断を残して統合元の判断を消す。どちらも操作前の行を before_json に持ち、取り消しで戻す〔本書で置いた値〕。
- `FR-007`: 統合で、統合先の accounts (対象科目) に統合元の accounts を足す。統合先か統合元の accounts が空 (全科目) なら、統合後の統合先も空 (全科目) にする。操作前の統合先の accounts を before_json に持ち、取り消しで戻す〔本書で置いた値。O1 の各月の実支払額を保存するため。統合先の科目だけに絞ると、統合元にだけあった科目の取引が統合後に一致しなくなる〕。
- `FR-008`: 照合一覧を作る純関数 `resolveVendorMerges(vendors)` を core に足し、`matchSubVendor` はこの一覧だけを受ける。他画面の subs 集計 (`packages/core/src/dataset.ts:86` の applyFreeeDeals、:112-117)、サブスク画面の行の組み立て (`packages/core/src/subs-screen.ts:239` buildContext → :255 registeredVendorOf)、事業分の現金明細の射影 (`packages/api/src/store.ts:731` projectCashContribution、:760-766) が同じ一覧を通す〔-003 由来: qa-subsmerge-backend-web-003。現金明細の経路は現物 2026-09-30〕。循環と自己統合は例外にする。 `Dataset.subs` は統合元の正規名を保持する optional な派生 `exactNames` map を持ち、API loader が供給する。`subVendorDefs` と `sourceNeutralSubscriptions` の再構成でも照合へ渡し、clone・期間抽出で保持する。型宣言はcoreを正本とし、DB列や永続backup形式には追加しない。backup復元時は保存metadataから再構築する。
- `FR-009`: 照合の順序を 1 つにそろえる。現物は 2 通りある: `dataset.ts:112` は `matchSubVendor` に科目を渡し、`subs.ts:41-51` の eligibleForAccount で対象科目に合うベンダーへ先に絞ってから照合する。`expense-projection.ts:261-271` の registeredVendorOf は科目を渡さずに照合し (:265)、一致したベンダーの accounts で後から弾く (:270)〔現物 2026-09-30。U2 の観測 (3)〕。本書は `subs.ts:56-57` のコメント (科目での絞り込みは照合の前に行う) に合わせて先に絞る順序へそろえる〔本書で置いた値〕。 原本科目・正規化ラベル・複合表記 (`raw/normalized`) の互換照合は `subs.ts` の `eligibleForAccount` に集約し、`registeredVendorOf` は科目参照を `matchSubVendor` に渡す。呼出側に独自の科目filterを持たない。
- `FR-010`: サブスクの全ての書込みを操作として `subscription_operations` に actor_user_id 付きで記録する。対象は新しい統合と取り消しに加え、既存の sub-vendors の作成・更新・別名・削除・review、review-decisions の POST / DELETE、exclusions の POST / DELETE〔-003 由来: qa-subsmerge-backend-web-003〕。
- `FR-011`: 書込みは baseRevision を受け、現在の revision と違えば未適用の 409 subscription_revision_conflict を返す。既存の書込みは baseRevision を省略でき、省略時は現在値として扱う (移行期間の古い画面を壊さない)〔-003 由来: qa-subsmerge-backend-web-003〕。
- `FR-012`: 統合と取り消しは Idempotency-Key を必須とし、同じ key・kind・command (method/path)・正規化本文の再送は最初の結果 (操作 id と適用後の revision) を返す。既存の書込みは key を任意とし、付いていれば同じ扱いにする〔-003 由来: qa-subsmerge-backend-web-003。既存の書込みの扱いは本書で置いた値〕。
- `FR-013`: 書込みと subs 範囲の置き換えを 1 つの `db.batch` (統合は 10 文、取り消しは 11 文、統合先の削除は 9 文。構成は API 契約の Transaction boundary) で適用し、片方だけが反映された状態を残さない。統合・取り消しは全 Dataset の再計算 (`recomputeFromDeals`) を呼ばない〔決定 qa-subsmerge-decision-003、文の構成は -003 由来: qa-subsmerge-backend-web-003〕。
- `FR-014`: 画面の書込みは全て 1 つの書込み用フックを通し、TanStack Query v5 の `useMutation` に `scope: { id: 'subscriptions-write' }` を付けて 1 件ずつ実行する。後から押した操作は待機中として積む〔-003 由来: qa-subsmerge-frontend-web-003〕。
- `FR-015`: 409 canonical_write_busy と 503 d1_overloaded は、同じ key のまま 1 秒・2 秒・4 秒の間隔で最大 3 回自動で再送し、「別の操作を処理中です。自動で再試行します (n/3)」を示す〔決定 qa-subsmerge-decision-004、値は -003 由来: qa-subsmerge-frontend-web-003〕。
- `FR-016`: 409 subscription_revision_conflict は subscriptions を取り直し、操作の前提 (統合先と統合元がまだ在り、統合されていない) が保たれていれば、新しい baseRevision と新しい key で最大 3 回送り直す。前提が崩れていれば送らず「(統合元の名前) は他の操作で変更されたため、統合しませんでした。一覧を確認してもう一度選んでください」を示す〔-003 由来: qa-subsmerge-frontend-web-003・ui-ux-web-003〕。
- `FR-017`: 5xx と通信の失敗は自動では送らず、同じ key で送る「再試行」ボタンを出す。取り消しの 404・409 already_undone・409 undo_blocked_by_later_operation・410 undo_expired は再試行せず理由を示す〔-003 由来: qa-subsmerge-frontend-web-003〕。
- `FR-018`: 操作状態は一覧のカードの直下に「操作」として直近 5 件を 1 行ずつ出す。操作の記録も待機中の操作も無いときは出さない (画像 09 の構成を保つ)〔位置は本書で置いた値。選択バーを画面下端に固定するため、-003 の「選択バーの下」は置けない〕。`useMutationState` (この画面の待機中・処理中・失敗) と `GET /api/subscription-operations` (他の利用者を含む完了済み) を合わせ、各行に操作者の email、状態 (文字と design tokens の状態色)、取り消せる統合の行には「元に戻す」を付ける〔-003 由来: qa-subsmerge-frontend-web-003・ui-ux-web-003〕。 履歴取得の失敗は「操作」セクション内に理由と再取得ボタンを示す。成功mutationは、履歴に同じoperation idが確認され、同じ操作に失敗entryがないときだけcacheから整理する。未確認・idなし・失敗・待機中・処理中は保持し、履歴障害で操作が消えないようにする。
- `FR-019`: 完了した統合の「元に戻す」は取り消しの操作を積む。取り消しは統合前の別名・判断・対象科目・`merged_into_id` を before_json から戻す〔決定 qa-subsmerge-decision-001・undo-scope-001〕。
- `FR-020`: `GET /api/subscription-operations?limit=20` で直近の操作を新しい順に最大 20 件返す〔-003 由来: qa-subsmerge-backend-web-003〕。
- `FR-021`: 統合が完了したら選択を消し、URL の `?vendor=` が統合元を指していれば統合先へ置き換える〔-003 由来: qa-subsmerge-frontend-web-003〕。
- `FR-022`: 処理中 (scope に未完了の mutation がある間) は行チェック・全選択・取引名チェックを無効にする〔-003 由来: qa-subsmerge-frontend-web-003〕。現行の取引名チェックは処理中も押せる〔観測 qa-subsmerge-frontend-web-evidence-001〕。
- `FR-023`: 操作の記録は created_at から 30 日を過ぎたら payload_json と before_json を NULL にし、400 日を過ぎたら行を削除する。掃除は新しい書込みの batch に 2 文を足して 1 回 50 件ずつ行う〔決定 qa-subsmerge-retention-001、文の形は -003 由来: qa-subsmerge-database-web-003〕。

## 非機能要件

- Performance: 統合・取り消しの 1 要求で発行する D1 の問い合わせは、テナントの検査・現在の revision の読み取り・subs 範囲の入力の読み取り・`db.batch` 1 回 (9〜11 文)・lease の取得と解放を合わせて 20 文未満 (最悪は取り消しの 18 文) にし、Worker の 1 invocation の上限 50 (Workers Free、`packages/api/src/import-lifecycle.ts:304` の `D1_FREE_QUERY_LIMIT`) を超えない〔-003 由来: qa-subsmerge-infrastructure-web-003〕。monthly_agg の再挿入は `json_each(?)` の 1 文にし、1 文の bound parameter の上限 100 を避ける (出典 cloudflare-d1-limits)。
- Availability/Reliability: 5 件連続・2 件同時で 500 が 0 件 (O2)。canonical mutation の lease は取込の 15 分 (`IMPORT_CLAIM_TTL_MS`、import-lifecycle.ts:300) と分け、サブスク等は 2 分 (`CANONICAL_MUTATION_CLAIM_TTL_MS`) にする〔-003 由来: qa-subsmerge-infrastructure-web-003〕。`acquireImportWriter` は `ttlMs` を受け、既定は取込の TTL、canonical mutation fence はサブスク等の TTL を渡す。D1 の overloaded は 500 ではなく 503 d1_overloaded (retryable) で返す。
- Accessibility/Usability: 全選択の一部選択は native の checkbox の `indeterminate` で示し、支援技術には WAI-ARIA 1.2 の mixed として伝わる (出典 wai-aria-apg-checkbox)。既存の `packages/web/src/components/SelectionCheckbox.tsx` (:11 の indeterminate) を使い、`aria-checked` は重ねない〔本書で置いた値〕。操作状態は色だけに頼らず文字で示し、状態の変化は既存の `SelectionBar.tsx:30` と同じく `aria-live="polite"` で知らせる〔本書で置いた値〕。情報の優先度は 一覧の行 > 選択バー > 操作状態 > 詳細パネル > 年換算の比較・月次推移 で、狭い幅でもこの順に縦へ積む (選択バーは画面下端の固定のまま)〔-003 由来: qa-subsmerge-ui-ux-web-003〕。
- Security/Privacy: テナント (user_id) と操作者 (actor) はセッションからだけ特定し、本文・クエリ・ヘッダから受けない。テナントに無い id は存在を明かさず 404。observability のログには操作 id・kind・結果・所要 ms・actor の id だけを出し、取引名・別名・email・金額を出さない (OWASP ASVS 5.0 V16.2.5)。操作の記録は who・what・when を持つ (V16.2.1)〔-003 由来: qa-subsmerge-security-web-003、出典 owasp-asvs〕。
- Maintainability/Operability: 名寄せは core の 1 関数に置き、api と web は照合を持たない。色は `packages/core/src/design-tokens.ts` の値だけを使い、`packages/web/src` に hex を直書きしない (`pnpm lint` が検査)。テストのデータは匿名化済みの fixture と samples だけを使い、`samples/*.csv` は seed-local.mjs の生成物なので直接編集しない。

<a id="ui-state"></a>

## UI・状態遷移

- 画面/CLI/API状態:
  - 選択: 空 / 一部 (全選択は mixed) / 全件。
  - 操作 (1 件ごと): 待機中 → 処理中 → 完了 / 失敗 (再試行ボタン) / 失敗 (理由のみ)。処理中の間に自動再試行・自動送り直しの表示 (n/3) が重なる。
  - 画面全体: 読み込み中 / 表示中 / 処理中 (scope に未完了の操作がある) / エラー。
- 遷移条件:
  - 行チェックまたは取引名チェックを押す → 選択に加わる。選択が 1 件以上なら選択バーが出る。
  - 「選択したN件を統合」を押す → 操作を待機中として積む。統合先を除いた統合元が 0 件ならボタンを無効にする。
  - 前の操作が終わる → 次の待機中を処理中にして送る。
  - 200 → 完了。subscriptions・review queue・sub-vendors・sub-candidates・summary・subscription-operations を取り直す (`useSubscriptionWrites.ts` の `AFFECTED_QUERY_ROOTS`。操作の影響に応じた範囲を取り直し、操作履歴は全種類に含める)。統合なら選択を消し、`?vendor=` を置き換える。
  - 409 canonical_write_busy・503 d1_overloaded → 同じ key で 1・2・4 秒後に自動再送 (n/3)。3 回目も同じなら失敗 (再試行ボタン)。
  - 409 subscription_revision_conflict → 取り直して前提を検査し、保たれていれば新しい base と key で送り直す (n/3)。崩れていれば失敗 (理由のみ)。3 回目も衝突すれば失敗 (再試行ボタン)。
  - 5xx・通信の失敗 → 失敗 (再試行ボタン)。「再試行」は同じ Idempotency-Key で送る。
  - 取り消しの 404・409 already_undone・409 undo_blocked_by_later_operation・410 undo_expired → 失敗 (理由のみ)。
  - 完了した統合の「元に戻す」→ 取り消しの操作を待機中として積む。
- Loading/Empty/Error:
  - 読み込み中と空の表示は前サイクルのまま (`specs/spec-subscriptions-screen.md` §11)。
  - 操作状態の文言は原因と次の行動を 1 文ずつにする〔-003 由来: qa-subsmerge-ui-ux-web-003〕:
    - busy と 503: 「別の操作を処理中です。自動で再試行します (n/3)」
    - revision の送り直し: 「他の利用者の操作が先に反映されました。最新の状態で送り直しています (n/3)」
    - busy と 503 が 3 回目も続いたとき: 「別の操作が続いているため送れませんでした。少し待ってから再試行してください」と「再試行」ボタン〔本書で置いた値〕
    - revision の衝突が 3 回目も続いたとき: 「他の利用者の操作が続いたため送れませんでした。一覧を確認してから再試行してください」と「再試行」ボタン (押すと取り直して新しい base と key で送る)〔本書で置いた値〕
    - 前提が崩れたとき: 「(統合元の名前) は他の操作で変更されたため、統合しませんでした。一覧を確認してもう一度選んでください」
    - 5xx と通信の失敗: 「サーバー側で処理に失敗しました。同じ操作を再試行しても二重には反映されません」と「再試行」ボタン
    - 410: 「統合から 30 日を過ぎたため元に戻せません」
    - already_undone: 「すでに元に戻されています」
    - blocked: 「この統合の後に別の操作があるため元に戻せません。後の操作から順に戻してください」
    - 取り消された行: 「(email) が元に戻しました」
  - 操作者の表示: email。停止中の利用者も email で示し、users に行が無いときだけ「削除された利用者」とする〔決定 qa-subsmerge-actor-record-001 と 2026-09-30T14:09:17Z の訂正〕。
  - 現行の `packages/web/src/components/Page.tsx` の describeError (:87-100) は 5xx で「サーバー側で処理に失敗しました。少し待ってから、もう一度読み込んでください。…」を返す。操作状態の文言は describeError を通さず、エラーコードから直接決める〔本書で置いた値〕。

### 入力・再取得・タブの追加契約

- 名称入力の `maxLength` は BR-003 と同じ120。未編集の入力は最新の取得値に同期し、利用者が編集している値は上書きしない。
- 書込み成功後の無効化範囲を共通化し、履歴の再取得も同じ範囲を使う。
- 他画面のサブスク集計を変える操作 (登録・削除・統合・取り消しと、カテゴリ以外の登録内容の変更。`writeRequests.ts` の impactOf と `useSubscriptionWrites.ts` の AFFECTS_TOTALS) の成功後は、既存の `invalidateAnalysisDerived` で他画面の派生分析にも古い印を付け、次に開いたときに取り直させる。この画面に無い取得の完了は待たず、同じ scope の次の操作を遅らせない (G1・I3)。
- 詳細タブは既存の外観classを指定した `AccessibleTabs` を使い、共通のキーボード・ARIA動作に従う。
- 履歴の失敗表示とmutation整理の条件は FR-018。公開履歴型は core の `subscription-operation.ts` を参照し、画面側に独立したコピーを持たない。

## ビジネスルールと検証

- `BR-001`: 統合先はテナントの登録済みベンダー (`sub_vendors`) で、`merged_into_id` が NULL の行に限る。統合済みの行を統合先に選ぶと 422 merge_cycle とせず、画面は統合先の選択欄にその行を出さない。API は merged_into_id が NULL でない統合先を 409 subscription_revision_conflict として扱う (画面が古い)〔本書で置いた値〕。
- `BR-002`: 統合元 (sourceVendorIds) は 0〜50 件・重複なし、生の取引名 (rawNames) は 0〜50 件で、両方が空なら 400 empty_merge〔-003 由来: qa-subsmerge-security-web-003〕。
- `BR-003`: rawNames の各要素は 1〜120 文字・制御文字なし。-003 は 1〜200 文字とするが、現物の `packages/api/src/routes/subs.ts:45-51` は取引名・登録名・別名の上限を全経路で `SUB_VENDOR_NAME_MAX` (120、`packages/core/src/subs-screen.ts:21`) にそろえている〔現物 2026-09-30〕。取引名は統合先の別名として保存されるため、厳しい側の 120 を採る〔本書で置いた値〕。
- `BR-004`: 統合後の統合先の aliases (保存値) は 50 件まで (`routes/subs.ts:50` の `ALIASES_MAX`)。超えれば既存と同じ 400 too_many_aliases。照合一覧で展開された統合元の name と aliases は保存しないため、この上限に数えない〔本書で置いた値〕。
- `BR-005`: 自己統合 (統合先が統合元に含まれる) は 422 merge_cycle〔-003 由来: qa-subsmerge-security-web-003〕。循環 (統合先が統合元の子孫) は、子孫が必ず統合済み (merged_into_id が NULL でない) なので、BR-001 の 409 subscription_revision_conflict で未適用のまま止まる。書込みを確定する直前に照合一覧を組み立てて循環を検出したときの 422 merge_cycle は最後の守りで、BR-001 を通る限り届かない〔2026-10-01 の elegant review で実装の判定順に合わせた。回帰は api の `subs-merge-operations.integration.test.ts`〕。
- `BR-006`: targetId と sourceVendorIds の全件をテナントの `sub_vendors` から 1 回の問い合わせで引き、1 件でも無ければ 404 not_found。統合元のうち既に別の行へ統合済み (merged_into_id が NULL でない) のものがあれば 409 subscription_revision_conflict (画面が古い)〔-003 由来: qa-subsmerge-security-web-003。統合済みの扱いは本書で置いた値〕。
- `BR-007`: Idempotency-Key は8〜64文字の `[A-Za-z0-9-]`、一意範囲は `(user_id, actor_user_id, key)`。replayはkindと、正規化した本文にmethod/pathのcommandを含めたpayload_jsonの両方が一致したときだけ最初の結果を返す。別kind・別command・別本文は422 idempotency_key_reused。baseRevisionはpayloadから除く。payload_jsonを掃除で消した後は422 idempotency_key_expired。
- `BR-008`: baseRevision が現在の revision と違えば 409 subscription_revision_conflict で未適用。読んでから batch までの間の競合は、batch の (a) が 0 行になるか `UNIQUE (user_id, base_revision)` の制約違反で落ち、同じ 409 になる〔-003 由来: qa-subsmerge-backend-web-003〕。
- `BR-009`: 取り消せるのはテナントの kind='merge' で undone_at が NULL の操作だけで、操作者は問わない〔決定 qa-subsmerge-undo-scope-001〕。判定は次の順〔コードは -003 由来: qa-subsmerge-backend-web-003、判定の中身は本書で置いた値〕:
  1. テナントに無い操作 id、または kind が merge でない → 404 not_found (unmerge などは取り消しの対象として存在しない)。
  2. undone_at が NULL でない → 409 already_undone。
  3. created_at から 30 日を過ぎた、または before_json が NULL → 410 undo_expired (`routes/deletions.ts:327-336` の「無いではなくもう戻せない」と同じ区別)〔観測 qa-subsmerge-maintenance-ops-web-evidence-002〕。
  4. この操作より base_revision が大きい、未取り消しの merge・vendor_update・vendor_delete・review_decision の操作が、統合先か統合元の vendor に触れている → 409 undo_blocked_by_later_operation。統合元のいずれかの merged_into_id が今も統合先を指していない場合も同じ 409。 JSON復元で `restoreTouchesSubscriptions(writeSet)` が真だった操作境界より前のmergeは、before_jsonの `restoreBarrier=1` により同じ409で遮断する。一般のsettings restoreはこのbarrierを付けない。
- `BR-010`: 取り消しは before_json の値で統合元の merged_into_id を NULL へ、統合先の aliases と accounts を操作前へ、見直し判断を操作前へ戻す。元の操作の行は消さず undone_at を埋め、kind='unmerge'・undoes_id 付きの行を actor_user_id 付きで足す。revision は +1 する (戻さない)〔-003 由来: qa-subsmerge-database-web-003〕。
- `BR-011`: 金額の母集団は各画面の定義を保つ。サブスク画面はカード・銀行を含む照合後の実質支出、他画面の subs 範囲は freee 仕訳と事業分の現金明細から数える〔決定 qa-subsmerge-decision-002、現金明細は現物 2026-09-30: `store.ts:760-766`〕。
- `BR-012`: 復元した baseline に残る `subs:統合元の名前` の列は、Dataset を組むときに照合一覧で統合先の列へ合算する (`store.ts:585-597` の vendorSet と :1888-1891 の登録済みへの絞り込みの前)〔本書で置いた値〕。
- `BR-013`: 保持: created_at から 30 日を過ぎた行は payload_json と before_json を NULL にし、400 日を過ぎた行を削除する。掃除は `UPDATE … WHERE id IN (SELECT id … LIMIT 50)` と `DELETE … WHERE id IN (SELECT id … LIMIT 50)` の 2 文で、UPDATE/DELETE の直接の LIMIT は使わない〔決定 qa-subsmerge-retention-001、形は -003 由来: qa-subsmerge-database-web-003〕。UPDATE の対象は、30 日を過ぎ、payload_json か before_json がまだ NULL でない行に絞る。絞らないと同じ 50 件を毎回選び、掃除が先へ進まない〔本書で置いた値〕。書込みが無い期間は期限を過ぎた行が残るが、取り消せるかは created_at で判定する。2 文は書込みと同じ batch に入るので、失敗すれば書込みも戻る。取込の `purgeExpiredImportRows` (`routes/imports.ts:2911-2919`) は別の try で失敗を握りつぶすが、本書は 1 回の batch に収めるためこの扱いを採らない。2 文は id の IN と LIMIT だけで、失敗の要因は書込み本体と共通である〔本書で置いた値〕。

## API契約

新設 3 本と変更 2 種を endpoint ごとに書く。エラーの本文は既存と同じ `{ "error": { "code": "…", "message": "…" } }` (例: `routes/subs.ts:131`)。503 d1_overloaded だけは `{ "error": { "code": "d1_overloaded", "message": "…", "retryable": true } }` とする。zod の検証失敗は既存の `zValidator` の既定の 400〔現物 2026-09-30〕。

### サブスク読取の共通スナップショット契約

全サブスクGETは `subscriptionReadSnapshot` で前後のstampを検査する。stampはsubscription revision、有効なwriter claim、settings_change_logのcount/max seq、import_runsのcount/max updated_at/committed件数。前後で一致しwriterが不在のときだけ内容とrevisionを返す。不一致またはwriterが存在すれば未整合の内容を返さず409 canonical_write_busyとする。

GETはleaseを取得しないため、GET同士は並列に実行できる。同じ要求内で再読取りは行わず、query予算を増幅させない。利用者・画面は別の取得要求で取り直す。読取の応答は成否 (200・404・409 など) を問わず private, no-store とし、付ける入口を `subscriptionReadSnapshot` の 1 か所にする。各GETのError contractにも409 canonical_write_busyを適用する。

### API: sub-vendors-merge

#### 識別と目的

- Operation ID: `mergeSubVendors`
- Method/Path: `POST /api/sub-vendors/merge`
- Purpose: 登録済みの行と生の取引名を 1 つの統合先へまとめる〔決定 qa-subsmerge-decision-001〕。
- Version/Lifecycle: 新設。/api にバージョンの接頭辞は無い (`packages/api/src/index.ts:136` で subsRoute を /api に載せる)。既存の `POST /api/sub-vendors/:id/aliases` は残し、画面の統合には使わない。新しい 3 本はすべて subsRoute (`routes/subs.ts`) に登録する。`subscription-writes.ts` は統合・取り消し・一覧の handler と共通の db.batch の組み立てを持つ補助の module で、/api へ別の route として載せない〔本書で置いた値〕。

#### 認証・認可

- Authentication: セッション cookie (httpOnly・secure・SameSite=Strict、`packages/api/src/auth.ts:128-135`)。`authGuard` (:245、index.ts:111) の配下。
- Required scopes/roles: admin・member のどちらでも呼べる。`mustChangePasswordFence` (auth.ts:287、index.ts:113) と `canonicalMutationFence` (index.ts:115) の配下〔-003 由来: qa-subsmerge-auth-web-003〕。
- Resource ownership check: `c.get('userId')` で `sub_vendors` を絞って targetId と sourceVendorIds を 1 回で引く (BR-006)。操作者は `c.get('actor').id`。

#### Request

- Headers: `Idempotency-Key` (必須、8〜64 文字の `[A-Za-z0-9-]`)、`Content-Type: application/json`。
- Path parameters: N/A: path に変数は無い。
- Query parameters: N/A: クエリは受けない。
- Body schema: `targetId` 正の整数・必須 / `sourceVendorIds` 正の整数の配列・0〜50 件・重複なし / `rawNames` 文字列の配列・0〜50 件・各 1〜120 文字・制御文字なし / `baseRevision` 0 以上の整数・必須。未知のキー (user_id・actor など) は無視する。
- Example: `{"targetId": 12, "sourceVendorIds": [34], "rawNames": ["SPOTIFY.COM"], "baseRevision": 7}` (ヘッダ `Idempotency-Key: 5f1c2a9e-0d7b-4c1e-9a55-2b8e6f1d3c40`)。

#### Response

| Status | Meaning | Schema |
|---|---|---|
| 200 | 統合を適用した、または同じ key・kind・command (method/path)・正規化本文の再送 | `{ operation: { id, kind: "merge", targetVendorId, createdAt }, revision, replayed }` |

- Headers: `Cache-Control: private, no-store` (`routes/subs.ts:405` の PRIVATE_NO_STORE と同じ)。
- Example: `{"operation": {"id": "op_3f2a…", "kind": "merge", "targetVendorId": 12, "createdAt": "2026-09-30T09:00:00.000Z"}, "revision": 8, "replayed": false}`

#### Validation・ビジネスルール

- BR-001〜BR-008 と FR-005〜FR-007 を適用する。rawNames のうち統合先の照合で既に一致する名前は足さない (既存の cleanAliases、`routes/subs.ts:71-79`)。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
|---|---|---|---|---|
| 400 | (zValidator の既定) | 本文の型・件数・長さ・文字種の違反 | no | 入力を直す |
| 400 | idempotency_key_required | Idempotency-Key が無い、形式が違う | no | 画面の不具合として扱う |
| 400 | empty_merge | sourceVendorIds と rawNames が両方空 | no | 選択し直す |
| 400 | too_many_aliases | 統合後の aliases が 50 件を超える | no | 統合する取引名を減らす |
| 401 | unauthorized | セッションが無い | no | ログインし直す |
| 403 | password_change_required | 初期パスワードのまま | no | パスワードを変える |
| 404 | not_found | targetId か sourceVendorIds の 1 件以上がテナントに無い | no | 一覧を取り直す |
| 409 | canonical_write_busy | 別の書込みが lease を持つ (未適用) | yes | 同じ key で 1・2・4 秒後に最大 3 回 |
| 409 | subscription_revision_conflict | baseRevision が現在値と違う、統合先・統合元が統合済み (未適用) | yes (条件付き) | 取り直して前提を検査し、新しい base と key で最大 3 回 |
| 422 | merge_cycle | 自己統合 (循環は BR-001 の 409 で先に止まる。BR-005) | no | 統合先を選び直す |
| 422 | idempotency_key_reused | 同じ key でkind・command・正規化本文が違う | no | 画面の不具合として扱う |
| 422 | idempotency_key_expired | 30 日を過ぎて本文を消した key の再送 | no | 一覧を取り直す |
| 503 | d1_overloaded | D1 が overloaded を返した (未適用) | yes | 同じ key で 1・2・4 秒後に最大 3 回 |
| 503 | schema_unavailable | migration の適用待ち (`schema-guard.ts:80`) | no | 時間をおいて再読込 |

コード名のうち idempotency_key_required と empty_merge は本書で置いた値、それ以外の新しいコードは -003 由来。

#### 実行セマンティクス

- Idempotency key/replay: 処理の前に `(user_id, actor_user_id, idempotency_key)` で操作を引く。あればBR-007に従いkindと、command (method/path) を含む正規化本文のpayload_jsonを照合する。両方一致すれば保存済みの操作と、その操作が進めた revision (base_revision + 1) から応答を組み立てて 200 (`replayed: true`) を返す。payload_json が NULL なら 422 idempotency_key_expired、kind・command・本文のいずれかが違えば 422 idempotency_key_reused。baseRevisionは比較対象から除く。応答の本文は保存しない〔本書で置いた値〕。
- Concurrency/optimistic lock: 処理の前に `subscription_revisions` を読み、baseRevision と違えば 409。読んでから batch までの競合は batch の (a) が落とす。
- Transaction boundary: 1 つの `db.batch` に次の文を並べる〔-003 由来: qa-subsmerge-backend-web-003、(b) の分け方は本書で置いた値〕。(a) 操作の行の挿入 (`INSERT … SELECT … WHERE` 現在の revision = baseRevision。不一致なら 0 行)、(b1) 統合元の merged_into_id と統合先の aliases・accounts を `UPDATE … FROM json_each(?)` の 1 文で書く、(b2) 統合先に判断が無ければ統合元の判断を統合先の vendor_key へ付け替える、(b3) 残った統合元の判断を消す (FR-006)、(c) `subscription_revisions` の +1、(d) `monthly_agg` の subs:* と subs_other の削除、(e) `json_each(?)` による 1 文での再挿入、(f) JSON snapshot の無効化 (`import-active.ts` の INVALIDATE_JSON_ACTIVE_SQL)、(g) 30 日を過ぎ、payload_json か before_json がまだ NULL でない行の NULL 化 (50 件まで)、(h) 400 日を過ぎた行の削除 (50 件まで)。(a) 以外の文は全て「この操作の行が在る」ことを条件にする。(a) の変更行数が 0 なら未適用として 409 subscription_revision_conflict。統合の batch は 10 文 ((a)・(b1)〜(b3)・(c)〜(h)) で、fence・状態の読み取り・subs 範囲の入力を足した最悪は 17 文とし、20 未満の予算に収める。D1 の batch は 1 つのトランザクションとして実行され、途中の文が失敗すれば全体が戻る (出典 cloudflare-d1-batch)。
- (d)(e) の入力: freee 仕訳のうちサブスク対象の支出と事業分の現金明細を読み、統合後の照合一覧で名寄せし直した subs:* と subs_other の行を Worker で組み立てて `json_each(?)` の 1 つの JSON で渡す〔本書で置いた値。-003 は freee 仕訳だけを挙げるが、現物の subs 範囲には現金明細も入る (`store.ts:760-766`)〕。
- Timeout/retry/rate limit: fence の lease (2 分) でテナントごとに 1 本へ直列化する。取れなければ 409 canonical_write_busy。レート制限は置かない。

#### キャッシュ・ページング

- Cache/ETag: `private, no-store`。ETag は使わず revision を本文で返す。
- Cursor/limit/filter/sort: N/A: 一覧を返さない。

#### 可観測性と監査

- Request/correlation ID: 既存の `requestId` (hono/request-id、`index.ts:58`)。
- Metrics/logs/audit/redaction: 操作 id・kind・結果・所要 ms・actor の id だけをログに出し、取引名・別名・email・金額を出さない。監査の正本は `subscription_operations` の行 (who=actor_user_id、what=kind と target、when=created_at)〔-003 由来: qa-subsmerge-security-web-003〕。

#### セキュリティ確認

- Input/output validation: zod で本文を検証し、制御文字を拒む。
- Sensitive data exposure: 応答に取引の金額・日付・口座・before_json を含めない。
- Abuse/authorization tests: テナントに無い targetId / sourceVendorIds は 404。本文に user_id や actor を入れても無視される。

#### Contract tests

- Positive: 登録済み 2 行の統合で統合元の行が一覧から消え、統合先の推定月額が統合後の明細から再計算され、各月の実支払額が保存される。
- Boundary: sourceVendorIds 50 件は受理、51 件は 400。rawNames の 120 文字は受理、121 文字は 400。
- Negative/auth/error/idempotency: テナントに無い id は 404、自己統合は 422 merge_cycle、古い baseRevision は 409 で未適用、同じ key の再送は 1 回だけ適用、同じ key で別のkind・command・本文は 422 idempotency_key_reused、31 日前の key の再送は 422 idempotency_key_expired。

### API: subscription-operation-undo

#### 識別と目的

- Operation ID: `undoSubscriptionOperation`
- Method/Path: `POST /api/subscription-operations/{id}/undo`
- Purpose: 統合を取り消し、統合前の別名・判断・対象科目・参照へ戻す〔決定 qa-subsmerge-decision-001・undo-scope-001〕。
- Version/Lifecycle: 新設。

#### 認証・認可

- Authentication: merge と同じ。
- Required scopes/roles: merge と同じ fence の配下。role と操作者では絞らない〔決定 qa-subsmerge-undo-scope-001〕。
- Resource ownership check: `(id, user_id)` で操作を引き、無ければ 404〔-003 由来: qa-subsmerge-auth-web-003〕。

#### Request

- Headers: `Idempotency-Key` (必須、merge と同じ形式)。
- Path parameters: `id` 操作 id (文字列、1〜64 文字の `[A-Za-z0-9_-]`)。
- Query parameters: N/A: クエリは受けない。
- Body schema: `baseRevision` 0 以上の整数・必須。
- Example: `{"baseRevision": 8}`

#### Response

| Status | Meaning | Schema |
|---|---|---|
| 200 | 取り消しを適用した、またはBR-007を満たす再送 | `{ operation: { id, kind: "unmerge", undoesId, createdAt }, revision, replayed }` |

- Headers: `Cache-Control: private, no-store`。
- Example: `{"operation": {"id": "op_7c1d…", "kind": "unmerge", "undoesId": "op_3f2a…", "createdAt": "2026-09-30T09:01:00.000Z"}, "revision": 9, "replayed": false}`

#### Validation・ビジネスルール

- BR-009 と BR-010 を適用する。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
|---|---|---|---|---|
| 404 | not_found | テナントの統合の操作に無い | no | 理由を示す |
| 409 | already_undone | 取り消し済み | no | 「すでに元に戻されています」 |
| 409 | undo_blocked_by_later_operation | 触れたベンダーに後続の未取り消しの操作がある | no | 後の操作から順に戻す |
| 410 | undo_expired | 30 日を過ぎた、または変更前の内容を消した | no | 「統合から 30 日を過ぎたため元に戻せません」 |
| 409 | subscription_revision_conflict | baseRevision が現在値と違う (未適用) | yes (条件付き) | 取り直して取り消しの可否を再検査し、新しい base と key で送り直す |
| 409 | canonical_write_busy | lease を取れない (未適用) | yes | 自動再送 |
| 400 / 401 / 403 / 422 / 503 | merge と同じ | merge と同じ | merge と同じ | merge と同じ |

#### 実行セマンティクス

- Idempotency key/replay: merge と同じ。payload_json は `{ undoesId, command }` (commandはmethod/path、BR-007)。
- Concurrency/optimistic lock: merge と同じ。
- Transaction boundary: merge と同じ形の `db.batch` で 11 文。(a) は unmerge の行の挿入。(b1) before_json の値で統合元の merged_into_id を NULL へ、統合先の aliases・accounts を操作前へ戻す、(b2) 元の操作の undone_at を埋める、(b3) 統合先と統合元の vendor_key の判断を消す、(b4) before_json の判断を入れ直す。(c)〜(h) は merge と同じ。fence などを足した最悪は 18 文〔(b) の分け方は本書で置いた値〕。
- Timeout/retry/rate limit: merge と同じ。

#### キャッシュ・ページング

- Cache/ETag: `private, no-store`。
- Cursor/limit/filter/sort: N/A: 一覧を返さない。

#### 可観測性と監査

- Request/correlation ID: `requestId`。
- Metrics/logs/audit/redaction: 操作 id・undoes の id・結果・所要 ms・actor の id だけ。

#### セキュリティ確認

- Input/output validation: path の id の長さと文字種を検証する。
- Sensitive data exposure: 応答に before_json を含めない。
- Abuse/authorization tests: テナントに無い操作 id は 404。別の利用者の統合の取り消しは 200 で、両方の actor_user_id が残る。

#### Contract tests

- Positive: 統合 → 取り消しで、統合前と同じ一覧と同じ subs 範囲に戻る。別の利用者の統合も取り消せる。
- Boundary: 29 日前の統合は受理、31 日前の created_at は 410 undo_expired。後続の統合が同じ統合先に触れていれば 409 undo_blocked_by_later_operation。
- Negative/auth/error/idempotency: テナントに無い id は 404、二重の取り消しは 409 already_undone、同じ key の再送は 1 回だけ適用。

### API: subscription-operations-list

#### 識別と目的

- Operation ID: `listSubscriptionOperations`
- Method/Path: `GET /api/subscription-operations`
- Purpose: 直近の操作を辿る (運用者の追跡と、画面の操作状態の完了済みの行・「元に戻す」の可否)〔-003 由来: qa-subsmerge-backend-web-003〕。
- Version/Lifecycle: 新設。

#### 認証・認可

- Authentication: merge と同じ。
- Required scopes/roles: `authGuard`・`mustChangePasswordFence` の配下。読み取りなので canonical mutation の lease は取らない。
- Resource ownership check: `user_id = c.get('userId')` で絞る。操作者では絞らない〔決定 qa-subsmerge-undo-scope-001〕。

#### Request

- Headers: N/A: 追加のヘッダは無い。
- Path parameters: N/A: path に変数は無い。
- Query parameters: `limit` 整数 1〜20・既定 20〔-003 由来: qa-subsmerge-backend-web-003〕。
- Body schema: N/A: GET。
- Example: `GET /api/subscription-operations?limit=20`

#### Response

| Status | Meaning | Schema |
|---|---|---|
| 200 | 直近の操作 | `{ operations: [{ id, kind, targetVendorName, createdAt, actorEmail, undoneAt, undoneByEmail, undoable, undoBlockedReason }], revision }` |

- Headers: `Cache-Control: private, no-store`。
- Example: `{"operations": [{"id": "op_3f2a…", "kind": "merge", "targetVendorName": "Notion", "createdAt": "2026-09-30T09:00:00.000Z", "actorEmail": "member@example.test", "undoneAt": null, "undoneByEmail": null, "undoable": true, "undoBlockedReason": null}], "revision": 8}`
- actorEmail は users に行が無ければ null とし、画面が「削除された利用者」と示す。undoBlockedReason は `already_undone` / `undo_expired` / `undo_blocked_by_later_operation` / `not_merge` / null〔本書で置いた値〕。

#### Validation・ビジネスルール

- 並びは created_at の新しい順 (同時刻は base_revision の大きい順)。payload_json・before_json・Idempotency-Key は返さない。undoable は BR-009 を満たすかを返す。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
|---|---|---|---|---|
| 400 | (zValidator の既定) | limit が範囲外 | no | 既定で取り直す |
| 401 | unauthorized | セッションが無い | no | ログインし直す |
| 403 | password_change_required | 初期パスワードのまま | no | パスワードを変える |
| 409 | canonical_write_busy | 読取前後のstampが不一致、またはwriterが存在 | yes | 別のGET要求で取り直す |
| 503 | schema_unavailable | migration の適用待ち | no | 時間をおいて再読込 |

#### 実行セマンティクス

- Idempotency key/replay: N/A: 読み取り。
- Concurrency/optimistic lock: 共通スナップショット契約で検査済みのrevisionだけをbaseRevisionとして使う。
- Transaction boundary: 操作・操作者・取り消し可否とrevisionを読取の共通スナップショット検査で包む。lease取得や同じ要求内の再読取りは行わない。
- Timeout/retry/rate limit: 画面の既定の再取得に従う。

#### キャッシュ・ページング

- Cache/ETag: `private, no-store`。
- Cursor/limit/filter/sort: limit だけ。カーソルは置かない。索引 `(user_id, created_at)`。

#### 可観測性と監査

- Request/correlation ID: `requestId`。
- Metrics/logs/audit/redaction: 通常の読み取りと同じ。email は応答にだけ含め、ログには出さない。

#### セキュリティ確認

- Input/output validation: limit を整数 1〜20 に限る。
- Sensitive data exposure: 取引名・別名・金額・before_json・payload_json・key を含めない。
- Abuse/authorization tests: 別の user_id の操作が混ざらない。

#### Contract tests

- Positive: 統合 2 件と取り消し 1 件が新しい順に返り、それぞれの操作者の email が付く。
- Boundary: limit=1 と limit=20 は受理、0 と 21 は 400。
- Negative/auth/error/idempotency: 他テナントの操作が 0 件。users に行が無い操作者は actorEmail が null。

### API: subscriptions-read-revision (変更)

#### 識別と目的

- Operation ID: `getSubscriptions` (既存)
- Method/Path: `GET /api/subscriptions` (`routes/subs.ts:408`)
- Purpose: 応答に revision を足し、画面が次の書込みの baseRevision に使う〔-003 由来: qa-subsmerge-backend-web-003〕。
- Version/Lifecycle: 加法的な変更。既存のキーは変えない。`GET /api/sub-vendors` にも同じ revision と、各ベンダーの `mergedIntoId` (統合済みなら統合先の id、未統合なら null) を足す。画面はこれで統合済みのベンダーを統合先の選択欄から外す〔本書で置いた値〕。

#### 認証・認可

- Authentication: 既存のまま。
- Required scopes/roles: 既存のまま。
- Resource ownership check: 既存のまま (`c.get('userId')`)。

#### Request

- Headers: N/A: 変更なし。
- Path parameters: N/A: 変更なし。
- Query parameters: 既存の期間 (`periodQueryOf`) のまま。
- Body schema: N/A: GET。
- Example: `GET /api/subscriptions`

#### Response

| Status | Meaning | Schema |
|---|---|---|
| 200 | 画面 1 本ぶんの集計 | 既存の `subscriptionsScreen` の応答 + `revision` (整数) |

- Headers: 既存の `Cache-Control: private, no-store` (`routes/subs.ts:405`・:410)。
- Example: `{"…既存のキー…": "…", "revision": 8}`

#### Validation・ビジネスルール

- revision は `subscription_revisions` の現在値。行が無ければ 0。統合済みの行 (merged_into_id が NULL でない) は一覧に出さない (照合一覧を通すため)。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
|---|---|---|---|---|
| 401 | unauthorized | セッションが無い | no | ログインし直す |
| 409 | canonical_write_busy | 読取前後のstampが不一致、またはwriterが存在 | yes | 別のGET要求で取り直す |
| 503 | schema_unavailable | migration の適用待ち | no | 時間をおいて再読込 |

#### 実行セマンティクス

- Idempotency key/replay: N/A: 読み取り。
- Concurrency/optimistic lock: 応答の revision が以後の書込みの基準になる。
- Transaction boundary: 入力とrevisionを読む処理全体を共通スナップショット検査で包み、整合した応答だけ返す。
- Timeout/retry/rate limit: 変更なし。

#### キャッシュ・ページング

- Cache/ETag: 変更なし。
- Cursor/limit/filter/sort: 変更なし。

#### 可観測性と監査

- Request/correlation ID: `requestId`。
- Metrics/logs/audit/redaction: 変更なし。

#### セキュリティ確認

- Input/output validation: 変更なし。
- Sensitive data exposure: revision はテナントの版番号で、他テナントの情報を含まない。
- Abuse/authorization tests: 既存の scope テスト (`packages/api/src/subs-vendor-scope.test.ts`) のまま。

#### Contract tests

- Positive: 書込み 1 回で revision が 1 進む。
- Boundary: 初回 (行が無い) は 0。
- Negative/auth/error/idempotency: 失敗した書込み (409・404・422) で revision が進まない。

### API: subscription-writes-base-revision (変更)

#### 識別と目的

- Operation ID: 既存の書込み 9 本 (`POST /api/sub-vendors` :125、`PUT /api/sub-vendors/:id` :157、`POST /api/sub-vendors/:id/aliases` :208、`DELETE /api/sub-vendors/:id` :232、`POST /api/sub-vendors/exclusions` :285、`DELETE /api/sub-vendors/exclusions/:id` :304、`POST /api/sub-vendors/:id/review` :323、`POST /api/subscriptions/review-decisions` :435、`DELETE /api/subscriptions/review-decisions` :468)。行番号は `routes/subs.ts` の現物 2026-09-30。
- Method/Path: 上記のまま。
- Purpose: baseRevision による未適用の 409 と操作の記録 (actor 付き) を既存の書込みにも効かせる〔-003 由来: qa-subsmerge-backend-web-003〕。
- Version/Lifecycle: 加法的な変更。baseRevision は省略でき、省略時は現在値として扱う。

#### 認証・認可

- Authentication: 既存のまま。
- Required scopes/roles: 既存のまま (いずれも `canonical-mutation-fence.ts:219-249` の対象)。
- Resource ownership check: 既存のまま。

#### Request

- Headers: `Idempotency-Key` は任意。付いていれば merge と同じ扱い。省略されたときは、操作の行の idempotency_key (NOT NULL) に操作 id と同じ値を入れる〔本書で置いた値〕。
- Path parameters: 既存のまま。
- Query parameters: 既存のまま。
- Body schema: 既存の本文に `baseRevision` (0 以上の整数・任意) を足す。本文の無い DELETE と review は、本文が無ければ省略とみなす。
- Example: `PUT /api/sub-vendors/12` `{"category": "音楽", "baseRevision": 8}`

#### Response

| Status | Meaning | Schema |
|---|---|---|
| 200 / 201 | 既存どおり | 既存の本文 + `revision` |

- Headers: 既存のまま。
- Example: 既存の本文に `"revision": 9` が加わる。

#### Validation・ビジネスルール

- baseRevision があれば BR-008 を適用する。現行の PUT は `b.aliases ?? target.aliases` で別名を丸ごと上書きし (`routes/subs.ts:190`)、古い画面の値を検出しない〔観測 qa-subsmerge-security-web-evidence-001〕。統合済みの行 (merged_into_id が NULL でない) への PUT・aliases・review・DELETE は 409 subscription_revision_conflict とする〔本書で置いた値〕。統合先の DELETE は、それを指す統合元もまとめて消し、まとまりの全ての vendor_key の見直し判断を消す。どちらも同じ `db.batch` の 2 文 (9 文の batch) で行う〔本書で置いた値。統合元だけが独立した行として一覧へ戻ると、利用者が消したつもりのサブスクが名前を変えて残るため〕。

#### Error contract

| HTTP | Code | Condition | Retryable | Client action |
|---|---|---|---|---|
| 409 | subscription_revision_conflict | baseRevision が現在値と違う、対象が統合済み (未適用) | yes (条件付き) | 取り直して送り直す |
| 503 | d1_overloaded | D1 が overloaded (未適用) | yes | 自動再送 |
| 既存 | 既存のコード | 既存の条件 | 既存 | 既存 |

#### 実行セマンティクス

- Idempotency key/replay: key があるときだけ merge と同じ。`POST /api/sub-vendors` (vendor_create) の再送は、最初に作った行の id (操作の行の target_vendor_id) を本文の `id` に入れて返す。画面は再送でも作った行を開ける〔2026-10-01 の elegant review で置いた値。回帰は api の `subs-merge-operations.integration.test.ts`〕。
- Concurrency/optimistic lock: baseRevision があるときは照合し、無いときは読んだ現在値を base として (a) の条件に使う。
- Transaction boundary: 現行は別名の書込み (:221-227 の batch) と再集計 (:228 の recomputeFromDeals) が別の batch で、再集計の失敗後の再試行は :220 の早期 return で集計が古いまま残る〔観測 qa-subsmerge-database-web-evidence-001〕。本書では操作の行・revision の +1・掃除を同じ batch に入れる。名寄せに効く書込み (作成・更新・別名・削除) は subs 範囲の置き換えも同じ batch に入れる〔本書で置いた値〕。
- Timeout/retry/rate limit: 既存のまま。

#### キャッシュ・ページング

- Cache/ETag: 既存のまま。
- Cursor/limit/filter/sort: N/A: 一覧を返さない。

#### 可観測性と監査

- Request/correlation ID: `requestId`。
- Metrics/logs/audit/redaction: 操作 id・kind・結果・所要 ms・actor の id。

#### セキュリティ確認

- Input/output validation: 既存の zod に baseRevision を足す。
- Sensitive data exposure: 変更なし。
- Abuse/authorization tests: 既存の scope テストのまま。

#### Contract tests

- Positive: baseRevision 付きの PUT が 200 で revision を 1 進め、操作が actor 付きで記録される。
- Boundary: baseRevision を省いた PUT が従来どおり 200。
- Negative/auth/error/idempotency: 古い baseRevision の PUT が 409 で、sub_vendors と revision が変わらない。

## データモデル

- Entity/Value:
  - `sub_vendors` (既存、0005): 登録ベンダー。`merged_into_id` を足す。
  - `subscription_operations` (新設): サブスクの操作の記録。
  - `subscription_revisions` (新設): テナントごとの revision。
  - `monthly_agg` の subs 範囲 (既存): 他画面のサブスク集計。統合先の名前でだけ書く。
  - 照合一覧 (保存しない値): `resolveVendorMerges` の結果。
- Fields/Types/Nullability (migration `0058_subscription_merge_operations.sql`)〔-003 由来: qa-subsmerge-database-web-003〕:
  - `sub_vendors.merged_into_id INTEGER NULL`: 統合先の `sub_vendors.id` (同じ user_id の行だけ)。NULL は統合されていない行。
  - `subscription_operations`: `id TEXT PRIMARY KEY`、`user_id TEXT NOT NULL` (共有テナントのキー)、`actor_user_id TEXT NOT NULL` (操作した利用者の users.id、外部キーなし)、`idempotency_key TEXT NOT NULL` (省略できる既存の書込みでは操作 id と同じ値)、`kind TEXT NOT NULL CHECK (kind IN ('merge','unmerge','vendor_create','vendor_update','vendor_delete','review','review_decision','exclusion'))`、`target_vendor_id INTEGER`、`payload_json TEXT NULL`、`before_json TEXT NULL`、`base_revision INTEGER NOT NULL`、`undoes_id TEXT`、`undone_at TEXT`、`created_at TEXT NOT NULL`。時刻の列は既存の nowIso と同じ `toISOString()` の形 (UTC、ミリ秒、末尾 Z) にそろえ、文字列の大小を時刻の前後と一致させる〔本書で置いた値〕。
  - `subscription_revisions`: `user_id TEXT PRIMARY KEY`、`revision INTEGER NOT NULL`、`updated_at TEXT NOT NULL`。
- Relations/Constraints/Indexes:
  - `subscription_operations`: `UNIQUE (user_id, actor_user_id, idempotency_key)`、`UNIQUE (user_id, base_revision)`、`INDEX (user_id, created_at)`。
  - actor_user_id に外部キーを付けない。0046 の `liability_audit_log` と同じく、users の行が無くなっても記録を残すため〔決定 qa-subsmerge-actor-record-001、観測 qa-subsmerge-maintenance-ops-web-evidence-002 (0046:19)〕。
  - `merged_into_id` の同じ user_id と循環の禁止は API が検査する (SQLite の外部キーでは user_id の一致を表せないため)〔本書で置いた値〕。同じテナントの行を指さない merged_into_id は、`resolveVendorMerges` が統合なしとして扱う (画面は壊れない)〔本書で置いた値〕。
  - 既存の `sub_vendors` は `UNIQUE(user_id, name)` を持つ (0005)〔観測 qa-subsmerge-database-web-evidence-001〕。統合元の行を残すため、統合元と同じ名前の新規登録は既存の 409 duplicate (`routes/subs.ts:131`) になる。
- Ownership/Retention/Migration:
  - 操作の行は取り消しでは消さない。取り消しは元の行の `undone_at` を埋めて kind='unmerge' の行を足す (0042 total_cashflow_operations の前例)。
  - 保持は BR-013。payload_jsonは正規化した操作本文とcommandを持ち、before_jsonはvendorのname・aliases・accounts・merged_into_id・見直し判断と復元時のrestoreBarrierを持ち、取引の金額・日付・口座は持たない。before_json を持つのは kind='merge' の行だけで、他の kind は取り消しの対象でないので NULL にする〔本書で置いた値〕。
  - `packages/api/src/schema-guard.ts:4` の `EXPECTED_D1_MIGRATION` を `0058_subscription_merge_operations.sql` へ進める。参照は `packages/api/src/index.test.ts:6` と `packages/api/src/deletion-schema.test.ts:63` (0057 の名前を直書きで検査する行)〔現物 2026-09-30〕。
  - `packages/api/src/db/schema.ts` の `subVendors` (:250) に列を足し、新しい 2 表を足す。
  - backup/restore:
    - 操作表・revisionは `JSON_SNAPSHOT_MUTATION_CONSUMERS` とbackup本文へ追加せず、復元でもbackup値を書き戻さない。保持期限をR2の写しへ持ち越さないためである。
    - `subVendorMetadata` は統合元を含む保存行を運ぶ。任意の `mergedIntoName` (統合先の名前またはnull) に加え、保存値の `aliases`・`accounts`・`sortOrder` をoptional fieldsとして持つ。保存aliasesの上限はcoreの共有定数に従う。Dataset側の実効aliasesは表示・集計用として維持し、統合展開により50件を超えても保存aliasesの上限を適用して切り捨てない。
    - 復元はmetadataの保存値を優先する。fieldsのない旧JSONでは根のaliases/accountsを既存のDataset値から読み、統合元の欠落値は既存定義を保つ。mergedIntoNameのない旧JSONは統合なしとして読む。参照先が名前集合にない・自己参照・循環はInvalidRestoreSettingsError。
    - ベンダーを名前でupsertし、同じテナントの統合先idを相関サブクエリで引き直す。metadataは環境固有のidを運ばず、保存値の往復を保つ。
    - `restoreTouchesSubscriptions(writeSet)` が真のJSON復元だけ、同じcommit batchで未取り消しmergeのbefore_jsonへ `restoreBarrier=1` を付け、revisionを1進める。古いundoはBR-009の409となり、復元後の定義・判断を上書きしない。一般settings restore (statMinMonths等) は対象外。
    - `Dataset.subs.exactNames` は派生値。loaderの通常取得・backup経路と復元metadataから再構築し、clone/periodで保持するが、exportJSON・DB・永続backup形式には追加しない。

## 認証・認可

- Authentication: 方式を変えない。セッション cookie は `packages/api/src/auth.ts:128-135` で httpOnly・secure・SameSite=Strict として発行し、:137-138 の clearSession で消す〔観測 qa-subsmerge-auth-web-evidence-001〕。Set-Cookie の属性は MDN の記述に従う (出典 mdn-set-cookie)。
- Authorization: 新しい 3 本は既存の /api/* と同じく `authGuard` (auth.ts:245、index.ts:111)・`mustChangePasswordFence` (auth.ts:287、index.ts:113)・`canonicalMutationFence` (index.ts:115) の配下に置く〔-003 由来: qa-subsmerge-auth-web-003〕。
  - `mustChangePasswordFence` はパスの表を持たず全ての /api/* に掛かる〔現物 2026-09-30〕。-003 (security) の「mustChangePasswordFence の対象表に登録」は、配下に置くことで満たす。
  - `canonicalMutationFence` は `canonical-mutation-fence.ts:46` の `CANONICAL_MUTATION_ROUTES` に載ったものだけを直列化する (:264 classifyCanonicalMutation)。`POST /api/sub-vendors/merge` と `POST /api/subscription-operations/:id/undo` は既存のどの正規表現にも当たらないので、明示的に登録する〔現物 2026-09-30〕。consumers は `sub_vendors`・`sub_vendor_review_decisions` と新しい 2 表 (`subscription_operations`・`subscription_revisions`)。既存の書込み 9 本の経路 (`canonical-mutation-fence.ts:219-247`) の consumers にも新しい 2 表を足す (操作の記録と revision の +1 を同じ batch で書くため)〔本書で置いた値〕。`monthly_agg` は派生表で `CanonicalConsumer` の型に無く、既存の sub-vendors 系の経路も載せていない〔現物 2026-09-30〕。
  - role (admin | member) で分けない。取り消しと操作履歴はテナント全体を対象にする〔決定 qa-subsmerge-undo-scope-001〕。
- Tenant/data boundary: テナントは `c.get('userId')` (共有テナント id) からだけ、操作者は `c.get('actor').id` からだけ特定し、本文・クエリ・ヘッダ (Idempotency-Key を含む) から受けない。
  - 「他テナントの id」の検査は、テストで行の user_id を別の値へ付け替えて作る (`packages/api/src/improvement-screen.integration.test.ts:4-5` の前例)。
  - 認証・認可の検査が拒否した要求は path・理由・actor の id でログに残す (ASVS V16.3.2)〔-003 由来: qa-subsmerge-security-web-003〕。

<a id="error-recovery"></a>

## エラー・例外・回復

- Error taxonomy: API 契約の各表のとおり。「未適用」(409 busy・409 revision・503 overloaded) と「適用されたか分からない」(5xx・通信の失敗) と「もう戻せない」(410) を分ける。
  - 既存の前例: `routes/settings-screen.ts:63` の `settings_conflict` (:515・:629 で 409)、`routes/total-cashflow.ts:406-408` の取り消しの 409 と :413-415 の文言、`routes/deletions.ts:324` (404)・:326 (409)・:327-336 (410)〔現物 2026-09-30、観測 qa-subsmerge-maintenance-ops-web-evidence-002〕。
- Retry/Timeout/Fallback:
  - 画面は 409 busy と 503 を同じ key で、409 revision を前提の検査のうえ新しい key で、それぞれ最大 3 回自動で送る (FR-015・FR-016)。
  - 5xx と通信の失敗は利用者の「再試行」で同じ key を送る (FR-017)。
  - lease は `canonical-mutation-fence.ts:296-303` の finally で解放し、解放に失敗した lease は TTL (2 分) で回復する。
  - D1 の overloaded は `index.ts` の `isD1Overloaded` が例外の message に `D1 DB is overloaded` を含むかで判定し、`app.onError` が 503 d1_overloaded に言い換える。前置き付きの message も対象にする。それ以外の例外は既存の onError (`index.ts:151`) が 500 にする。
- Idempotency/Concurrency:
  - Idempotency-Key と `UNIQUE (user_id, actor_user_id, idempotency_key)`。
  - revision と `UNIQUE (user_id, base_revision)`、batch の (a) の条件付き挿入。
  - fence の lease によるテナント単位の直列化。

## イベント・非同期処理

- Producer/Consumer: N/A: キュー・イベント・新しい夜間 job を使わない。直列化は画面の mutation scope とサーバーの lease で行い、保持の掃除は書込みの batch で行う〔決定 qa-subsmerge-decision-005・retention-001〕。
- Delivery/Ordering/Deduplication/DLQ:
  - 順序は画面の scope が保つ。TanStack Query は同じ scope の mutation を直列に実行する (出典 tanstack-query-mutation-scopes)。
  - 別タブ・別端末・別の利用者の順序は revision が守る。重複は Idempotency-Key が除く。
  - DLQ は持たず、失敗は操作状態に残る。
  - `packages/web/package.json` は `^5.62.11`、`pnpm-lock.yaml` の解決版は 5.102.8〔現物 2026-09-30〕。scope と `useMutationState` の型は実装の着手時に解決版で確かめる。

## 可観測性

- Logs/Metrics/Traces/Audit:
  - Workers の observability (`packages/api/wrangler.jsonc:33`) に構造化ログで操作 id・kind・結果・所要 ms・actor の id を出す。取引名・別名・email・金額は出さない (既存の `index.ts:151` onError も明細内容を出さない方針)。
  - 監査の正本は `subscription_operations` (who・what・when)。
  - 認証・認可が拒否した要求は path・理由・actor の id でログに残す。
- Alert/SLO dashboard: N/A: 個人利用のため警報を置かない。止まった操作は UC-8 の 3 段で辿る。手順は `docs/subscriptions-screen.md` に書く〔-003 由来: qa-subsmerge-maintenance-ops-web-003〕。

## 互換性・移行・リリース

- Compatibility/versioning:
  - 応答へのキーの追加 (revision・replayed) と、本文の任意キーの追加 (baseRevision) だけで、既存のキーは変えない。
  - 移行期間の古い画面は baseRevision を送らず、従来どおり動く。
- Migration/backfill:
  - migration 番号の空き: 最新は `migrations/0057_improvement_request_screen.sql`、`schema-guard.ts:4` も 0057 を指す。origin/main (a63d35c) に 0058 以降は無く、0058 は空いている〔現物 2026-09-30〕。実装の着手時に origin/main を取り直して再確認する。
  - 0058 は `ALTER TABLE … ADD COLUMN` と `CREATE TABLE`・`CREATE INDEX` だけの追加型。`.github/scripts/plan-auto-migration.mjs:49` の DESTRUCTIVE_PATTERNS に当たらないため、`.github/migration-approvals.json` の承認は要らず、main への merge で既存の deploy が本番 D1 へ適用する〔-003 由来: qa-subsmerge-infrastructure-web-003〕。
  - backfill は不要。既存行の `merged_into_id` は NULL、revision の行が無ければ 0 とみなす。
- Rollout/rollback:
  - 順序は Migrate → Deploy (Deploy が先だと新しい列と表を読む API に runtimeSchemaGuard が 503 schema_unavailable を返す)。
  - 差し戻しは実装を戻すだけで、列と表は残す。統合済みの行 (merged_into_id が NULL でない) は旧実装では独立した行として再び現れるため、差し戻しの前に統合を取り消すか、それを許容するかを判断する。新しい実装が書いたバックアップの JSON (mergedIntoName・optional保存metadataを含む) は、旧実装の `.strict()` の schema に拒まれる。差し戻した期間の復元には 0058 より前のバックアップを使う〔本書で置いた値〕。

## テストと受入条件

- [ ] `AC-001`: Given 匿名化 fixture に登録済みの行 A (aquavoice 型) と B が同じ期間の取引を持つ, When A を統合元・B を統合先として `POST /api/sub-vendors/merge` を送り `GET /api/subscriptions` を取り直す, Then 正規化名が A の行が 0 件で、B の推定月額が統合後の明細から既存の推定関数で再計算される。同じ支払月・周期のfixtureは統合前の和と一致し、異なる最終支払月・年額と月額の混在のfixtureは統合前300・統合後200になる。各月の実支払額はAC-002で保存を検証する (O1)。
- [ ] `AC-002`: Given AC-001 と同じ, When 統合する, Then `monthly_agg` の `subs:B` の各月が統合前の `subs:A` と `subs:B` の和と一致し `subs:A` の行が 0 件で、core の applyFreeeDeals とサブスク画面の照合が同じ取引を同じベンダーに割り当てる (O1)。
- [ ] `AC-003`: Given 統合の連鎖 (C→B→A) と循環 (A→B→A) と自己統合の定義, When `resolveVendorMerges` を呼ぶ, Then 連鎖は A へ解決され、循環と自己統合は例外になる (O1、core 契約)。
- [ ] `AC-004`: Given 同じテナント, When 統合を 5 件連続で送る, Then 全件が 200 か明示的な 409 で終わり 500 が 0 件、最終の subs 範囲が最後に完了した操作の状態と一致する (O2)。
- [ ] `AC-005`: Given 同じテナントの 2 人の利用者, When 統合を 2 件同時に送る, Then 片方が 200、もう片方が未適用の 409 (canonical_write_busy か subscription_revision_conflict) で 500 が 0 件、集計が 200 の操作と一致する (O2)。
- [ ] `AC-006`: Given 1 度成功した統合, When 同じ Idempotency-Key・kind・command・正規化本文で再送する, Then 200 で同じ operation id と `replayed: true` を返し、aliases・merged_into_id・revision・subs 範囲が 1 回分しか変わらない。同じ key で別のkind・command・本文は 422 idempotency_key_reused (O2)。
- [ ] `AC-007`: Given 一覧, When 1 行だけ選ぶ, Then 全選択が mixed を示し、全行を選ぶと checked になる (O3)。
- [ ] `AC-008`: Given 登録済み 2 行と取引名 1 件を選ぶ, When 選択バーを見る, Then 「3件の取引を選択中」、3 つのチップ、統合先の既定 (推定月額が最大の登録済み行)、「選択した3件を統合」「選択を解除」が出る (O3)。
- [ ] `AC-009`: Given 統合を 2 件続けて押す, When 1 件目が処理中, Then 操作状態に操作者の email と「処理中」「待機中」が文字で出て、完了後に「完了」、5xx の失敗時に「失敗」と「再試行」が出る (O3)。
- [ ] `AC-010`: Given 完了した統合, When 操作状態を見る, Then その行に「元に戻す」があり、押すと取り消しの操作が積まれ、完了後に「(email) が元に戻しました」が出る (O3)。
- [ ] `AC-011`: Given 処理中, When 行チェック・全選択・取引名チェックを押す, Then いずれも無効で選択が変わらない (O3)。
- [ ] `AC-012`: Given 行の user_id を別の値へ付け替えたベンダーと操作, When その id で統合・取り消しを送る, Then 404 not_found で、他テナントの行が変わらない (O4)。
- [ ] `AC-013`: Given 統合の直後, When 別の利用者がその操作を取り消して `GET /api/subscriptions` を取り直す, Then 統合前と同じ行・同じ月額・同じ subs 範囲に戻り、統合と取り消しの両方の actor_user_id が残る (O4)。
- [ ] `AC-014`: Given revision が 8 の状態, When baseRevision 7 で統合または PUT を送る, Then 409 subscription_revision_conflict で、sub_vendors・操作・revision が変わらない (O4)。
- [ ] `AC-015`: Given 409 canonical_write_busy を 2 回返してから 200 を返すモック, When 統合を押す, Then 「別の操作を処理中です。自動で再試行します (n/3)」が出て同じ key で再送され、「サーバー側で処理に失敗しました」は出ずに完了する。500 を返すモックでは自動で再送せず「再試行」が出る (O2・O3)。
- [ ] `AC-016`: Given `?vendor=` が統合元を指す, When 統合が完了する, Then URL が統合先を指し、選択が空になる (FR-021)。
- [ ] `AC-017`: Given 統合の後に同じ統合先への統合がもう 1 件ある, When 先の統合を取り消す, Then 409 undo_blocked_by_later_operation (BR-009)。
- [ ] `AC-018`: Given baseRevision を送らない既存の PUT, When 送る, Then 従来どおり 200 で、操作が actor 付きで記録され revision が進む (互換)。
- [ ] `AC-019`: Given created_at が 31 日前の統合の fixture, When 取り消す, Then 410 undo_expired。Given 31 日前と 401 日前の行, When 新しい書込みを 1 回送る, Then 31 日前の行の payload_json と before_json が NULL になり、401 日前の行が消え、1 回で変わる行はそれぞれ 50 件まで (O4・BR-013)。
- [ ] `AC-020`: Given 統合と取り消し, When `GET /api/subscription-operations` を取る, Then before_json・payload_json・key が応答に無く、observability のログに取引名・別名・email・金額が出ない (O4)。
- [ ] `AC-021`: Given revision の衝突を 1 回返すモックで統合の前提が保たれている, When 統合を押す, Then 「他の利用者の操作が先に反映されました。最新の状態で送り直しています (1/3)」が出て新しい key で送り直される。統合元が他の操作で統合済みなら送らず「(統合元の名前) は他の操作で変更されたため…」が出る (O2・O3)。
- [ ] `AC-022`: Given 操作者が users に居ない操作, When 操作状態を見る, Then 「削除された利用者」と出る。停止中の利用者の操作は email で出る (O3)。
- [ ] `AC-023`: Given 全ての変更, When `pnpm verify:full` と CI を走らせる, Then 緑 (U5)。
- Contract/integration/e2e/security/performance:
  - core 契約: `packages/core/test/subs-contract.test.ts`・`subs-screen-contract.test.ts` に AC-002 (照合の一致)・AC-003・`defaultMergeTarget` を足す。
  - api 統合: `packages/api/src/subs-screen.integration.test.ts` と新しい `packages/api/src/subs-merge-operations.integration.test.ts` に AC-001・004〜006・012〜014・017〜020〔配置は -003 由来: qa-subsmerge-maintenance-ops-web-003〕。
  - web DOM: `packages/web/src/subscriptions-screen.dom.test.tsx` に AC-007〜011・015・016・021・022。
  - e2e: N/A: 既存にサブスク統合の e2e が無く、DOM と api 統合で足りるとする。
  - security: AC-012・014・020 と、本文の user_id と actor を無視する検査。
  - performance: 統合 1 回の D1 の問い合わせ数を統合テストで数え、20 未満を検査する。
  - 期待値は `expect` の値の比較で固定する (出典 vitest-expect、5.0.3)。旧実装で落ちることを確かめる (0 件の違反と 0 件しか調べていないことを区別する)。

## 確定した実装契約

P05〜P12 で確定し、従来 docs の「設計から変えたこと」に記録していた11点を本書へ反映した。要件・API・AC の正本は本書で、構造と採用理由は各 architecture 文書に置く。推定月額の契約は後述の「推定月額の契約確定」で明示する。

| # | 現行契約 | 構造・理由 |
|---|---|---|
| 1 | 選択バーは sticky のまま。末尾余白は 96px を保ち、`ResizeObserver` で得た高さを `--subs-selection-h` に反映する。選択中の `scroll-padding-bottom` は高さ + 12px + safe area とし、Tab の移動先をバーの上に保つ。 | [UI-UX](../architecture/subscriptions-merge-ui-ux.md#実装時に確定した判断) |
| 2 | タブバーの上への持ち上げは 640px 以下だけ。同じ幅で scroll padding に `--tabbar-h` + 8px を加える。 | 同上 |
| 3 | 全書込みを同じ mutation scope に並べ、TanStack の `retry` は 0。`mutationFn` のループが busy と revision をそれぞれ独立に最大3回扱う。手動再試行は最後の要求を `PinnedRequest` として保持する。 | [frontend](../architecture/subscriptions-merge-frontend.md#実装時に確定した判断) |
| 4 | FR-002 の選択は重複のない挿入順の `string[]`。一覧の所属判定に使う `Set` は派生値とし、選んだ順を保つ。 | 同上 |
| 5 | 新しい3経路は `routes/subs.ts` に登録し、`subscription-writes.ts` に `handleMerge`・`handleUndo`・`listSubscriptionOperations` と BR-009 の判定を置く。 | [backend](../architecture/subscriptions-merge-backend.md#実装時に確定した判断) |
| 6 | overloaded の判定は `index.ts` の `isD1Overloaded`。例外 message の前置きに依存せず `D1 DB is overloaded` を含むものを 503 に写す。 | 同上 |
| 7 | 統合先の削除は読み取り済みの全ベンダーから `mergeFamily` の不動点ループでまとまりを集め、id と vendor_key の一覧を2つの DELETE に渡す。書込み直前の revision 検査と共通の存在条件で競合を止める。 | 同上 |
| 8 | 統合・取り消しのベンダー更新は `rewriteVendorsStatement` の `UPDATE … FROM json_each(?)` の1文。API 契約のトランザクション境界に従う。 | 同上 |
| 9 | `defaultMergeTarget` は `subs-screen.ts` に置き、`index.ts` から再公開する。名寄せと循環例外は `subs.ts` に置く。 | 同上 |
| 10 | `projectSubsAggregate` は `dataset.ts`。入力は `resolved`・`deals: readonly FreeeDeal[]`・`cashDeals: readonly FreeeDeal[]`・`businessBaseline`・`current`。行の型は `SubsAggRow` (`month, scope, amount`)。`deals` は収入を含む全仕訳を月の集合に使い、照合時だけ支出へ絞る。独立した `SubsAggregateInput` 型は作らない。 | 同上 |
| 11 | 復元の参照更新は統合元ごとの相関サブクエリ。revision と古いundoのbarrierは `restoreTouchesSubscriptions(writeSet)` が真のJSON復元にだけ適用し、一般settings restoreを妨げない。操作履歴とrevisionはbackupの値で上書きしない。 | [database](../architecture/subscriptions-merge-database.md#実装時に確定した判断) |
| 12 | 状態の読取り・読取りの stamp・登録の CAS は、行の無い利用者を 0 と読む同じ式 (`subscription-writes.ts` の `revisionOf`) で revision を比べる。 | [backend](../architecture/subscriptions-merge-backend.md#実装時に確定した判断) |

P13 の前の elegant review (2026-10-01) で、次の 4 点を現行契約へ反映した: BR-005 (循環は BR-001 の 409 で先に止まる)、読取りの no-store を成否を問わず付けること (共通スナップショット契約)、登録の再送で作った行の id を返すこと (既存書込みの実行セマンティクス)、他画面の派生分析の取り直し (入力・再取得・タブの追加契約)。

## 推定月額の契約確定

2026-10-01の「全て完了させて」という指示を受け、提示済みの推奨案である現行の再推定規則を採用した。利用者が個別案を明示選択した記録ではなく、完了指示に基づく実装者の判断である。

- O1・AC-001: 統合後の明細を既存の推定関数に渡して月額・年換算を再計算する。最終支払月・周期が異なると、統合前の推定月額の和との一致は保証しない。推定値は保存せず導出する。
- AC-002: 同一期間・同一母集団の各月の実支払額は統合前の両者の和を保存する。core/API/画面は同じ名寄せを使い、各画面の母集団は既存契約を保つ。
- 同じ支払月・周期のfixtureでは推定月額も和になる。異なる最終支払月と年額・月額混在の2つのfixtureは統合前300・統合後200を期待値とする。`packages/core/test/subs-screen-contract.test.ts` で回帰を固定する。
- 統合元の完全一致・対象科目の和集合・undo・backup往復はこの規則を維持する。派生値を保存する新しい状態や移行は追加しない。

第1〜3周の確認事項も確定済みである。過去の質疑・承認記録は当時の記録として保持し、現行契約は本節とO1・AC-001を参照する。

## 実装時の確認事項

実装の着手時に現物で確かめる事項 (担当: 実装者。期限: 各タスクの着手時):

- migration 番号 0058: origin/main を取り直して空きを確かめる。埋まっていれば次の番号へ直し、`schema-guard.ts`・テスト・本書を同じ変更で直す。
- mutation scope の型: 解決版 5.102.8 で `scope` と `useMutationState` の型を確かめる。
- D1 の問い合わせ数: 統合 1 回の実測値が 20 未満であることを統合テストで確かめる。超えるなら読み取りを減らす。
- D1 の overloaded の判定: 503 d1_overloaded へ言い換える判定は例外の message に依る。公式の記述と実際の message を確かめる。
- 照合順序のそろえ方 (FR-009) で既存画面の数値が変わる範囲: fixture の期待値の更新が要るかを core の契約テストで確かめる。変わる場合は差を記録する。
